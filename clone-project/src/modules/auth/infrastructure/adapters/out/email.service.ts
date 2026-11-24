import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface EmailSendResult {
  sent: boolean;
  previewUrl?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  private async getTransporter(): Promise<nodemailer.Transporter> {
    if (this.transporter) return this.transporter;

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      this.logger.log(`SMTP Transporter configured with host: ${process.env.SMTP_HOST}`);
      return this.transporter;
    }

    try {
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      this.logger.log(`Ethereal SMTP Test Account provisioned: ${testAccount.user}`);
      return this.transporter;
    } catch {
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      return this.transporter;
    }
  }

  async sendVerificationEmail(toEmail: string, username: string, verifyLink: string): Promise<EmailSendResult> {
    try {
      const transporter = await this.getTransporter();
      const from = process.env.SMTP_FROM || '"SyncCord" <noreply@synccord.cloud>';
      const info = await transporter.sendMail({
        from,
        to: toEmail,
        subject: 'Confirme seu e-mail e defina sua senha no SyncCord',
        text: `Olá ${username}!\n\nBem-vindo ao SyncCord! Para confirmar seu e-mail (${toEmail}) e definir a senha da sua conta, acesse o link abaixo:\n\n${verifyLink}\n\nEste link é válido por 24 horas.`,
        html: `
          <div style="font-family: 'Inter', Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #1e1f22; color: #dbdee1; padding: 32px; border-radius: 12px; border: 1px solid #2b2d31;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background: linear-gradient(135deg, #6e7bff, #5865F2); color: #fff; font-weight: 900; font-size: 20px; padding: 12px 18px; border-radius: 12px;">SCD</div>
              <h2 style="color: #ffffff; margin-top: 16px; margin-bottom: 4px;">Confirme seu e-mail no SyncCord</h2>
            </div>
            <p style="font-size: 15px; line-height: 1.6; color: #dbdee1;">Olá <strong>${username}</strong>,</p>
            <p style="font-size: 14px; line-height: 1.6; color: #b5bac1;">Obrigado por criar sua conta no <strong>SyncCord</strong>! Para confirmar que o endereço <strong>${toEmail}</strong> pertence a você e cadastrar sua senha de acesso, clique no botão abaixo:</p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${verifyLink}" style="background-color: #5865F2; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: 700; font-size: 15px; border-radius: 6px; display: inline-block;">Confirmar E-mail e Definir Senha</a>
            </div>
            <p style="font-size: 12px; color: #949ba4; word-break: break-all;">Ou copie e cole este link no seu navegador:<br><a href="${verifyLink}" style="color: #00a8fc;">${verifyLink}</a></p>
          </div>
        `,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
      this.logger.log(`📧 E-mail de confirmação enviado para ${toEmail}. Link: ${verifyLink}`);
      if (previewUrl) {
        this.logger.log(`🔗 Preview Web do E-mail (Ethereal): ${previewUrl}`);
      }
      return { sent: true, previewUrl };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Aviso ao enviar e-mail SMTP para ${toEmail}: ${msg}`);
      return { sent: false };
    }
  }

  async sendPasswordResetEmail(toEmail: string, username: string, resetLink: string): Promise<EmailSendResult> {
    try {
      const transporter = await this.getTransporter();
      const from = process.env.SMTP_FROM || '"SyncCord" <noreply@synccord.cloud>';
      const info = await transporter.sendMail({
        from,
        to: toEmail,
        subject: 'Redefinição de Senha - SyncCord',
        text: `Olá ${username}!\n\nRecebemos uma solicitação para redefinir a senha da sua conta SyncCord (${toEmail}).\nClique no link abaixo para criar uma nova senha:\n\n${resetLink}\n\nSe você não solicitou isso, ignore este e-mail.`,
        html: `
          <div style="font-family: 'Inter', Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #1e1f22; color: #dbdee1; padding: 32px; border-radius: 12px; border: 1px solid #2b2d31;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background: linear-gradient(135deg, #6e7bff, #5865F2); color: #fff; font-weight: 900; font-size: 20px; padding: 12px 18px; border-radius: 12px;">SCD</div>
              <h2 style="color: #ffffff; margin-top: 16px; margin-bottom: 4px;">Redefinição de Senha</h2>
            </div>
            <p style="font-size: 15px; line-height: 1.6; color: #dbdee1;">Olá <strong>${username}</strong>,</p>
            <p style="font-size: 14px; line-height: 1.6; color: #b5bac1;">Recebemos uma solicitação para redefinir a senha associada ao e-mail <strong>${toEmail}</strong>. Clique no botão abaixo para abrir a tela de nova senha:</p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${resetLink}" style="background-color: #5865F2; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: 700; font-size: 15px; border-radius: 6px; display: inline-block;">Redefinir Minha Senha</a>
            </div>
            <p style="font-size: 12px; color: #949ba4; word-break: break-all;">Ou copie e cole este link no seu navegador:<br><a href="${resetLink}" style="color: #00a8fc;">${resetLink}</a></p>
          </div>
        `,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
      this.logger.log(`📧 E-mail de recuperação de senha enviado para ${toEmail}. Link: ${resetLink}`);
      if (previewUrl) {
        this.logger.log(`🔗 Preview Web do E-mail (Ethereal): ${previewUrl}`);
      }
      return { sent: true, previewUrl };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Aviso ao enviar e-mail de recuperação para ${toEmail}: ${msg}`);
      return { sent: false };
    }
  }
}
