/**
 * Next.js API Route: POST /api/email/send
 *
 * Sends email via SMTP using Nodemailer.
 * This runs server-side in Next.js, so no separate API server needed.
 */
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

interface SendEmailRequest {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  html?: string; // HTML body string — if provided, sent as HTML email
  smtpConfig: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    fromName?: string;
    fromEmail?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: SendEmailRequest = await request.json();

    // Validate required fields
    if (!body.to || !body.subject || !body.smtpConfig?.user || !body.smtpConfig?.pass) {
      return NextResponse.json({
        success: false,
        error: '필수 항목이 누락되었습니다: 수신자(to), 제목(subject), SMTP 계정(user), SMTP 비밀번호(pass)',
        timestamp: new Date().toISOString(),
        recipient: body.to || '',
        subject: body.subject || '',
      }, { status: 400 });
    }

    const { smtpConfig } = body;

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host || 'smtp.gmail.com',
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

    // Build from address
    const fromAddress = smtpConfig.fromName
      ? `"${smtpConfig.fromName}" <${smtpConfig.fromEmail || smtpConfig.user}>`
      : smtpConfig.fromEmail || smtpConfig.user;

    // Send email — prefer HTML body if provided, fallback to text
    const info = await transporter.sendMail({
      from: fromAddress,
      to: body.to,
      subject: body.subject,
      text: body.body, // Always include text fallback
      ...(body.html ? { html: body.html } : {}), // HTML body takes priority
      ...(body.cc && { cc: body.cc }),
      ...(body.bcc && { bcc: body.bcc }),
    });

    // Close transporter
    transporter.close();

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      timestamp: new Date().toISOString(),
      recipient: body.to,
      subject: body.subject,
    });

  } catch (error) {
    const msg = (error as Error).message;
    console.error('Email send failed:', msg);

    return NextResponse.json({
      success: false,
      error: `이메일 발송 실패: ${msg}`,
      timestamp: new Date().toISOString(),
      recipient: '',
      subject: '',
    }, { status: 500 });
  }
}
