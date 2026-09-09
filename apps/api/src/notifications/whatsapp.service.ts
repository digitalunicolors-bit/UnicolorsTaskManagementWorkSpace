import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import {
  NotificationDeliveryStatus,
  NotificationKind,
  ReminderChannel,
} from '../generated/prisma/enums';

type DailyDigestInput = {
  userId: string;
  fullName: string;
  phone: string | null;
  whatsappOptInAt: Date | null;
  whatsappEnabled: boolean;
  dailyDigestEnabled: boolean;
  dueToday: number;
  overdue: number;
  upcoming: number;
  dayStart: Date;
};

type SendResult =
  | { status: 'sent'; providerMessageId: string | null }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string };

type MetaSuccessResponse = {
  messages?: Array<{ id?: string }>;
};

type MetaErrorResponse = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

@Injectable()
export class WhatsappService {
  constructor(private readonly prisma: PrismaService) {}

  private enabled() {
    return String(process.env.WHATSAPP_ENABLED ?? '').toLowerCase() === 'true';
  }

  private config() {
    const graphVersion = String(
      process.env.WHATSAPP_GRAPH_VERSION ?? '',
    ).trim();
    const phoneNumberId = String(
      process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    ).trim();
    const accessToken = String(
      process.env.WHATSAPP_ACCESS_TOKEN ?? '',
    ).trim();
    const templateName = String(
      process.env.WHATSAPP_DAILY_TEMPLATE_NAME ?? '',
    ).trim();
    const templateLanguage = String(
      process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? 'en_US',
    ).trim();

    if (!/^v\d+\.\d+$/.test(graphVersion)) {
      return { ok: false as const, reason: 'WHATSAPP_GRAPH_VERSION is missing or invalid.' };
    }

    if (!/^\d+$/.test(phoneNumberId)) {
      return { ok: false as const, reason: 'WHATSAPP_PHONE_NUMBER_ID is missing or invalid.' };
    }

    if (!accessToken) {
      return { ok: false as const, reason: 'WHATSAPP_ACCESS_TOKEN is missing.' };
    }

    if (!/^[a-z0-9_]+$/.test(templateName)) {
      return { ok: false as const, reason: 'WHATSAPP_DAILY_TEMPLATE_NAME is missing or invalid.' };
    }

    if (!/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(templateLanguage)) {
      return { ok: false as const, reason: 'WHATSAPP_TEMPLATE_LANGUAGE is invalid.' };
    }

    return {
      ok: true as const,
      graphVersion,
      phoneNumberId,
      accessToken,
      templateName,
      templateLanguage,
    };
  }

  private normalizePhone(phone: string | null) {
    if (!phone) {
      return null;
    }

    let digits = phone.replace(/\D/g, '');

    if (digits.startsWith('00')) {
      digits = digits.slice(2);
    }

    const defaultCountryCode = String(
      process.env.WHATSAPP_DEFAULT_COUNTRY_CODE ?? '91',
    ).replace(/\D/g, '');

    if (digits.length === 10 && defaultCountryCode) {
      digits = `${defaultCountryCode}${digits}`;
    }

    if (digits.length < 10 || digits.length > 15) {
      return null;
    }

    return digits;
  }

  private retryMinutes() {
    const parsed = Number(process.env.WHATSAPP_RETRY_MINUTES ?? 60);

    if (!Number.isFinite(parsed) || parsed < 5) {
      return 60;
    }

    return Math.floor(parsed);
  }

  private requestTimeoutMs() {
    const parsed = Number(process.env.WHATSAPP_REQUEST_TIMEOUT_MS ?? 10000);

    if (!Number.isFinite(parsed) || parsed < 1000 || parsed > 60000) {
      return 10000;
    }

    return Math.floor(parsed);
  }

