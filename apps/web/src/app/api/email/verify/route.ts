/**
 * Next.js API Route: POST /api/email/verify
 *
 * Verifies SMTP connection without sending an email.
 */
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

interface VerifyRequest {
  smtpConfig: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: VerifyRequest = await request.json();

    if (!body.smtpConfig?.user || !body.smtpConfig?.pass || !body.smtpConfig?.host) {
      return NextResponse.json({
        success: false,
        error: 'SMTP 호스트, 계정, 비밀번호를 모두 입력하세요.',
      }, { status: 400 });
    }

    const { smtpConfig } = body;

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port || 587,
      secure: smtpConfig.secure || false,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    await transporter.verify();
    transporter.close();

    return NextResponse.json({
      success: true,
      message: 'SMTP 연결 성공',
    });

  } catch (error) {
    const msg = (error as Error).message;
    console.error('SMTP verify failed:', msg);

    return NextResponse.json({
      success: false,
      error: `SMTP 연결 실패: ${msg}`,
    }, { status: 500 });
  }
}
