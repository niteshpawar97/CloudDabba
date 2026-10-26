import nodemailer from 'nodemailer';
import prisma from '../../database/connection';
import logger from '../../shared/utils/logger';
import { encrypt, decrypt } from './encryption.service';
import { AppError } from '../types';

/**
 * Admin notifications over webhook (Slack / Discord / generic), Telegram and
 * SMTP email. Sending never throws and never blocks the caller: a broken
 * notification channel must not break a deploy or a cleanup.
 */

export type NotifyEvent = 'deployFailed' | 'diskAlert' | 'containerUnhealthy' | 'dockerDaemon' | 'signupPending' | 'backupFailed';

export const EVENT_LABELS: Record<NotifyEvent, string> = {
  deployFailed: 'Deployment failed',
  diskAlert: 'Disk usage threshold crossed',
  containerUnhealthy: 'Container unhealthy / crash-looping',
  dockerDaemon: 'Docker daemon problem',
  signupPending: 'New signup awaiting approval',
  backupFailed: 'Scheduled database backup failed',
};

const DEFAULT_EVENTS: Record<NotifyEvent, boolean> = {
  deployFailed: true, diskAlert: true, containerUnhealthy: true, dockerDaemon: true, signupPending: true, backupFailed: true,
};

const HTTP_TIMEOUT_MS = 8000;
const DEFAULT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

interface Loaded {
  webhookUrl: string | null;
  telegramToken: string | null;
  telegramChatId: string | null;
  email: string | null;
  events: Record<NotifyEvent, boolean>;
}

const sentAt = new Map<string, number>();

