'use client';

import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import {
  Search, FileText, HelpCircle, ArrowRightLeft, MessageSquareText,
  Plus, Pencil, Upload, Archive, Trash2, Globe,
} from 'lucide-react';
import { useState } from 'react';
import { formatDate } from '@/lib/dayjs';
import { useDebounce } from '@/hooks/useDebounce';

type Tab = 'pages' | 'faq' | 'redirects' | 'answers';

interface AdminSeoProps {
  dict: { admin: Record<string, string>; ui: Record<string, string> };
}

const TABS: { key: Tab; icon: typeof FileText; labelKey: string }[] = [
  { key: 'pages', icon: FileText, labelKey: 'seoPages' },
  { key: 'faq', icon: HelpCircle, labelKey: 'seoFaq' },
  { key: 'redirects', icon: ArrowRightLeft, labelKey: 'seoRedirects' },
  { key: 'answers', icon: MessageSquareText, labelKey: 'seoAnswers' },
];

/* ────────────────────────────────────────────────────────── */
/* PAGES TAB                                                  */
/* ────────────────────────────────────────────────────────── */
function PagesTab({ dict }: AdminSeoProps) {
  const a = dict.admin;
  const ui = dict.ui;
  const toast = useToast();

  const [locale, setLocale] = useState<'th' | 'en' | ''>('');
  const [statusFilter, setStatusFilter] = useState('');
  const [skip, setSkip] = useState(0);
  const take = 20;

  const pages = trpc.admin.seo.listPages.useQuery({
    locale: locale ? (locale as 'th' | 'en') : undefined,
    status: statusFilter || undefined,
    take,
    skip,
  });

  const publishPage = trpc.admin.seo.publishPage.useMutation({
    onSuccess: () => { toast.success(a.seoPublished); pages.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const archivePage = trpc.admin.seo.archivePage.useMutation({
    onSuccess: () => { toast.success(a.seoArchived); pages.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  /* Create page state */
  const [showCreate, setShowCreate] = useState(false);
  const [newPage, setNewPage] = useState({ slug: '', locale: 'th' as 'th' | 'en', title: '', metaDescription: '' });

  const createPage = trpc.admin.seo.createPage.useMutation({
    onSuccess: () => { toast.success(ui.confirm); setShowCreate(false); pages.refetch(); setNewPage({ slug: '', locale: 'th', title: '', metaDescription: '' }); },
    onError: (e: any) => toast.error(e.message),
  });

  /* Edit page state */
  const [editPage, setEditPage] = useState<{ id: string; title: string; metaDescription: string; slug: string } | null>(null);

  const updatePage = trpc.admin.seo.updatePage.useMutation({
    onSuccess: () => { toast.success(ui.confirm); setEditPage(null); pages.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const [archiveTarget, setArchiveTarget] = useState<string | null>(null);

  const items = pages.data?.items ?? [];

  return (
    <>
      {/* Filters + Create */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select value={locale} onChange={(e) => { setLocale(e.target.value as any); setSkip(0); }}
          className="bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 transition-all">
          <option value="">All Locales</option>
          <option value="th">TH</option>
          <option value="en">EN</option>
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setSkip(0); }}
          className="bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 transition-all">
          <option value="">{ui.all} Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <div className="flex-1" />
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 bg-brand text-white rounded-xl font-bold flex items-center gap-2 hover:bg-brand-hover active:scale-[0.98] transition-all cursor-pointer text-sm">
          <Plus className="w-4 h-4" />{a.seoCreatePage}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden">
        {pages.isLoading ? (
          <div className="p-6"><SkeletonTable rows={6} /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={<FileText className="w-6 h-6" />} title={ui.noResults} description="" />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted/60">
              <span>Page</span><span>Locale</span><span>Status</span><span>Updated</span><span>Actions</span>
            </div>
            {items.map((p: any) => (
              <div key={p.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 hover:bg-white/[0.02] transition-all items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{p.title ?? p.slug}</p>
                  <p className="text-[10px] text-text-muted font-mono truncate">/{p.slug}</p>
                </div>
                <span className="text-xs text-text-secondary uppercase font-mono">{p.locale}</span>
                <StatusBadge status={p.status} />
                <span className="text-[10px] text-text-muted">{formatDate(p.updatedAt)}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditPage({ id: p.id, title: p.title ?? '', metaDescription: p.metaDescription ?? '', slug: p.slug })}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted/40 hover:text-brand hover:bg-brand/10 transition-all cursor-pointer" title={ui.edit}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {p.status === 'draft' && (
                    <button onClick={() => publishPage.mutate({ id: p.id })} disabled={publishPage.isPending}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted/40 hover:text-success hover:bg-success/10 transition-all cursor-pointer" title={a.seoPublish}>
                      <Upload className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {p.status !== 'archived' && (
                    <button onClick={() => setArchiveTarget(p.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted/40 hover:text-warning hover:bg-warning/10 transition-all cursor-pointer" title={a.seoArchive}>
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {(pages.data?.total ?? 0) > take && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={skip <= 0} onClick={() => setSkip((s) => s - take)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.prev}</button>
          <span className="text-xs text-text-muted">{ui.page} {Math.floor(skip / take) + 1} {ui.of} {Math.ceil((pages.data?.total ?? 0) / take)}</span>
          <button disabled={skip + take >= (pages.data?.total ?? 0)} onClick={() => setSkip((s) => s + take)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.next}</button>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0a07]/85 backdrop-blur-xl p-4 animate-fade-in text-left">
          <div className="bg-[#1a1512]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl w-full max-w-lg shadow-[0_0_60px_-12px_rgba(249,115,22,0.15),0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden animate-zoom-in">
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xl font-bold text-text-primary">{a.seoCreatePage}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-2">Slug</label>
                  <input type="text" value={newPage.slug} onChange={(e) => setNewPage({ ...newPage, slug: e.target.value })}
                    className="w-full bg-black/30 border border-white/[0.08] rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                    placeholder="my-page" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-2">Locale</label>
                  <select value={newPage.locale} onChange={(e) => setNewPage({ ...newPage, locale: e.target.value as any })}
                    className="w-full bg-black/30 border border-white/[0.08] rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40">
                    <option value="th">TH</option>
                    <option value="en">EN</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Title</label>
                <input type="text" value={newPage.title} onChange={(e) => setNewPage({ ...newPage, title: e.target.value })}
                  className="w-full bg-black/30 border border-white/[0.08] rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                  placeholder="Page Title (min 10 chars)" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Meta Description</label>
                <textarea value={newPage.metaDescription} onChange={(e) => setNewPage({ ...newPage, metaDescription: e.target.value })}
                  className="w-full h-24 bg-black/30 border border-white/[0.08] rounded-xl text-text-primary text-sm p-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                  placeholder="50-160 characters" />
                <p className="text-[10px] text-text-muted mt-1">{newPage.metaDescription.length}/160</p>
              </div>
            </div>
            <div className="p-4 bg-white/[0.02] border-t border-border-subtle flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors cursor-pointer">{ui.cancel}</button>
              <button onClick={() => createPage.mutate(newPage)} disabled={createPage.isPending || !newPage.slug || !newPage.title || newPage.metaDescription.length < 50}
                className="px-6 py-2 text-sm font-medium text-white bg-brand rounded-xl hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer">{ui.create}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0a07]/85 backdrop-blur-xl p-4 animate-fade-in text-left">
          <div className="bg-[#1a1512]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl w-full max-w-lg shadow-[0_0_60px_-12px_rgba(249,115,22,0.15),0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden animate-zoom-in">
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xl font-bold text-text-primary">{ui.edit}: /{editPage.slug}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Title</label>
                <input type="text" value={editPage.title} onChange={(e) => setEditPage({ ...editPage, title: e.target.value })}
                  className="w-full bg-black/30 border border-white/[0.08] rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Meta Description</label>
                <textarea value={editPage.metaDescription} onChange={(e) => setEditPage({ ...editPage, metaDescription: e.target.value })}
                  className="w-full h-24 bg-black/30 border border-white/[0.08] rounded-xl text-text-primary text-sm p-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10" />
                <p className="text-[10px] text-text-muted mt-1">{editPage.metaDescription.length}/160</p>
              </div>
            </div>
            <div className="p-4 bg-white/[0.02] border-t border-border-subtle flex justify-end gap-3">
              <button onClick={() => setEditPage(null)} className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors cursor-pointer">{ui.cancel}</button>
              <button onClick={() => updatePage.mutate({ id: editPage.id, title: editPage.title, metaDescription: editPage.metaDescription })}
                disabled={updatePage.isPending} className="px-6 py-2 text-sm font-medium text-white bg-brand rounded-xl hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer">{ui.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirm */}
      <ConfirmModal
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={async () => { if (archiveTarget) { await archivePage.mutateAsync({ id: archiveTarget, reason: 'Archived by admin' }); setArchiveTarget(null); } }}
        title={a.seoArchive}
        message={a.seoArchiveMessage}
        confirmLabel={a.seoArchive}
        cancelLabel={ui.cancel}
        variant="warning"
      />
    </>
  );
}

/* ────────────────────────────────────────────────────────── */
/* FAQ TAB                                                    */
/* ────────────────────────────────────────────────────────── */
function FaqTab({ dict }: AdminSeoProps) {
  const a = dict.admin;
  const ui = dict.ui;
  const toast = useToast();

  const [locale, setLocale] = useState<'th' | 'en' | ''>('');

  const faq = trpc.admin.seo.listFaq.useQuery({
    locale: locale ? (locale as 'th' | 'en') : undefined,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [newFaq, setNewFaq] = useState({ question: '', answer: '', locale: 'th' as 'th' | 'en', category: '' });

  const createFaq = trpc.admin.seo.createFaq.useMutation({
    onSuccess: () => { toast.success(ui.confirm); setShowCreate(false); faq.refetch(); setNewFaq({ question: '', answer: '', locale: 'th', category: '' }); },
    onError: (e: any) => toast.error(e.message),
  });

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const deleteFaq = trpc.admin.seo.deleteFaq.useMutation({
    onSuccess: () => { toast.success(ui.confirm); setDeleteTarget(null); faq.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const [editFaq, setEditFaq] = useState<{ id: string; question: string; answer: string; category: string } | null>(null);
  const updateFaq = trpc.admin.seo.updateFaq.useMutation({
    onSuccess: () => { toast.success(ui.confirm); setEditFaq(null); faq.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const items = faq.data ?? [];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select value={locale} onChange={(e) => setLocale(e.target.value as any)}
          className="bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 transition-all">
          <option value="">All Locales</option>
          <option value="th">TH</option>
          <option value="en">EN</option>
        </select>
        <div className="flex-1" />
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 bg-brand text-white rounded-xl font-bold flex items-center gap-2 hover:bg-brand-hover active:scale-[0.98] transition-all cursor-pointer text-sm">
          <Plus className="w-4 h-4" />{a.seoCreateFaq}
        </button>
      </div>

      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden">
        {faq.isLoading ? (
          <div className="p-6"><SkeletonTable rows={5} /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={<HelpCircle className="w-6 h-6" />} title={ui.noResults} description="" />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {items.map((item: any) => (
              <div key={item.id} className="p-4 hover:bg-white/[0.02] transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary">{item.question}</p>
                    <p className="text-xs text-text-secondary mt-1 line-clamp-2">{item.answer}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-text-muted uppercase font-mono">{item.locale}</span>
                      {item.category && <span className="text-[10px] text-brand bg-brand/10 px-2 py-0.5 rounded-md">{item.category}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setEditFaq({ id: item.id, question: item.question, answer: item.answer, category: item.category ?? '' })}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted/40 hover:text-brand hover:bg-brand/10 transition-all cursor-pointer" title={ui.edit}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteTarget(item.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted/40 hover:text-danger hover:bg-danger/10 transition-all cursor-pointer" title={ui.delete}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create FAQ Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0a07]/85 backdrop-blur-xl p-4 animate-fade-in text-left">
          <div className="bg-[#1a1512]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl w-full max-w-2xl shadow-[0_0_60px_-12px_rgba(249,115,22,0.15),0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden animate-zoom-in">
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xl font-bold text-text-primary">{a.seoCreateFaq}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-2">Locale</label>
                  <select value={newFaq.locale} onChange={(e) => setNewFaq({ ...newFaq, locale: e.target.value as any })}
                    className="w-full bg-black/30 border border-white/[0.08] rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40">
                    <option value="th">TH</option>
                    <option value="en">EN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-2">Category</label>
                  <input type="text" value={newFaq.category} onChange={(e) => setNewFaq({ ...newFaq, category: e.target.value })}
                    className="w-full bg-black/30 border border-white/[0.08] rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                    placeholder="general" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Question</label>
                <input type="text" value={newFaq.question} onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
                  className="w-full bg-black/30 border border-white/[0.08] rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                  placeholder="Min 10 characters" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Answer</label>
                <RichTextEditor content={newFaq.answer} onChange={(html) => setNewFaq({ ...newFaq, answer: html })} placeholder="Write your answer..." minHeight="160px" />
              </div>
            </div>
            <div className="p-4 bg-white/[0.02] border-t border-border-subtle flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors cursor-pointer">{ui.cancel}</button>
              <button onClick={() => createFaq.mutate({ ...newFaq, category: newFaq.category || undefined })} disabled={createFaq.isPending || newFaq.question.length < 10 || newFaq.answer.length < 20}
                className="px-6 py-2 text-sm font-medium text-white bg-brand rounded-xl hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer">{ui.create}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { if (deleteTarget) await deleteFaq.mutateAsync({ id: deleteTarget, reason: 'Deleted by admin' }); }}
        title={ui.delete}
        message={a.seoDeleteFaqMessage}
        confirmLabel={ui.delete}
        cancelLabel={ui.cancel}
        variant="danger"
      />

      {/* Edit FAQ Modal */}
      {editFaq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0a07]/85 backdrop-blur-xl p-4 animate-fade-in text-left">
          <div className="bg-[#1a1512]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl w-full max-w-2xl shadow-[0_0_60px_-12px_rgba(249,115,22,0.15),0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden animate-zoom-in">
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xl font-bold text-text-primary">{ui.edit} FAQ</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Question</label>
                <input type="text" value={editFaq.question} onChange={(e) => setEditFaq({ ...editFaq, question: e.target.value })}
                  className="w-full bg-black/30 border border-white/[0.08] rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Answer</label>
                <RichTextEditor content={editFaq.answer} onChange={(html) => setEditFaq({ ...editFaq, answer: html })} placeholder="Write your answer..." minHeight="160px" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Category</label>
                <input type="text" value={editFaq.category} onChange={(e) => setEditFaq({ ...editFaq, category: e.target.value })}
                  className="w-full bg-black/30 border border-white/[0.08] rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10" />
              </div>
            </div>
            <div className="p-4 bg-white/[0.02] border-t border-border-subtle flex justify-end gap-3">
              <button onClick={() => setEditFaq(null)} className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors cursor-pointer">{ui.cancel}</button>
              <button onClick={() => updateFaq.mutate({ id: editFaq.id, question: editFaq.question, answer: editFaq.answer, category: editFaq.category || undefined })}
                disabled={updateFaq.isPending || editFaq.question.length < 10 || editFaq.answer.length < 20}
                className="px-6 py-2 text-sm font-medium text-white bg-brand rounded-xl hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer">{ui.save}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ────────────────────────────────────────────────────────── */
/* REDIRECTS TAB                                              */
/* ────────────────────────────────────────────────────────── */
function RedirectsTab({ dict }: AdminSeoProps) {
  const a = dict.admin;
  const ui = dict.ui;
  const toast = useToast();

  const redirects = trpc.admin.seo.listRedirects.useQuery({ take: 50 });

  const [showCreate, setShowCreate] = useState(false);
  const [newRedirect, setNewRedirect] = useState({ sourcePath: '', destinationPath: '', isPermanent: true });

  const createRedirect = trpc.admin.seo.createRedirect.useMutation({
    onSuccess: () => { toast.success(ui.confirm); setShowCreate(false); redirects.refetch(); setNewRedirect({ sourcePath: '', destinationPath: '', isPermanent: true }); },
    onError: (e: any) => toast.error(e.message),
  });

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const deleteRedirect = trpc.admin.seo.deleteRedirect.useMutation({
    onSuccess: () => { toast.success(ui.confirm); setDeleteTarget(null); redirects.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const [editRedirect, setEditRedirect] = useState<{ id: string; sourcePath: string; destinationPath: string; isPermanent: boolean } | null>(null);
  const updateRedirect = trpc.admin.seo.updateRedirect.useMutation({
    onSuccess: () => { toast.success(ui.confirm); setEditRedirect(null); redirects.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const items = redirects.data ?? [];

  return (
    <>
      <div className="flex items-center justify-end mb-6">
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 bg-brand text-white rounded-xl font-bold flex items-center gap-2 hover:bg-brand-hover active:scale-[0.98] transition-all cursor-pointer text-sm">
          <Plus className="w-4 h-4" />{a.seoCreateRedirect}
        </button>
      </div>

      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden">
        {redirects.isLoading ? (
          <div className="p-6"><SkeletonTable rows={5} /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={<ArrowRightLeft className="w-6 h-6" />} title={ui.noResults} description="" />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            <div className="grid grid-cols-[2fr_2fr_1fr_auto] gap-4 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted/60">
              <span>Source</span><span>Destination</span><span>Type</span><span />
            </div>
            {items.map((r: any) => (
              <div key={r.id} className="grid grid-cols-[2fr_2fr_1fr_auto] gap-4 px-4 py-3 hover:bg-white/[0.02] transition-all items-center">
                <span className="text-xs font-mono text-brand truncate">{r.sourcePath}</span>
                <span className="text-xs font-mono text-text-secondary truncate">{r.destinationPath}</span>
                <span className="text-[10px] font-bold uppercase text-text-muted">{r.isPermanent ? '301' : '302'}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditRedirect({ id: r.id, sourcePath: r.sourcePath, destinationPath: r.destinationPath, isPermanent: r.isPermanent })}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted/40 hover:text-brand hover:bg-brand/10 transition-all cursor-pointer" title={ui.edit}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeleteTarget(r.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted/40 hover:text-danger hover:bg-danger/10 transition-all cursor-pointer" title={ui.delete}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Redirect Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0a07]/85 backdrop-blur-xl p-4 animate-fade-in text-left">
          <div className="bg-[#1a1512]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl w-full max-w-lg shadow-[0_0_60px_-12px_rgba(249,115,22,0.15),0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden animate-zoom-in">
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xl font-bold text-text-primary">{a.seoCreateRedirect}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Source Path</label>
                <input type="text" value={newRedirect.sourcePath} onChange={(e) => setNewRedirect({ ...newRedirect, sourcePath: e.target.value })}
                  className="w-full bg-black/30 border border-white/[0.08] rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 font-mono"
                  placeholder="/old-path" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Destination Path</label>
                <input type="text" value={newRedirect.destinationPath} onChange={(e) => setNewRedirect({ ...newRedirect, destinationPath: e.target.value })}
                  className="w-full bg-black/30 border border-white/[0.08] rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 font-mono"
                  placeholder="/new-path" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newRedirect.isPermanent} onChange={(e) => setNewRedirect({ ...newRedirect, isPermanent: e.target.checked })}
                  className="w-4 h-4 rounded border-border-subtle accent-brand" />
                <span className="text-sm text-text-secondary">Permanent (301)</span>
              </label>
            </div>
            <div className="p-4 bg-white/[0.02] border-t border-border-subtle flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors cursor-pointer">{ui.cancel}</button>
              <button onClick={() => createRedirect.mutate(newRedirect)} disabled={createRedirect.isPending || !newRedirect.sourcePath || !newRedirect.destinationPath}
                className="px-6 py-2 text-sm font-medium text-white bg-brand rounded-xl hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer">{ui.create}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { if (deleteTarget) await deleteRedirect.mutateAsync({ id: deleteTarget, reason: 'Deleted by admin' }); }}
        title={ui.delete}
        message={a.seoDeleteRedirectMessage}
        confirmLabel={ui.delete}
        cancelLabel={ui.cancel}
        variant="danger"
      />

      {/* Edit Redirect Modal */}
      {editRedirect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0a07]/85 backdrop-blur-xl p-4 animate-fade-in text-left">
          <div className="bg-[#1a1512]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl w-full max-w-lg shadow-[0_0_60px_-12px_rgba(249,115,22,0.15),0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden animate-zoom-in">
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xl font-bold text-text-primary">{ui.edit} Redirect</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Source Path</label>
                <input type="text" value={editRedirect.sourcePath} onChange={(e) => setEditRedirect({ ...editRedirect, sourcePath: e.target.value })}
                  className="w-full bg-black/30 border border-white/[0.08] rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Destination Path</label>
                <input type="text" value={editRedirect.destinationPath} onChange={(e) => setEditRedirect({ ...editRedirect, destinationPath: e.target.value })}
                  className="w-full bg-black/30 border border-white/[0.08] rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 font-mono" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editRedirect.isPermanent} onChange={(e) => setEditRedirect({ ...editRedirect, isPermanent: e.target.checked })}
                  className="w-4 h-4 rounded border-border-subtle accent-brand" />
                <span className="text-sm text-text-secondary">Permanent (301)</span>
              </label>
            </div>
            <div className="p-4 bg-white/[0.02] border-t border-border-subtle flex justify-end gap-3">
              <button onClick={() => setEditRedirect(null)} className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors cursor-pointer">{ui.cancel}</button>
              <button onClick={() => updateRedirect.mutate({ id: editRedirect.id, sourcePath: editRedirect.sourcePath, destinationPath: editRedirect.destinationPath, isPermanent: editRedirect.isPermanent })}
                disabled={updateRedirect.isPending || !editRedirect.sourcePath || !editRedirect.destinationPath}
                className="px-6 py-2 text-sm font-medium text-white bg-brand rounded-xl hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer">{ui.save}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ────────────────────────────────────────────────────────── */
/* ANSWERS TAB                                                */
/* ────────────────────────────────────────────────────────── */
function AnswersTab({ dict }: AdminSeoProps) {
  const a = dict.admin;
  const ui = dict.ui;
  const toast = useToast();

  const [locale, setLocale] = useState<'th' | 'en' | ''>('');

  const answers = trpc.admin.seo.listAnswers.useQuery({
    locale: locale ? (locale as 'th' | 'en') : undefined,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [newAnswer, setNewAnswer] = useState({ question: '', answerText: '', locale: 'th' as 'th' | 'en', intent: '' });

  const createAnswer = trpc.admin.seo.createAnswer.useMutation({
    onSuccess: () => { toast.success(ui.confirm); setShowCreate(false); answers.refetch(); setNewAnswer({ question: '', answerText: '', locale: 'th', intent: '' }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateAnswer = trpc.admin.seo.updateAnswer.useMutation({
    onSuccess: () => { toast.success(ui.confirm); setEditAnswer(null); answers.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const [editAnswer, setEditAnswer] = useState<{ id: string; question: string; answerText: string; intent: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const deleteAnswer = trpc.admin.seo.deleteAnswer.useMutation({
    onSuccess: () => { toast.success(ui.confirm); setDeleteTarget(null); answers.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const items = answers.data ?? [];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select value={locale} onChange={(e) => setLocale(e.target.value as any)}
          className="bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 transition-all">
          <option value="">All Locales</option>
          <option value="th">TH</option>
          <option value="en">EN</option>
        </select>
        <div className="flex-1" />
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 bg-brand text-white rounded-xl font-bold flex items-center gap-2 hover:bg-brand-hover active:scale-[0.98] transition-all cursor-pointer text-sm">
          <Plus className="w-4 h-4" />{a.seoCreateAnswer}
        </button>
      </div>

      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden">
        {answers.isLoading ? (
          <div className="p-6"><SkeletonTable rows={5} /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={<MessageSquareText className="w-6 h-6" />} title={ui.noResults} description="" />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {items.map((item: any) => (
              <div key={item.id} className="p-4 hover:bg-white/[0.02] transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary">{item.question}</p>
                    <p className="text-xs text-text-secondary mt-1 line-clamp-2">{item.answerText}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-text-muted uppercase font-mono">{item.locale}</span>
                      <StatusBadge status={item.status} />
                      {item.intent && <span className="text-[10px] text-brand bg-brand/10 px-2 py-0.5 rounded-md">{item.intent}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {item.status === 'draft' && (
                      <button onClick={() => updateAnswer.mutate({ id: item.id, status: 'published' })} disabled={updateAnswer.isPending}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted/40 hover:text-success hover:bg-success/10 transition-all cursor-pointer" title={a.seoPublish}>
                        <Upload className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => setEditAnswer({ id: item.id, question: item.question, answerText: item.answerText, intent: item.intent ?? '' })}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted/40 hover:text-brand hover:bg-brand/10 transition-all cursor-pointer" title={ui.edit}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteTarget(item.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted/40 hover:text-danger hover:bg-danger/10 transition-all cursor-pointer" title={ui.delete}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Answer Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0a07]/85 backdrop-blur-xl p-4 animate-fade-in text-left">
          <div className="bg-[#1a1512]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl w-full max-w-2xl shadow-[0_0_60px_-12px_rgba(249,115,22,0.15),0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden animate-zoom-in">
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xl font-bold text-text-primary">{a.seoCreateAnswer}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-2">Locale</label>
                  <select value={newAnswer.locale} onChange={(e) => setNewAnswer({ ...newAnswer, locale: e.target.value as any })}
                    className="w-full bg-black/30 border border-white/[0.08] rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40">
                    <option value="th">TH</option>
                    <option value="en">EN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-2">Intent</label>
                  <input type="text" value={newAnswer.intent} onChange={(e) => setNewAnswer({ ...newAnswer, intent: e.target.value })}
                    className="w-full bg-black/30 border border-white/[0.08] rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                    placeholder="informational" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Question</label>
                <input type="text" value={newAnswer.question} onChange={(e) => setNewAnswer({ ...newAnswer, question: e.target.value })}
                  className="w-full bg-black/30 border border-white/[0.08] rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                  placeholder="Min 10 characters" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Answer</label>
                <RichTextEditor content={newAnswer.answerText} onChange={(html) => setNewAnswer({ ...newAnswer, answerText: html })} placeholder="Write your answer..." minHeight="160px" />
              </div>
            </div>
            <div className="p-4 bg-white/[0.02] border-t border-border-subtle flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors cursor-pointer">{ui.cancel}</button>
              <button onClick={() => createAnswer.mutate({ ...newAnswer, intent: newAnswer.intent || undefined })} disabled={createAnswer.isPending || newAnswer.question.length < 10 || newAnswer.answerText.length < 20}
                className="px-6 py-2 text-sm font-medium text-white bg-brand rounded-xl hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer">{ui.create}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Answer Modal */}
      {editAnswer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0a07]/85 backdrop-blur-xl p-4 animate-fade-in text-left">
          <div className="bg-[#1a1512]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl w-full max-w-2xl shadow-[0_0_60px_-12px_rgba(249,115,22,0.15),0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden animate-zoom-in">
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xl font-bold text-text-primary">{ui.edit} Answer</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Question</label>
                <input type="text" value={editAnswer.question} onChange={(e) => setEditAnswer({ ...editAnswer, question: e.target.value })}
                  className="w-full bg-black/30 border border-white/[0.08] rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Answer</label>
                <RichTextEditor content={editAnswer.answerText} onChange={(html) => setEditAnswer({ ...editAnswer, answerText: html })} placeholder="Write your answer..." minHeight="160px" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Intent</label>
                <input type="text" value={editAnswer.intent} onChange={(e) => setEditAnswer({ ...editAnswer, intent: e.target.value })}
                  className="w-full bg-black/30 border border-white/[0.08] rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10" />
              </div>
            </div>
            <div className="p-4 bg-white/[0.02] border-t border-border-subtle flex justify-end gap-3">
              <button onClick={() => setEditAnswer(null)} className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors cursor-pointer">{ui.cancel}</button>
              <button onClick={() => updateAnswer.mutate({ id: editAnswer.id, question: editAnswer.question, answerText: editAnswer.answerText, intent: editAnswer.intent || undefined })}
                disabled={updateAnswer.isPending || editAnswer.question.length < 10 || editAnswer.answerText.length < 20}
                className="px-6 py-2 text-sm font-medium text-white bg-brand rounded-xl hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer">{ui.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Answer Confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { if (deleteTarget) await deleteAnswer.mutateAsync({ id: deleteTarget, reason: 'Deleted by admin' }); }}
        title={ui.delete}
        message="ลบคำตอบนี้?"
        confirmLabel={ui.delete}
        cancelLabel={ui.cancel}
        variant="danger"
      />
    </>
  );
}

/* ────────────────────────────────────────────────────────── */
/* MAIN COMPONENT                                             */
/* ────────────────────────────────────────────────────────── */
export function AdminSeoContent({ dict }: AdminSeoProps) {
  const a = dict.admin;
  const [activeTab, setActiveTab] = useState<Tab>('pages');

  return (
    <div>
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{a.seo}</h1>
        <p className="text-sm text-text-muted">{a.seoSubtitle}</p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-1.5 mb-6 animate-fade-in-up delay-1 inline-flex gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-brand/10 text-brand shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{a[tab.labelKey] ?? tab.key}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in-up delay-2">
        {activeTab === 'pages' && <PagesTab dict={dict} />}
        {activeTab === 'faq' && <FaqTab dict={dict} />}
        {activeTab === 'redirects' && <RedirectsTab dict={dict} />}
        {activeTab === 'answers' && <AnswersTab dict={dict} />}
      </div>
    </div>
  );
}
