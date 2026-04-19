import { Controller, Post, Get, Body, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiProperty, ApiBearerAuth } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators';

class LoginDto {
  @ApiProperty({ example: 'admin@metis.ai' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'metis1234' })
  @IsNotEmpty()
  @IsString()
  password!: string;
}

class RefreshDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  refreshToken!: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email/password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Res() res: Response) {
    const result = await this.authService.login(dto.email, dto.password);
    const cookieConfig = this.authService.getCookieConfig();

    // Set secure HttpOnly cookies for token delivery
    res.cookie('metis_access_token', result.accessToken, cookieConfig);
    res.cookie('metis_refresh_token', result.refreshToken, {
      ...cookieConfig,
      path: '/v1/auth/refresh',
    });

    // Return tokens in body for backward compatibility (use cookies in production)
    res.json(result);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user info from JWT' })
  @ApiResponse({ status: 200, description: 'Current user info' })
  async me(@Req() req: any) {
    return {
      userId: req.user.userId,
      email: req.user.email,
      tenantId: req.user.tenantId,
      role: req.user.role,
    };
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body() dto: RefreshDto, @Res() res: Response) {
    const result = await this.authService.refresh(dto.refreshToken);
    const cookieConfig = this.authService.getCookieConfig();

    // Set secure HttpOnly cookies for token delivery
    res.cookie('metis_access_token', result.accessToken, cookieConfig);
    res.cookie('metis_refresh_token', result.refreshToken, {
      ...cookieConfig,
      path: '/v1/auth/refresh',
    });

    // Return tokens in body for backward compatibility
    res.json(result);
  }
}
