import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    // For development/testing, we'll use a simple transporter
    // In production, you should use a proper email service like SendGrid, Mailgun, etc.
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    });

    // For development without SMTP, use ethereal (test accounts)
    if (!process.env.SMTP_HOST) {
      nodemailer.createTestAccount().then(testAccount => {
        this.transporter = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        this.logger.log('Using Ethereal test account for email');
      });
    }
  }

  async sendResetPasswordEmail(
    to: string,
    resetLink: string,
  ): Promise<boolean> {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@toprankmed.com',
        to,
        subject: 'Reset Your Password',
        html: `
          <h1>Password Reset</h1>
          <p>Click the link below to reset your password:</p>
          <a href="${resetLink}">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `,
      });

      this.logger.log(`Reset password email sent to ${to}`);
      
      // For Ethereal test accounts, preview the URL
      if (process.env.SMTP_HOST === 'localhost') {
        this.logger.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to send reset password email: ${error.message}`);
      return false;
    }
  }

  async sendVerificationEmail(
    to: string,
    verificationLink: string,
  ): Promise<boolean> {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@toprankmed.com',
        to,
        subject: 'Verify Your Email',
        html: `
          <h1>Email Verification</h1>
          <p>Click the link below to verify your email address:</p>
          <a href="${verificationLink}">Verify Email</a>
          <p>If you didn't sign up for an account, please ignore this email.</p>
        `,
      });

      this.logger.log(`Verification email sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send verification email: ${error.message}`);
      return false;
    }
  }
}