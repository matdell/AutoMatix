import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '../common/prisma.service';
import { NotificationType, Prisma } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private resend?: Resend;
  private fromAddress: string;

  constructor(private config: ConfigService, private prisma: PrismaService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.fromAddress = this.config.get<string>('RESEND_FROM') || 'no-reply@plataforma.local';
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
  }

  private async deliver(params: {
    tenantId: string;
    tipo: NotificationType;
    destino: string;
    subject: string;
    html: string;
    payload?: Record<string, unknown>;
  }) {
    let estado = 'PENDIENTE';
    try {
      if (this.resend) {
        await this.resend.emails.send({
          from: this.fromAddress,
          to: params.destino,
          subject: params.subject,
          html: params.html,
        });
        estado = 'ENVIADO';
      } else {
        estado = 'SIMULADO';
      }
    } catch (error) {
      estado = 'ERROR';
      // eslint-disable-next-line no-console
      console.error('Error enviando notificacion', {
        tipo: params.tipo,
        destino: params.destino,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }

    await this.prisma.notification.create({
      data: {
        tenantId: params.tenantId,
        tipo: params.tipo,
        destino: params.destino,
        estado,
        payload: params.payload
          ? (params.payload as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  async sendInvitation(tenantId: string, email: string, token: string) {
    const acceptUrl = `${this.config.get<string>('APP_URL') || 'http://localhost:3000'}/invitaciones/${encodeURIComponent(token)}`;
    await this.deliver({
      tenantId,
      tipo: NotificationType.INVITATION,
      destino: email,
      subject: 'Invitacion para participar en campañas',
      html: `<p>Fuiste invitado a gestionar campañas con tu banco.</p><p>Completa el proceso en: <strong>${acceptUrl}</strong></p>`,
      payload: { flow: 'invitation_accept' },
    });
  }

  async sendWelcome(
    tenantId: string,
    email: string,
    nombre: string,
    passwordSetupToken: string,
    bankSlug?: string,
  ) {
    const setupUrl = `${this.config.get<string>('APP_URL') || 'http://localhost:3000'}/reset-password?token=${encodeURIComponent(passwordSetupToken)}`;
    await this.deliver({
      tenantId,
      tipo: NotificationType.WELCOME,
      destino: email,
      subject: 'Tu usuario fue creado',
      html: `
        <p>Hola ${nombre}, tu usuario en AutoMatix fue creado.</p>
        <p><strong>Email:</strong> ${email}</p>
        ${bankSlug ? `<p><strong>Banco (slug):</strong> ${bankSlug}</p>` : ''}
        <p>Define tu contrasena inicial desde este enlace (valido por 24 horas):</p>
        <p><strong>${setupUrl}</strong></p>
      `,
      payload: { bankSlug, flow: 'password_setup' },
    });
  }

  async sendPasswordReset(tenantId: string, email: string, token: string) {
    const resetUrl = `${this.config.get<string>('APP_URL') || 'http://localhost:3000'}/reset-password?token=${encodeURIComponent(token)}`;
    await this.deliver({
      tenantId,
      tipo: NotificationType.PASSWORD_RESET,
      destino: email,
      subject: 'Recuperar contraseña',
      html: `
        <p>Recibimos un pedido para restablecer tu contraseña.</p>
        <p>Usa este enlace para crear una nueva: <strong>${resetUrl}</strong></p>
        <p>Si no pediste este cambio, ignora este correo.</p>
      `,
      payload: { flow: 'password_reset' },
    });
  }

  async sendReminder(tenantId: string, email: string, mensaje: string) {
    await this.deliver({
      tenantId,
      tipo: NotificationType.REMINDER,
      destino: email,
      subject: 'Recordatorio de invitacion pendiente',
      html: `<p>${mensaje}</p>`,
    });
  }

  async sendValidationError(tenantId: string, email: string, mensaje: string) {
    await this.deliver({
      tenantId,
      tipo: NotificationType.VALIDATION_ERROR,
      destino: email,
      subject: 'Error de validacion en tus datos',
      html: `<p>${mensaje}</p>`,
    });
  }

  async sendTwoFactorCode(tenantId: string, email: string, code: string) {
    await this.deliver({
      tenantId,
      tipo: NotificationType.TWO_FACTOR_CODE,
      destino: email,
      subject: 'Tu codigo de verificacion',
      html: `
        <p>Usa este codigo para completar el inicio de sesion:</p>
        <p style="font-size: 20px; font-weight: 700; letter-spacing: 2px;">${code}</p>
        <p>El codigo vence en 10 minutos.</p>
      `,
      payload: { flow: '2fa_email' },
    });
  }
}
