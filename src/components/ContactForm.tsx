'use client';

import { useToast } from '@/components/ui/Toast';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';

interface ContactFormProps {
  dict: {
    contact: Record<string, any>;
    ui: Record<string, string>;
  };
}

export function ContactForm({ dict }: ContactFormProps) {
  const c = dict.contact;
  const ui = dict.ui;
  const toast = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || !subject || !message) {
      toast.error(c.validationError ?? 'Please fill in all fields');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to send');
      }

      toast.success(c.successMessage);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err: any) {
      toast.error(err.message ?? c.errorMessage);
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{c.nameLabel}</label>
          <input
            type="text" id="contact-name" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 px-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50"
            placeholder={c.namePlaceholder}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{c.emailLabel}</label>
          <input
            type="email" id="contact-email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 px-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50"
            placeholder="you@email.com"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{c.subjectLabel}</label>
        <select
          id="contact-subject" value={subject} onChange={(e) => setSubject(e.target.value)}
          className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 px-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all"
        >
          <option value="" className="bg-surface">{c.subjectPlaceholder}</option>
          <option value="general" className="bg-surface">{c.subjects?.general}</option>
          <option value="billing" className="bg-surface">{c.subjects?.billing}</option>
          <option value="technical" className="bg-surface">{c.subjects?.technical}</option>
          <option value="pdpa" className="bg-surface">{c.subjects?.pdpa}</option>
          <option value="abuse" className="bg-surface">{c.subjects?.abuse}</option>
          <option value="business" className="bg-surface">{c.subjects?.business}</option>
          <option value="feature" className="bg-surface">{c.subjects?.feature}</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{c.messageLabel}</label>
        <textarea
          id="contact-message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)}
          className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 px-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all resize-none placeholder:text-text-muted/50"
          placeholder={c.messagePlaceholder}
        />
      </div>

      <button
        type="submit" id="contact-submit" disabled={sending}
        className="w-full py-3.5 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
      >
        {sending ? (ui.loading ?? 'Loading...') : c.submit}
        <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
}
