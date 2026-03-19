'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Flag, Search, Plus, Pencil, Trash2, Users, Shield, CreditCard, Info, X, ChevronDown } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

/* ─────────────── Types ─────────────── */
interface AdminFeatureFlagsProps {
  dict: { admin: Record<string, string>; ui: Record<string, string> };
}

interface FlagForm {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPct: number;
  targetRoles: string[];
  targetPlans: string[];
  targetUsers: string[];
}

const emptyForm: FlagForm = {
  key: '', name: '', description: '', enabled: false, rolloutPct: 0,
  targetRoles: [], targetPlans: [], targetUsers: [],
};

/* ─────────────── Tag Input (Auto-Suggest) ─────────────── */
interface TagOption {
  value: string;
  label: string;
  sub?: string;
}

interface TagInputProps {
  selected: string[];
  options: TagOption[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}

/**
 * Reusable auto-suggestion tag picker.
 * - Client-side filtered — instant, zero lag
 * - Click-to-select from dropdown
 * - Type to filter
 * - Remove with × button
 */
function TagInput({ selected, options, onChange, placeholder, icon }: TagInputProps) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Filter options (client-side — instant)
  const filtered = useMemo(() => {
    const q = input.toLowerCase().trim();
    return options.filter(
      (o) => !selected.includes(o.value) &&
      (o.value.toLowerCase().includes(q) || o.label.toLowerCase().includes(q) || (o.sub?.toLowerCase().includes(q) ?? false))
    );
  }, [options, selected, input]);

  const addTag = useCallback((value: string) => {
    if (!selected.includes(value)) {
      onChange([...selected, value]);
    }
    setInput('');
    inputRef.current?.focus();
  }, [selected, onChange]);

