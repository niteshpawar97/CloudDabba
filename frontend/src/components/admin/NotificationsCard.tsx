import { useEffect, useState } from 'react';
import { Bell, Loader2, Check, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import {
  getNotificationSettings, updateNotificationSettings, testNotification,
  NotificationSettings, NotifyEvent,
} from '../../api/admin';

const inputCls = 'mt-1 block w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600';

export function NotificationsCard() {
  const [s, setS] = useState<NotificationSettings | null>(null);
  const [webhook, setWebhook] = useState('');
  const [tgToken, setTgToken] = useState('');
  const [tgChat, setTgChat] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const apply = (data: NotificationSettings) => {
    setS(data);
    setTgChat(data.telegramChatId || '');
    setEmail(data.email || '');
  };

  useEffect(() => { getNotificationSettings().then(apply).catch(() => {}); }, []);

  if (!s) return null;

  const run = async (kind: 'save' | 'test', fn: () => Promise<string>) => {
    setBusy(kind);
    setMsg(null);
    try {
      setMsg({ ok: true, text: await fn() });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.response?.data?.message || e?.message || 'Failed' });
    } finally {
      setBusy(null);
    }
  };

  const save = () => run('save', async () => {
    // Secrets: empty field = keep the stored value, so only send what the admin typed.
    const data = await updateNotificationSettings({
      ...(webhook ? { webhookUrl: webhook } : {}),
      ...(tgToken ? { telegramToken: tgToken } : {}),
      telegramChatId: tgChat,
      email,
    });
    setWebhook('');
    setTgToken('');
    apply(data);
    return 'Saved';
  });

  const clear = (field: 'webhookUrl' | 'telegramToken') => run('save', async () => {
    apply(await updateNotificationSettings({ [field]: '' }));
    return 'Removed';
  });

  const toggle = (k: NotifyEvent) =>
    updateNotificationSettings({ events: { [k]: !s.events[k] } }).then(apply).catch(() => {});

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-lg bg-amber-500/10 p-2"><Bell className="h-5 w-5 text-amber-400" /></div>
        <div>
          <h3 className="text-base font-semibold text-slate-200">Notifications</h3>
          <p className="text-xs text-slate-500">Get alerted about failed deploys, disk usage, unhealthy containers and Docker problems.</p>
        </div>
      </div>

      <div className="space-y-4">
        <label className="block text-xs text-slate-400">
          Webhook URL (Slack, Discord or any JSON endpoint) {s.webhookConfigured && <span className="text-emerald-400">- configured</span>}
          <input className={inputCls} value={webhook} onChange={(e) => setWebhook(e.target.value)}
            placeholder={s.webhookConfigured ? 'Saved - type a new URL to replace' : 'https://hooks.slack.com/services/...'} />
          {s.webhookConfigured && (
            <button type="button" onClick={() => clear('webhookUrl')} className="text-[11px] text-red-400 mt-1">Remove webhook</button>
          )}
        </label>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-xs text-slate-400">
            Telegram bot token {s.telegramConfigured && <span className="text-emerald-400">- configured</span>}
            <input className={inputCls} type="password" value={tgToken} onChange={(e) => setTgToken(e.target.value)}
              placeholder={s.telegramConfigured ? 'Saved - type to replace' : '123456:ABC...'} />
          </label>
          <label className="block text-xs text-slate-400">
            Telegram chat ID
            <input className={inputCls} value={tgChat} onChange={(e) => setTgChat(e.target.value)} placeholder="-1001234567890" />
          </label>
        </div>
        {s.telegramConfigured && (
          <button type="button" onClick={() => clear('telegramToken')} className="text-[11px] text-red-400">Remove Telegram token</button>
        )}

        <label className="block text-xs text-slate-400">
          Email recipient
          <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          {!s.smtpConfigured && (
            <span className="block text-[11px] text-amber-400 mt-1">
              Email is off until SMTP is configured on the server (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM).
            </span>
          )}
        </label>

        <div>
          <p className="text-xs text-slate-400 mb-2">Send alerts for</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {(Object.keys(s.eventLabels) as NotifyEvent[]).map((k) => (
              <label key={k} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input type="checkbox" checked={s.events[k]} onChange={() => toggle(k)} />
                {s.eventLabels[k]}
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={!!busy}>
            {busy === 'save' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => run('test', async () => (await testNotification()).message)} disabled={!!busy}>
            {busy === 'test' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Send test'}
          </Button>
        </div>

        {msg && (
          <p className={`text-xs flex items-center gap-1.5 ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
            {msg.ok ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}{msg.text}
          </p>
        )}
      </div>
    </div>
  );
}