function smtpConfigured() {
  return !!process.env.SMTP_HOST;
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export class NotificationService {
  private static async load(): Promise<Loaded> {
    const row: any = await (prisma as any).platformSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null);
    const dec = (v?: string | null) => {
      if (!v) return null;
      try { return decrypt(v); } catch { return null; }
    };
    return {
      webhookUrl: dec(row?.notifyWebhookUrlEnc),
      telegramToken: dec(row?.notifyTelegramTokenEnc),
      telegramChatId: row?.notifyTelegramChatId || null,
      email: row?.notifyEmail || row?.adminEmail || process.env.ADMIN_EMAIL || null,
      events: { ...DEFAULT_EVENTS, ...((row?.notifyEvents as any) || {}) },
    };
  }

  private static transport() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      connectionTimeout: HTTP_TIMEOUT_MS,
      socketTimeout: HTTP_TIMEOUT_MS,
    });
  }

  /** Transactional email to a user (e.g. password reset). Throws when SMTP is not configured. */
  static async sendEmail(to: string, subject: string, text: string) {
    if (!smtpConfigured()) throw new AppError('SMTP is not configured on this server', 503);
    await this.transport().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'clouddabba@localhost', to, subject, text,
    });
  }

  /** Settings for the admin UI — secrets are never returned. */
  static async getSettings() {
    const s = await this.load();
    return {
      webhookConfigured: !!s.webhookUrl,
      telegramConfigured: !!(s.telegramToken && s.telegramChatId),
      telegramChatId: s.telegramChatId,
      email: s.email,
      smtpConfigured: smtpConfigured(),
      events: s.events,
      eventLabels: EVENT_LABELS,
    };
  }

  /**
   * Partial update. For secrets: undefined = keep, '' = clear, string = replace.
   */
  static async updateSettings(input: {
    webhookUrl?: string;
    telegramToken?: string;
    telegramChatId?: string;
    email?: string;
    events?: Partial<Record<NotifyEvent, boolean>>;
  }) {
    const data: any = {};
    if (input.webhookUrl !== undefined) {
      const u = input.webhookUrl.trim();
      if (u) {
        let parsed: URL;
        try { parsed = new URL(u); } catch { throw new AppError('Webhook URL is not a valid URL', 400); }
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new AppError('Webhook URL must be http(s)', 400);
      }
      data.notifyWebhookUrlEnc = u ? encrypt(u) : null;
    }
    if (input.telegramToken !== undefined) {
      const t = input.telegramToken.trim();
      data.notifyTelegramTokenEnc = t ? encrypt(t) : null;
    }
    if (input.telegramChatId !== undefined) data.notifyTelegramChatId = input.telegramChatId.trim() || null;
    if (input.email !== undefined) {
      const e = input.email.trim();
      if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new AppError('Email address is not valid', 400);
      data.notifyEmail = e || null;
    }
    if (input.events) {
      const merged: Record<string, boolean> = { ...DEFAULT_EVENTS };
      const current = await this.load();
      Object.assign(merged, current.events);
      for (const k of Object.keys(DEFAULT_EVENTS)) {
        if (typeof (input.events as any)[k] === 'boolean') merged[k] = (input.events as any)[k];
      }
      data.notifyEvents = merged;
    }
    await (prisma as any).platformSettings.upsert({
      where: { id: 'singleton' },
      update: data,
      create: { id: 'singleton', ...data },
    });
    return this.getSettings();
  }

  private static async deliver(s: Loaded, title: string, message: string, event: string): Promise<string[]> {
    const text = `${title}\n${message}`;
    const errors: string[] = [];
    const jobs: Promise<void>[] = [];

    if (s.webhookUrl) {
      // `text` (Slack) and `content` (Discord) are both sent; generic receivers get the structured fields.
      jobs.push(post(s.webhookUrl, { text, content: text, event, title, message })
        .catch((e) => { errors.push(`webhook: ${e.message}`); }));
    }
    if (s.telegramToken && s.telegramChatId) {
      jobs.push(post(`https://api.telegram.org/bot${s.telegramToken}/sendMessage`, { chat_id: s.telegramChatId, text })
        .catch((e) => { errors.push(`telegram: ${e.message.replace(s.telegramToken!, '***')}`); }));
    }
    if (s.email && smtpConfigured()) {
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        connectionTimeout: HTTP_TIMEOUT_MS,
        socketTimeout: HTTP_TIMEOUT_MS,
      });
      jobs.push(transport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'clouddabba@localhost',
        to: s.email,
        subject: `[CloudDabba] ${title}`,
        text: message,
      }).then(() => undefined).catch((e) => { errors.push(`email: ${e.message}`); }));
    }
    await Promise.all(jobs);
    return errors;
  }

  /**
   * Fire-and-forget event notification. `dedupeKey` + `cooldownMs` suppress repeats
   * (e.g. the same unhealthy container every minute).
   */
  static notify(event: NotifyEvent, title: string, message: string, opts: { dedupeKey?: string; cooldownMs?: number } = {}) {
    void (async () => {
      try {
        const key = opts.dedupeKey ? `${event}:${opts.dedupeKey}` : null;
        if (key) {
          const last = sentAt.get(key) || 0;
          if (Date.now() - last < (opts.cooldownMs ?? DEFAULT_COOLDOWN_MS)) return;
        }
        const s = await this.load();
        if (!s.events[event]) return;
        if (!s.webhookUrl && !(s.telegramToken && s.telegramChatId) && !(s.email && smtpConfigured())) return;
        if (key) sentAt.set(key, Date.now());
        const errors = await this.deliver(s, title, message, event);
        if (errors.length) logger.warn(`Notification "${title}" partially failed: ${errors.join('; ')}`);
      } catch (e: any) {
        logger.warn(`Notification failed: ${e.message}`);
      }
    })();
  }

  /** For the "Send test" button — reports per-channel failures to the admin. */
  static async sendTest() {
    const s = await this.load();
    const channels = [s.webhookUrl && 'webhook', s.telegramToken && s.telegramChatId && 'telegram', s.email && smtpConfigured() && 'email']
      .filter(Boolean) as string[];
    if (channels.length === 0) throw new AppError('No notification channel is configured', 400);
    const errors = await this.deliver(s, 'Test notification', 'This is a test message from CloudDabba. Notifications are working.', 'test');
    return { channels, errors };
  }
}
