import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as dns from 'dns/promises';

export interface EmailSendResult {
  sent: boolean;
  deliveryMethod?: 'smtp' | 'direct-mx';
  error?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private smtpTransporter: nodemailer.Transporter | null = null;

  /**
   * Returns a configured SMTP transporter (e.g. Gmail smtp.gmail.com, Outlook, or custom SMTP)
   * when SMTP_USER and SMTP_PASS are defined in .env.
   */
  private getConfiguredSmtpTransporter(): nodemailer.Transporter | null {
    if (this.smtpTransporter) return this.smtpTransporter;

    const smtpUser = (process.env.SMTP_USER || '').trim();
    const smtpPass = (process.env.SMTP_PASS || '').trim();
    const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;

    if (smtpUser && smtpPass) {
      this.smtpTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
      this.logger.log(`SMTP Real configurado com sucesso (${smtpHost}:${smtpPort} / ${smtpUser})`);
      return this.smtpTransporter;
    }

    return null;
  }

  /**
   * Resolves the recipient domain's real MX servers (e.g. gmail-smtp-in.l.google.com for @gmail.com,
   * outlook-com.olc.protection.outlook.com for @outlook.com/@hotmail.com) and delivers directly
   * via SMTP when no relay credentials are set (works on VPS servers with outbound port 25 open).
   */
  private async sendViaDirectMx(mailOptions: nodemailer.SendMailOptions, toEmail: string): Promise<boolean> {
    const domain = toEmail.split('@')[1];
    if (!domain) return false;

    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) return false;

    const sortedMx = mxRecords.sort((a, b) => a.priority - b.priority);

    for (const mx of sortedMx) {
      try {
        const directTransporter = nodemailer.createTransport({
          host: mx.exchange,
          port: 25,
          secure: false,
          name: process.env.SMTP_EHLO_DOMAIN || 'synccord.cloud',
          tls: {
            rejectUnauthorized: false,
          },
          connectionTimeout: 7000,
        });

        await directTransporter.sendMail(mailOptions);
        this.logger.log(`📧 E-mail entregue diretamente ao servidor MX (${mx.exchange}) para ${toEmail}`);
        return true;
      } catch (mxErr: unknown) {
        const msg = mxErr instanceof Error ? mxErr.message : String(mxErr);
        this.logger.warn(`Tentativa MX direto (${mx.exchange}) falhou: ${msg}`);
      }
    }

    return false;
  }

  private async dispatchEmail(toEmail: string, subject: string, text: string, html: string): Promise<EmailSendResult> {
    const fromAddress =
      process.env.SMTP_FROM ||
      (process.env.SMTP_USER ? `"SyncCord" <${process.env.SMTP_USER}>` : '"SyncCord" <noreply@synccord.cloud>');

    const mailOptions: nodemailer.SendMailOptions = {
      from: fromAddress,
      to: toEmail,
      subject,
      text,
      html,
    };

    // 1. Primary: Configured Gmail / SMTP Relay (smtp.gmail.com or custom SMTP_HOST)
    const configuredTransporter = this.getConfiguredSmtpTransporter();
    if (configuredTransporter) {
      try {
        await configuredTransporter.sendMail(mailOptions);
        this.logger.log(`📧 E-mail enviado via SMTP Real (${process.env.SMTP_HOST || 'smtp.gmail.com'}) para ${toEmail}`);
        return { sent: true, deliveryMethod: 'smtp' };
      } catch (smtpErr: unknown) {
        const msg = smtpErr instanceof Error ? smtpErr.message : String(smtpErr);
        this.logger.error(`Erro no envio via SMTP configurado para ${toEmail}: ${msg}`);
        return { sent: false, error: msg };
      }
    }

    // 2. Secondary: Direct MX delivery to recipient's real email provider (Gmail, Outlook, etc.)
    try {
      const mxDelivered = await this.sendViaDirectMx(mailOptions, toEmail);
      if (mxDelivered) {
        return { sent: true, deliveryMethod: 'direct-mx' };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Falha na resolução MX para ${toEmail}: ${msg}`);
    }

    this.logger.warn(
      `⚠️ Atenção: Para envio garantido via Gmail em redes locais com porta 25 bloqueada, configure SMTP_USER e SMTP_PASS (Senha de App do Google) no arquivo .env.`,
    );
    return {
      sent: false,
      error: 'Servidor SMTP aguardando credenciais SMTP_USER e SMTP_PASS (Gmail App Password) no .env.',
    };
  }

  async sendVerificationEmail(toEmail: string, username: string, verifyLink: string): Promise<EmailSendResult> {
    const subject = 'Confirme seu e-mail e defina sua senha no SyncCord';
    const text = `Olá ${username}!\n\nBem-vindo ao SyncCord! Para confirmar seu e-mail (${toEmail}) e definir a senha da sua conta, acesse o link abaixo:\n\n${verifyLink}\n\nEste link é válido por 24 horas.`;
    const html = `
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
    `;

    return this.dispatchEmail(toEmail, subject, text, html);
  }

  async sendPasswordResetEmail(toEmail: string, username: string, resetLink: string): Promise<EmailSendResult> {
    const subject = 'Redefinição de Senha - SyncCord';
    const text = `Olá ${username}!\n\nRecebemos uma solicitação para redefinir a senha da sua conta SyncCord (${toEmail}).\nClique no link abaixo para criar uma nova senha:\n\n${resetLink}\n\nSe você não solicitou isso, ignore este e-mail.`;
    const html = `
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
    `;

    return this.dispatchEmail(toEmail, subject, text, html);
  }
}
