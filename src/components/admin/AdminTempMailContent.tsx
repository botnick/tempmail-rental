'use client';

import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/Toast';
import {
  Server, Save, Shield, Eye, EyeOff, Copy, Check,
  Wifi, WifiOff, Loader2, ExternalLink, ArrowRight,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

/* ────────────────────────────────────────────────────────────────── */
/* Types                                                             */
/* ────────────────────────────────────────────────────────────────── */
type ConnStatus = 'idle' | 'testing' | 'ok' | 'error';

interface AdminTempMailProps {
  dict: { admin: Record<string, string>; ui: Record<string, string> };
}

/* ────────────────────────────────────────────────────────────────── */
/* Main Component                                                    */
/* ────────────────────────────────────────────────────────────────── */
export function AdminTempMailContent({ dict }: AdminTempMailProps) {
  const a = dict.admin;
  const toast = useToast();

  // ── Form state ──────────────────────────────────────────────────
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [connStatus, setConnStatus] = useState<ConnStatus>('idle');
  const [connMsg, setConnMsg] = useState('');
  const [copied, setCopied] = useState('');

  // ── Fetch current configs ───────────────────────────────────────
  const cms = trpc.admin.cms.listContent.useQuery({
    page: 1,
    pageSize: 100,
    search: 'tempmail.',
  });

  useEffect(() => {
    if (cms.data?.data) {
      const urlItem = cms.data.data.find((i: any) => i.key === 'tempmail.api_url');
      const keyItem = cms.data.data.find((i: any) => i.key === 'tempmail.api_key');
      const secretItem = cms.data.data.find((i: any) => i.key === 'tempmail.webhook_secret');
      if (urlItem) setApiUrl(urlItem.value ?? '');
      if (keyItem) setApiKey(keyItem.value ?? '');
      if (secretItem) setWebhookSecret(secretItem.value ?? '');
    }
  }, [cms.data?.data]);

  // ── Mutations ───────────────────────────────────────────────────
  const updateContent = trpc.admin.cms.updateContent.useMutation({
    onError: (err: any) => toast.error(err.message),
  });

  const handleSave = async () => {
    if (!apiUrl.trim()) {
      toast.error(a.tempMailUrlRequired);
      return;
    }

    try {
      await updateContent.mutateAsync({ key: 'tempmail.api_url', value: apiUrl.trim(), reason: a.tempMailReason });
      await updateContent.mutateAsync({ key: 'tempmail.api_key', value: apiKey, reason: a.tempMailReason });
      await updateContent.mutateAsync({ key: 'tempmail.webhook_secret', value: webhookSecret, reason: a.tempMailReason });
      toast.success(a.tempMailSaved);
      cms.refetch();
    } catch {
      // handled by mutation onError
    }
  };

  // ── Test Connection ─────────────────────────────────────────────
  const testConnection = useCallback(async () => {
    if (!apiUrl.trim()) {
      toast.error(a.tempMailUrlRequired);
      return;
    }
    setConnStatus('testing');
    setConnMsg('');

    try {
      const res = await fetch('/api/admin/test-tempmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl: apiUrl.trim(), apiKey }),
      });

      const body = await res.json();

      if (body.status === 'ok') {
        setConnStatus('ok');
        setConnMsg(`${a.tempMailTestOk} (${body.count} domains)`);
      } else {
        setConnStatus('error');
        setConnMsg(body.message ?? 'Connection failed');
      }
    } catch (err: any) {
      setConnStatus('error');
      setConnMsg(err.message ?? 'Connection failed');
    }
  }, [apiUrl, apiKey, a]);

  // ── Copy helper ─────────────────────────────────────────────────
  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 1500);
  };

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/tempmail`
    : 'https://[your-domain]/api/webhooks/tempmail';

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in-up">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{a.tempMail}</h1>
          <p className="text-sm text-text-muted">{a.tempMailSubtitle}</p>
        </div>

        {/* Connection status pill */}
        {connStatus !== 'idle' && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all animate-fade-in-up ${
            connStatus === 'testing' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
            connStatus === 'ok'      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                       'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {connStatus === 'testing' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {connStatus === 'ok'      && <Wifi className="w-3.5 h-3.5" />}
            {connStatus === 'error'   && <WifiOff className="w-3.5 h-3.5" />}
            <span className="truncate max-w-[220px]">
              {connStatus === 'testing' ? a.tempMailTesting : connMsg}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Card 1: API Connection ─────────────────────────────── */}
        <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-6 animate-fade-in-up delay-1">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
              <Server className="w-4.5 h-4.5 text-brand" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary">{a.tempMailApiConfig}</h2>
              <p className="text-[11px] text-text-muted">{a.tempMailApiConfigDesc}</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* API URL */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">{a.tempMailUrl}</label>
              <div className="relative">
                <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/40" />
                <input
                  type="url"
                  name="tempmail_server_url"
                  value={apiUrl}
                  onChange={(e) => { setApiUrl(e.target.value); setConnStatus('idle'); }}
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  className="w-full bg-white/[0.04] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 pl-10 pr-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/40 font-mono"
                  placeholder={a.tempMailUrlPlaceholder}
                />
              </div>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">{a.tempMailKey}</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  name="tempmail_api_key_field"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="new-password"
                  data-1p-ignore
                  data-lpignore="true"
                  className="w-full bg-white/[0.04] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-4 pr-10 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/40 font-mono"
                  placeholder={a.tempMailKeyPlaceholder}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted/40 hover:text-text-secondary transition-colors cursor-pointer"
                  title={showApiKey ? 'Hide' : 'Show'}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-text-muted/60 mt-1">{a.tempMailKeyHint}</p>
            </div>

            {/* Actions row */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={testConnection}
                disabled={connStatus === 'testing' || !apiUrl.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl border border-border-subtle bg-white/[0.04] hover:bg-white/[0.08] text-text-primary transition-all disabled:opacity-40 cursor-pointer"
              >
                {connStatus === 'testing'
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Wifi className="w-4 h-4" />
                }
                {a.tempMailTestBtn}
              </button>
              <div className="flex-1" />
              <button
                onClick={handleSave}
                disabled={updateContent.isPending}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {updateContent.isPending ? a.tempMailSaving : a.tempMailSaveConfig}
              </button>
            </div>
          </div>
        </div>

        {/* ─── Card 2: Webhook Security ───────────────────────────── */}
        <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-6 animate-fade-in-up delay-2">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Shield className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary">{a.tempMailWebhookSetup}</h2>
              <p className="text-[11px] text-text-muted">{a.tempMailWebhookSetupDesc}</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Webhook Endpoint — readonly copy field */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">{a.tempMailWebhookEndpoint}</label>
              <div className="flex gap-2">
                <code className="flex-1 bg-white/[0.04] border border-border-subtle rounded-xl text-text-secondary text-[12px] font-mono py-2.5 px-4 truncate select-all">
                  {webhookUrl}
                </code>
                <button
                  onClick={() => copy('wh-url', webhookUrl)}
                  className="w-10 h-10 rounded-xl border border-border-subtle bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-text-muted/50 hover:text-brand transition-all cursor-pointer shrink-0"
                >
                  {copied === 'wh-url' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-text-muted/60 mt-1 flex items-center gap-1">
                <ArrowRight className="w-3 h-3" />
                {a.tempMailWebhookDesc}
              </p>
            </div>

            {/* Webhook Secret */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">{a.tempMailWebhookSecret}</label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/40" />
                <input
                  type={showSecret ? 'text' : 'password'}
                  name="tempmail_webhook_secret_field"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  autoComplete="new-password"
                  data-1p-ignore
                  data-lpignore="true"
                  className="w-full bg-white/[0.04] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 pl-10 pr-10 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/40 font-mono"
                  placeholder={a.tempMailWebhookSecretPlaceholder}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted/40 hover:text-text-secondary transition-colors cursor-pointer"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-text-muted/60 mt-1">{a.tempMailWebhookSecretHint}</p>
            </div>

            {/* HMAC Info Box */}
            <div className="bg-emerald-500/[0.06] border border-emerald-500/15 rounded-xl p-4 mt-2">
              <div className="flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-emerald-400 mb-1">{a.tempMailHmacTitle}</p>
                  <p className="text-[11px] text-text-muted leading-relaxed">{a.tempMailHmacDesc}</p>
                </div>
              </div>
            </div>

            {/* Save webhook section */}
            <div className="flex justify-end pt-1">
              <button
                onClick={handleSave}
                disabled={updateContent.isPending}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {updateContent.isPending ? a.tempMailSaving : a.tempMailSaveConfig}
              </button>
            </div>
          </div>
        </div>

        {/* ─── Card 3: Quick Links ────────────────────────────────── */}
        <div className="lg:col-span-2 bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-5 animate-fade-in-up delay-3">
          <p className="text-xs font-semibold text-text-secondary mb-3">{a.tempMailQuickLinks}</p>
          <div className="flex flex-col gap-3">
            <a
              href={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/tempmail`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border border-border-subtle rounded-xl text-sm text-text-secondary hover:text-brand hover:bg-brand/5 hover:border-brand/20 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Webhook Endpoint
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
