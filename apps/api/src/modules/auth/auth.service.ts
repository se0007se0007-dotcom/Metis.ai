import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@metis/database';
import * as bcrypt from 'bcryptjs';
import { PRISMA_TOKEN } from '../database.module';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Login with email + password.
   * Password is verified against bcrypt hash stored in User.passwordHash (JSONB metadata).
   * For seed users, password is "metis1234" hashed with bcrypt.
   */
  async login(email: string, password: string, tenantId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: { tenant: true },
          take: 1,
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Password verification via bcrypt
    // passwordHash is stored in the user record's name field metadata for Phase 0
    // In production: dedicated passwordHash column or Auth.js provider
    const storedHash = await this.getPasswordHash(user.id);
    if (!storedHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, storedHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const membership = user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException('No tenant membership found');
    }

    // Multi-tenancy security: validate user belongs to requested tenant
    if (tenantId && membership.tenantId !== tenantId) {
      throw new UnauthorizedException('User does not belong to this tenant');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      tenantId: membership.tenantId,
      tenantSlug: membership.tenant.slug,
      role: membership.role,
    };

    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '7d' },
    );

    // Audit: login event recorded by @Audit decorator or manually
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
      tenant: {
        id: membership.tenant.id,
        slug: membership.tenant.slug,
        name: membership.tenant.name,
      },
    };
  }

  /**
   * Refresh access token using a valid refresh token.
   * JWT algorithm restricted to HS256 to prevent alg:none attacks.
   */
  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('AUTH_SECRET'),
        algorithms: ['HS256'],
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          memberships: { include: { tenant: true }, take: 1 },
        },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      const membership = user.memberships[0];
      if (!membership) {
        throw new UnauthorizedException('No tenant membership');
      }

      const newPayload = {
        sub: user.id,
        email: user.email,
        name: user.name,
        tenantId: membership.tenantId,
        tenantSlug: membership.tenant.slug,
        role: membership.role,
      };

      return {
        accessToken: await this.jwt.signAsync(newPayload),
        refreshToken: await this.jwt.signAsync(
          { sub: user.id, type: 'refresh' },
          { expiresIn: '7d' },
        ),
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Cookie configuration for secure JWT delivery.
   * Used by AuthController to set HttpOnly cookies instead of returning tokens in body.
   * Prevents XSS attacks by making tokens inaccessible to JavaScript.
   */
  getCookieConfig() {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ('strict' as const) : ('lax' as const),
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };
  }

  /**
   * Phase 0: password hash stored in a separate lookup table (UserCredential concept).
   * We use a simple KV approach via AuditLog metadata for now,
   * but in practice this would be a dedicated column or Auth.js.
   *
   * For simplicity, we store hashes in a Map seeded at startup.
   * Production: migrate to Auth.js Credentials or dedicated passwordHash field.
   *
   * Security note: Credential lookup by userId is unique per user, not per tenant,
   * so multi-tenant isolation is inherently maintained for password verification.
   */
  private async getPasswordHash(userId: string): Promise<string | null> {
    // Look up from the credential store (seeded via prisma seed)
    const credential = await this.prisma.knowledgeArtifact.findFirst({
      where: {
        key: `user-credential-${userId}`,
        category: 'AUTH',
      },
    });

    if (credential && credential.contentJson) {
      const content = credential.contentJson as any;
      return content.passwordHash ?? null;
    }

    return null;
  }
}
