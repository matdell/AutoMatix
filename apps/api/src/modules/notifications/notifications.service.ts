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
    const acceptUrl = `${this.config.get<string>('APP_URL') || 'http://localhost:3000'}/invitaciones/${token}`;
    await this.deliver({
      tenantId,
      tipo: NotificationType.INVITATION,
      destino: email,
      subject: 'Invitacion para participar en campañas',
      html: `<p>Fuiste invitado a gestionar campañas con tu banco.</p><p>Completa el proceso en: <strong>${acceptUrl}</strong></p>`,
      payload: { token },
    });
  }

  async sendWelcome(tenantId: string, email: string, nombre: string, password: string, bankSlug?: string) {
    const loginUrl = `${this.config.get<string>('APP_URL') || 'http://localhost:3000'}/login`;
    await this.deliver({
      tenantId,
      tipo: NotificationType.WELCOME,
      destino: email,
      subject: 'Tu usuario fue creado',
      html: `
        <p>Hola ${nombre}, tu usuario en AutoMatix ya esta activo.</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Password:</strong> ${password}</p>
        ${bankSlug ? `<p><strong>Banco (slug):</strong> ${bankSlug}</p>` : ''}
        <p>Ingresa en: <strong>${loginUrl}</strong></p>
        <p>Te recomendamos cambiar la contraseña luego del primer acceso.</p>
      `,
      payload: { bankSlug },
    });
  }

  async sendPasswordReset(tenantId: string, email: string, token: string) {
    const resetUrl = `${this.config.get<string>('APP_URL') || 'http://localhost:3000'}/reset-password?token=${token}`;
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
      payload: { token },
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
}