  const removeTag = useCallback((value: string) => {
    onChange(selected.filter((v) => v !== value));
  }, [selected, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && input === '' && selected.length > 0) {
      removeTag(selected[selected.length - 1]);
    }
    if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault();
      addTag(filtered[0].value);
    }
    if (e.key === 'Escape') {
      setOpen(false);
    }
  }, [input, selected, filtered, addTag, removeTag]);

  const getLabelForValue = (val: string): string => {
    return options.find((o) => o.value === val)?.label ?? val;
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex flex-wrap items-center gap-1.5 bg-surface border border-border-subtle rounded-xl text-sm py-2 px-3 focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/10 transition-all min-h-[40px] cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {icon && <span className="text-text-muted/50 mr-0.5 shrink-0">{icon}</span>}
        {selected.map((val) => (
          <span
            key={val}
            className="inline-flex items-center gap-1 bg-brand/10 text-brand text-xs font-medium px-2 py-0.5 rounded-lg animate-fade-in-up"
          >
            {getLabelForValue(val)}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(val); }}
              className="hover:bg-brand/20 rounded-full p-0.5 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-[80px] bg-transparent text-text-primary text-sm outline-none placeholder:text-text-muted/40"
          placeholder={selected.length === 0 ? placeholder : ''}
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="shrink-0 text-text-muted/40 hover:text-text-muted transition-colors cursor-pointer"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Dropdown */}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface border border-border-subtle rounded-xl shadow-xl shadow-black/20 max-h-48 overflow-y-auto animate-fade-in-up py-1">
          {filtered.slice(0, 30).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { addTag(opt.value); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-brand/5 transition-colors flex items-center gap-2 text-sm cursor-pointer"
            >
              <span className="text-text-primary font-medium">{opt.label}</span>
              {opt.sub && <span className="text-text-muted text-xs truncate">({opt.sub})</span>}
            </button>
          ))}
          {filtered.length > 30 && (
            <div className="px-3 py-1.5 text-[10px] text-text-muted text-center border-t border-border-subtle/50">
              +{filtered.length - 30} more — type to filter
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Main Component ─────────────── */
export function AdminFeatureFlagsContent({ dict }: AdminFeatureFlagsProps) {
  const a = dict.admin;
  const ui = dict.ui;
  const toast = useToast();
  const utils = trpc.useUtils();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FlagForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; key: string } | null>(null);

  // Fetch options for auto-suggestions (cached, instant)
  const optionsQuery = trpc.admin.featureFlag.listOptions.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  // Build TagOption arrays from API data
  const planOptions: TagOption[] = useMemo(() =>
    (optionsQuery.data?.plans ?? []).map((p) => ({
      value: p.slug,
      label: p.name,
      sub: p.slug,
    })),
    [optionsQuery.data?.plans]
  );

  const roleOptions: TagOption[] = useMemo(() =>
    (optionsQuery.data?.roles ?? []).map((r) => ({
      value: r.name,
      label: r.displayName,
      sub: r.name,
    })),
    [optionsQuery.data?.roles]
  );

  const userOptions: TagOption[] = useMemo(() =>
    (optionsQuery.data?.users ?? []).map((u) => ({
      value: u.id,
      label: u.displayName || u.email,
      sub: u.email,
    })),
    [optionsQuery.data?.users]
  );

  const flags = trpc.admin.featureFlag.list.useQuery({
    page,
    pageSize: 20,
    search: debouncedSearch || undefined,
  });

  const createMut = trpc.admin.featureFlag.create.useMutation({
    onSuccess: () => {
      toast.success(a.ffCreateSuccess || 'Feature flag created');
      closeModal();
      utils.admin.featureFlag.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMut = trpc.admin.featureFlag.update.useMutation({
    onSuccess: () => {
      toast.success(a.ffUpdateSuccess || 'Feature flag updated');
      closeModal();
      utils.admin.featureFlag.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMut = trpc.admin.featureFlag.delete.useMutation({
    onSuccess: () => {
      toast.success(a.ffDeleteSuccess || 'Feature flag deleted');
      setDeleteTarget(null);
      utils.admin.featureFlag.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleMut = trpc.admin.featureFlag.update.useMutation({
    onSuccess: () => {
      toast.success(a.ffStatusChanged || 'Status changed');
      utils.admin.featureFlag.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const items = flags.data?.data ?? [];

  const closeModal = () => {
    setShowModal(false);
    setEditId(null);
    setForm(emptyForm);
  };

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (flag: any) => {
    setEditId(flag.id);
    setForm({
      key: flag.key,
      name: flag.name,
      description: flag.description || '',
      enabled: flag.enabled,
      rolloutPct: flag.rolloutPct,
      targetRoles: Array.isArray(flag.targetRoles) ? flag.targetRoles : [],
      targetPlans: Array.isArray(flag.targetPlans) ? flag.targetPlans : [],
      targetUsers: Array.isArray(flag.targetUsers) ? flag.targetUsers : [],
    });
    setShowModal(true);
  };

  const handleSubmit = () => {
    const targeting = {
      ...(form.targetRoles.length > 0 ? { targetRoles: form.targetRoles } : {}),
      ...(form.targetPlans.length > 0 ? { targetPlans: form.targetPlans } : {}),
      ...(form.targetUsers.length > 0 ? { targetUsers: form.targetUsers } : {}),
    };

    if (editId) {
      updateMut.mutate({
        id: editId,
        name: form.name,
        description: form.description || undefined,
        enabled: form.enabled,
        rolloutPct: form.rolloutPct,
        reason: `Updated feature flag: ${form.key}`,
        ...targeting,
      });
    } else {
      createMut.mutate({
        key: form.key,
        name: form.name,
        description: form.description || undefined,
        enabled: form.enabled,
        rolloutPct: form.rolloutPct,
        ...targeting,
      });
    }
  };

  const renderBadges = (flag: any) => {
    const badges: React.ReactNode[] = [];
    if (Array.isArray(flag.targetRoles) && flag.targetRoles.length > 0) {
      badges.push(
        <span key="roles" className="inline-flex items-center gap-1 text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded-md font-medium">
          <Shield className="w-3 h-3" />{flag.targetRoles.join(', ')}
        </span>
      );
    }
    if (Array.isArray(flag.targetPlans) && flag.targetPlans.length > 0) {
      badges.push(
        <span key="plans" className="inline-flex items-center gap-1 text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-md font-medium">
          <CreditCard className="w-3 h-3" />{flag.targetPlans.join(', ')}
        </span>
      );
    }
    if (Array.isArray(flag.targetUsers) && flag.targetUsers.length > 0) {
      badges.push(
        <span key="users" className="inline-flex items-center gap-1 text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded-md font-medium">
          <Users className="w-3 h-3" />{flag.targetUsers.length} {a.ffUsers || 'users'}
        </span>
      );
    }
    return badges;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 animate-fade-in-up">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{a.featureFlags}</h1>
          <p className="text-sm text-text-muted">{a.featureFlagsSubtitle}</p>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2.5 bg-brand text-white rounded-xl font-bold flex items-center gap-2 hover:bg-brand-hover active:scale-[0.98] transition-all cursor-pointer text-sm">
          <Plus className="w-4 h-4" />{a.createFlag}
        </button>
      </div>

      {/* Search */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-4 mb-6 animate-fade-in-up delay-1">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/50" />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 pl-9 pr-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50"
            placeholder={ui.searchPlaceholder} />
        </div>
      </div>

      {/* Info card */}
      <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 mb-6 flex items-start gap-3 animate-fade-in-up delay-1">
        <Info className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-300/80 leading-relaxed">
          <p className="font-semibold text-blue-300 mb-1">{a.ffInfoTitle || 'Feature Flags Info'}</p>
          <p>{a.ffInfoDesc || 'Feature flags allow you to toggle features for specific roles, plans, or users. Changes take effect immediately.'}</p>
        </div>
      </div>

      {/* Flag List */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden animate-fade-in-up delay-2">
        {flags.isLoading ? (
          <div className="p-6"><SkeletonTable rows={5} /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Flag className="w-6 h-6" />} title={ui.noResults} description="" />
        ) : (
          <div className="divide-y divide-white/[0.04] overflow-x-auto">
            {items.map((flag: any) => (
              <div key={flag.id} className="p-4 hover:bg-white/[0.02] transition-all group">
                <div className="flex items-start justify-between gap-4">
                  {/* Left — info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="text-sm font-semibold text-text-primary">{flag.name}</p>
                      <span className="text-[10px] font-mono bg-white/[0.06] text-text-muted px-1.5 py-0.5 rounded-md">{flag.key}</span>
                      {flag.rolloutPct > 0 && flag.rolloutPct < 100 && (
                        <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-md font-bold">
                          {flag.rolloutPct}% {a.ffRollout || 'rollout'}
                        </span>
                      )}
                      {flag.rolloutPct === 100 && flag.enabled && (
                        <span className="text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded-md font-bold">100%</span>
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted mb-2">{flag.description || ''}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {renderBadges(flag)}
                    </div>
                  </div>

                  {/* Right — actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => openEdit(flag)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                      title={a.ffEdit || 'Edit'}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ id: flag.id, key: flag.key })}
                      className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                      title={a.ffDelete || 'Delete'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleMut.mutate({
                        id: flag.id,
                        enabled: !flag.enabled,
                        reason: `Toggled ${flag.key} to ${!flag.enabled ? 'enabled' : 'disabled'}`,
                      })}
                      disabled={toggleMut.isPending}
                      className={`relative w-11 h-6 rounded-full transition-all duration-200 cursor-pointer ${flag.enabled ? 'bg-success' : 'bg-white/[0.08]'}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${flag.enabled ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {(flags.data?.total ?? 0) > 20 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.prev}</button>
          <span className="text-xs text-text-muted">{ui.page} {page} {ui.of} {Math.ceil((flags.data?.total ?? 0) / 20)}</span>
          <button disabled={page >= Math.ceil((flags.data?.total ?? 0) / 20)} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.next}</button>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={closeModal} title={editId ? (a.ffEditTitle || 'Edit Feature Flag') : (a.createFlagTitle || 'Create Feature Flag')}>
        <div className="space-y-4">
          {/* Key (read-only for edit) */}
          <div className={editId ? 'opacity-75' : ''}>
            <label className="block text-xs font-medium text-text-muted mb-2">{a.ffKey || 'Key'}</label>
            <input type="text" value={form.key}
              onChange={(e) => !editId && setForm({ ...form, key: e.target.value })}
              readOnly={!!editId}
              className="w-full bg-surface border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 font-mono"
              placeholder="feature.my_flag" />
            <p className="text-[10px] text-text-muted/60 mt-1">{a.ffKeyHint || 'Lowercase letters, numbers, dots, hyphens only'}</p>
          </div>
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-2">{a.ffName || 'Name'}</label>
            <input type="text" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-surface border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
              placeholder={a.ffNamePlaceholder || 'My New Feature'} />
          </div>
          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-2">{a.ffDescription || 'Description'}</label>
            <textarea value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full bg-surface border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 resize-none"
              placeholder={a.ffDescPlaceholder || 'What does this flag control?'} />
          </div>
          {/* Rollout + Enabled */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-2">
                {a.ffRollout || 'Rollout'}: <span className="text-brand font-bold">{form.rolloutPct}%</span>
              </label>
              <input type="range" min="0" max="100" value={form.rolloutPct}
                onChange={(e) => setForm({ ...form, rolloutPct: Number(e.target.value) })}
                className="w-full accent-brand" />
              <div className="flex justify-between text-[10px] text-text-muted/50 mt-1">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-border-subtle accent-brand" />
                <div>
                  <span className="text-sm text-text-primary font-medium">{a.ffEnabled || 'Enabled'}</span>
                  <p className="text-[10px] text-text-muted">{a.ffEnabledHint || 'Toggle to activate this flag'}</p>
                </div>
              </label>
            </div>
          </div>

          {/* Targeting — auto-suggestion tag pickers */}
          <div className="border-t border-border-subtle pt-4 mt-2">
            <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted/60 mb-3">{a.ffTargeting || 'Targeting (optional)'}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  <Shield className="w-3 h-3 inline mr-1" />{a.ffTargetRoles || 'Target Roles'}
                </label>
                <TagInput
                  selected={form.targetRoles}
                  options={roleOptions}
                  onChange={(v) => setForm({ ...form, targetRoles: v })}
                  placeholder={a.ffTargetRolesPlaceholder || 'Select roles...'}
                  icon={<Shield className="w-3.5 h-3.5" />}
                />
                <p className="text-[10px] text-text-muted/50 mt-0.5">{a.ffTargetRolesHint || 'Select role names from the list'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  <CreditCard className="w-3 h-3 inline mr-1" />{a.ffTargetPlans || 'Target Plans'}
                </label>
                <TagInput
                  selected={form.targetPlans}
                  options={planOptions}
                  onChange={(v) => setForm({ ...form, targetPlans: v })}
                  placeholder={a.ffTargetPlansPlaceholder || 'Select plans...'}
                  icon={<CreditCard className="w-3.5 h-3.5" />}
                />
                <p className="text-[10px] text-text-muted/50 mt-0.5">{a.ffTargetPlansHint || 'Select plan slugs from the list'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  <Users className="w-3 h-3 inline mr-1" />{a.ffTargetUsers || 'Target Users'}
                </label>
                <TagInput
                  selected={form.targetUsers}
                  options={userOptions}
                  onChange={(v) => setForm({ ...form, targetUsers: v })}
                  placeholder={a.ffTargetUsersPlaceholder || 'Select users...'}
                  icon={<Users className="w-3.5 h-3.5" />}
                />
                <p className="text-[10px] text-text-muted/50 mt-0.5">{a.ffTargetUsersHint || 'Select users by email or name'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border-subtle">
          <button onClick={closeModal}
            className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors cursor-pointer">
            {ui.cancel}
          </button>
          <button onClick={handleSubmit}
            disabled={createMut.isPending || updateMut.isPending || form.key.length < 2 || form.name.length < 2}
            className="px-6 py-2 text-sm font-medium text-white bg-brand rounded-xl hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer">
            {editId ? (ui.save || 'Save') : (ui.create || 'Create')}
          </button>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteMut.mutateAsync({ id: deleteTarget.id, reason: `Deleted feature flag: ${deleteTarget.key}` });
          }
        }}
        title={a.ffDeleteTitle || 'Delete Feature Flag'}
        message={`${a.ffDeleteMessage || 'Are you sure you want to delete'} "${deleteTarget?.key}"?`}
        confirmLabel={ui.delete || 'Delete'}
        cancelLabel={ui.cancel || 'Cancel'}
        variant="danger"
      />
    </div>
  );
}