  async sendDailyDigest(input: DailyDigestInput): Promise<SendResult> {
    if (!this.enabled()) {
      return { status: 'skipped', reason: 'WhatsApp delivery is disabled.' };
    }

    if (!input.whatsappEnabled || !input.dailyDigestEnabled) {
      return { status: 'skipped', reason: 'User WhatsApp digest preference is disabled.' };
    }

    if (!input.whatsappOptInAt) {
      return { status: 'skipped', reason: 'User has not opted in to WhatsApp reminders.' };
    }

    const recipient = this.normalizePhone(input.phone);

    if (!recipient) {
      return { status: 'skipped', reason: 'User phone number is missing or invalid.' };
    }

    const config = this.config();

    if (!config.ok) {
      return { status: 'skipped', reason: config.reason };
    }

    const existing = await this.prisma.notificationDelivery.findFirst({
      where: {
        userId: input.userId,
        kind: NotificationKind.TASK_DAILY_DIGEST,
        channel: ReminderChannel.WHATSAPP,
        createdAt: { gte: input.dayStart },
      },
      orderBy: { createdAt: 'desc' },
    });

    const alreadyProcessedStatuses = new Set<NotificationDeliveryStatus>([
      NotificationDeliveryStatus.PENDING,
      NotificationDeliveryStatus.QUEUED,
      NotificationDeliveryStatus.SENT,
      NotificationDeliveryStatus.DELIVERED,
      NotificationDeliveryStatus.READ,
    ]);

    if (existing && alreadyProcessedStatuses.has(existing.status)) {
      return { status: 'skipped', reason: 'Daily WhatsApp digest already processed today.' };
    }

    if (existing?.status === NotificationDeliveryStatus.FAILED) {
      const retryAfter = new Date(
        existing.updatedAt.getTime() + this.retryMinutes() * 60 * 1000,
      );

      if (retryAfter > new Date()) {
        return { status: 'skipped', reason: 'WhatsApp retry cooldown is active.' };
      }
    }

    const summary = `Due today: ${input.dueToday} | Overdue: ${input.overdue} | Upcoming: ${input.upcoming}`;
    const safeName = input.fullName.trim() || 'Team Member';

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'template',
      template: {
        name: config.templateName,
        language: {
          code: config.templateLanguage,
        },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: safeName },
              { type: 'text', text: summary },
            ],
          },
        ],
      },
    };

    const delivery = existing
      ? await this.prisma.notificationDelivery.update({
          where: { id: existing.id },
          data: {
            recipient,
            status: NotificationDeliveryStatus.PENDING,
            provider: 'META_CLOUD_API',
            providerMessageId: null,
            payload,
            errorMessage: null,
            queuedAt: new Date(),
            sentAt: null,
            failedAt: null,
          },
        })
      : await this.prisma.notificationDelivery.create({
          data: {
            userId: input.userId,
            kind: NotificationKind.TASK_DAILY_DIGEST,
            channel: ReminderChannel.WHATSAPP,
            recipient,
            status: NotificationDeliveryStatus.PENDING,
            provider: 'META_CLOUD_API',
            payload,
            queuedAt: new Date(),
          },
        });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs());

    try {
      const response = await fetch(
        `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
      );

      const body = (await response.json().catch(() => null)) as
        | MetaSuccessResponse
        | MetaErrorResponse
        | null;

      if (!response.ok) {
        const errorBody = body as MetaErrorResponse | null;
        const providerMessage = errorBody?.error?.message;
        const reason = providerMessage
          ? `Meta WhatsApp API: ${providerMessage}`
          : `Meta WhatsApp API returned HTTP ${response.status}.`;

        await this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: NotificationDeliveryStatus.FAILED,
            errorMessage: reason.slice(0, 1000),
            failedAt: new Date(),
          },
        });

        console.error('[WhatsApp] Daily digest failed:', reason);
        return { status: 'failed', reason };
      }

      const successBody = body as MetaSuccessResponse | null;
      const providerMessageId = successBody?.messages?.[0]?.id ?? null;

      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: NotificationDeliveryStatus.SENT,
          providerMessageId,
          sentAt: new Date(),
          errorMessage: null,
        },
      });

      console.log(`[WhatsApp] Daily digest sent to ***${recipient.slice(-4)}.`);
      return { status: 'sent', providerMessageId };
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.name === 'AbortError'
            ? 'Meta WhatsApp API request timed out.'
            : error.message
          : 'Unknown WhatsApp delivery error.';

      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: NotificationDeliveryStatus.FAILED,
          errorMessage: reason.slice(0, 1000),
          failedAt: new Date(),
        },
      });

      console.error('[WhatsApp] Daily digest failed:', reason);
      return { status: 'failed', reason };
    } finally {
      clearTimeout(timeout);
    }
  }
}
