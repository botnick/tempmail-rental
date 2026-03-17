'use client';

import { createPortal } from 'react-dom';
import { trpc } from '@/lib/trpc';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { Layers, Search, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Star, X, ChevronDown } from 'lucide-react';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/components/ui/Toast';

interface AdminPlansProps {
  dict: { admin: Record<string, string>; ui: Record<string, string> };
}

interface FeatureRow {
  featureKey: string;
  value: string;
  valueType: 'number' | 'boolean' | 'string' | 'json';
}

interface PricingRow {
  currency: string;
  amount: string;
  billingPeriod: 'monthly' | 'yearly' | 'one_time';
}

interface PlanForm {
  name: string;
  slug: string;
  description: string;
  status: string;
  isDefault: boolean;
  sortOrder: number;
  trialDays: number;
  features: FeatureRow[];
  pricing: PricingRow[];
}

const emptyForm: PlanForm = {
  name: '', slug: '', description: '', status: 'ACTIVE',
  isDefault: false, sortOrder: 0, trialDays: 0, features: [], pricing: [],
};

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'GRANDFATHERED', 'SCHEDULED'] as const;
const VALUE_TYPE_OPTIONS = ['number', 'boolean', 'string', 'json'] as const;
const BILLING_PERIOD_OPTIONS = ['monthly', 'yearly', 'one_time'] as const;

const inputClass = 'w-full rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none transition-all placeholder:text-text-muted/50';
const selectClass = 'rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none transition-all appearance-none cursor-pointer';
const labelClass = 'text-[11px] font-semibold uppercase tracking-wider mb-1.5 block';
const btnSecondary = 'px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] transition-all cursor-pointer';
const btnPrimary = 'px-4 py-2.5 text-sm font-bold text-white rounded-xl transition-all cursor-pointer disabled:opacity-50';

/** Shared inline styles for inputs/selects inside modals (guaranteed opaque) */
const solidInputStyle: React.CSSProperties = {
  backgroundColor: '#1e1a16',
  border: '1px solid rgba(139,115,85,0.25)',
  color: '#fef3e2',
};
const solidInputFocusStyle: React.CSSProperties = {
  ...solidInputStyle,
  borderColor: 'rgba(249,115,22,0.5)',
  boxShadow: '0 0 0 3px rgba(249,115,22,0.08)',
};
const solidSelectStyle: React.CSSProperties = {
  ...solidInputStyle,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b7355' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  paddingRight: 28,
};
const sectionCardStyle: React.CSSProperties = {
  backgroundColor: '#181411',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: 14,
  padding: '16px',
};

/* ─────────────── Combobox (Single-Select Auto-Suggest) ─────────────── */
interface ComboOption { value: string; label: string; sub?: string; icon?: string }

/**
 * Single-select combobox with instant client-side filtering.
 * Dropdown renders via createPortal → document.body for full opacity.
 */
function Combobox({
  value, options, onChange, placeholder, allowFreeText = true,
}: {
  value: string;
  options: ComboOption[];
  onChange: (val: string, meta?: ComboOption) => void;
  placeholder?: string;
  allowFreeText?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Calculate dropdown position from input
  const updatePosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Update position on scroll/resize
  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, updatePosition]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options;
    return options.filter(
      (o) => o.value.toLowerCase().includes(q) || o.label.toLowerCase().includes(q) || (o.sub?.toLowerCase().includes(q) ?? false)
    );
  }, [options, query]);

  const selectedMeta = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const handleSelect = (opt: ComboOption) => {
    onChange(opt.value, opt);
    setQuery('');
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setOpen(true);
    if (allowFreeText) {
      onChange(e.target.value);
    }
  };

  const handleFocus = () => {
    updatePosition();
    setOpen(true);
    setQuery('');
  };

  const displayValue = () => {
    if (open) return query;
    if (selectedMeta) return `${selectedMeta.icon ? selectedMeta.icon + ' ' : ''}${selectedMeta.label}`;
    return value;
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue()}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={(e) => Object.assign(e.currentTarget.style, solidInputStyle)}
          className={`${inputClass} text-xs pr-7`}
          style={solidInputStyle}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => { setOpen(!open); if (!open) { updatePosition(); inputRef.current?.focus(); } }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted/40 hover:text-text-muted transition-colors cursor-pointer"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && filtered.length > 0 && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: pos.width,
            maxHeight: 220,
            overflowY: 'auto',
            zIndex: 999999,
            backgroundColor: '#1a1512',
            border: '1px solid rgba(251, 146, 60, 0.25)',
            borderRadius: 12,
            boxShadow: '0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(251,146,60,0.06)',
            padding: '4px 0',
            fontFamily: 'inherit',
          }}
        >
          {filtered.slice(0, 20).map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  textAlign: 'left' as const,
                  padding: '8px 12px',
                  fontSize: 12,
                  cursor: 'pointer',
                  border: 'none',
                  outline: 'none',
                  backgroundColor: isSelected ? 'rgba(249,115,22,0.15)' : '#1a1512',
                  color: isSelected ? '#f97316' : '#fef3e2',
                  transition: 'background-color 0.1s',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = '#231d18';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = '#1a1512';
                }}
              >
                {isSelected && (
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%',
                    backgroundColor: 'rgba(249,115,22,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#f97316' }} />
                  </span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.label}
                  </span>
                  {opt.sub && (
                    <span style={{ fontSize: 10, opacity: 0.5, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {opt.sub}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          {filtered.length > 20 && (
            <div style={{
              padding: '6px 12px', fontSize: 10, textAlign: 'center',
              color: '#8b7355', borderTop: '1px solid rgba(251,146,60,0.1)',
            }}>
              +{filtered.length - 20} more — type to filter
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

/* ─────────────── Main Component ─────────────── */
export function AdminPlansContent({ dict }: AdminPlansProps) {
  const a = dict.admin;
  const ui = dict.ui;
  const toast = useToast();
  const utils = trpc.useUtils();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const debouncedSearch = useDebounce(search, 500);

  // Modal states
  const [editModal, setEditModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>({ ...emptyForm });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: '', name: '' });
  const [toggleModal, setToggleModal] = useState<{ open: boolean; id: string; name: string; newStatus: string }>({ open: false, id: '', name: '', newStatus: '' });

  // Fetch options (cached 5 min — instant auto-suggest)
  const optionsQuery = trpc.admin.featureFlag.listOptions.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Build combobox options from API — labels come from dictionary (i18n)
  const featureKeyOptions: ComboOption[] = useMemo(() =>
    (optionsQuery.data?.featureKeys ?? []).map((fk) => ({
      value: fk.key,
      label: a[`fk_${fk.key}`] || fk.key.replace(/_/g, ' '),
      sub: fk.key,
    })),
    [optionsQuery.data?.featureKeys, a]
  );

  const currencyOptions: ComboOption[] = useMemo(() =>
    (optionsQuery.data?.currencies ?? []).map((c) => ({
      value: c,
      label: c,
    })),
    [optionsQuery.data?.currencies]
  );

  // Helper: get valueType for a feature key from DB data
  const getDefaultType = useCallback((key: string): FeatureRow['valueType'] => {
    const meta = optionsQuery.data?.featureKeys?.find((fk) => fk.key === key);
    return (meta?.valueType as FeatureRow['valueType']) || 'number';
  }, [optionsQuery.data?.featureKeys]);

  // Helper: get label for a feature key from dictionary (for display in list)
  const getFeatureLabel = useCallback((key: string): string => {
    return a[`fk_${key}`] || key.replace(/_/g, ' ');
  }, [a]);

  // Queries
  const plans = trpc.admin.plan.list.useQuery({
    page, pageSize: 20,
    search: debouncedSearch || undefined,
    status: statusFilter as any,
  });

  // Mutations
  const createMut = trpc.admin.plan.create.useMutation({
    onSuccess: () => { toast.success(a.planCreateSuccess || 'Plan created'); utils.admin.plan.list.invalidate(); closeForm(); },
    onError: (err) => toast.error(err.message),
  });

  const updateMut = trpc.admin.plan.update.useMutation({
    onSuccess: () => { toast.success(a.planUpdateSuccess || 'Plan updated'); utils.admin.plan.list.invalidate(); closeForm(); },
    onError: (err) => toast.error(err.message),
  });

  const toggleMut = trpc.admin.plan.toggleStatus.useMutation({
    onSuccess: () => { toast.success(a.planStatusChanged || 'Status changed'); utils.admin.plan.list.invalidate(); setToggleModal({ open: false, id: '', name: '', newStatus: '' }); },
    onError: (err) => toast.error(err.message),
  });

  const deleteMut = trpc.admin.plan.delete.useMutation({
    onSuccess: () => { toast.success(a.planDeleteSuccess || 'Plan deleted'); utils.admin.plan.list.invalidate(); setDeleteModal({ open: false, id: '', name: '' }); },
    onError: (err) => toast.error(err.message),
  });

  const closeForm = useCallback(() => { setEditModal(false); setEditingId(null); setForm({ ...emptyForm }); }, []);
  const openCreate = useCallback(() => { setEditingId(null); setForm({ ...emptyForm }); setEditModal(true); }, []);

  const openEdit = useCallback((item: any) => {
    setEditingId(item.id);
    setForm({
      name: item.name, slug: item.slug, description: item.description || '',
      status: item.status, isDefault: item.isDefault, sortOrder: item.sortOrder, trialDays: item.trialDays,
      features: (item.features || []).map((f: any) => ({
        featureKey: f.featureKey, value: f.value,
        valueType: (f.valueType || 'number') as FeatureRow['valueType'],
      })),
      pricing: (item.pricing || []).map((p: any) => ({
        currency: p.currency, amount: String(p.amount), billingPeriod: p.billingPeriod,
      })),
    });
    setEditModal(true);
  }, []);

  const handleSubmit = useCallback(() => {
    const payload = {
      name: form.name, slug: form.slug, description: form.description || undefined,
      status: form.status as any, isDefault: form.isDefault, sortOrder: form.sortOrder,
      trialDays: form.trialDays, features: form.features, pricing: form.pricing,
    };
    if (editingId) {
      updateMut.mutate({ id: editingId, ...payload });
    } else {
      createMut.mutate(payload as any);
    }
  }, [form, editingId, createMut, updateMut]);

  const addFeature = () => setForm((prev) => ({ ...prev, features: [...prev.features, { featureKey: '', value: '', valueType: 'number' }] }));
  const removeFeature = (idx: number) => setForm((prev) => ({ ...prev, features: prev.features.filter((_, i) => i !== idx) }));
  const updateFeature = (idx: number, field: keyof FeatureRow, val: string) => {
    setForm((prev) => ({ ...prev, features: prev.features.map((f, i) => i === idx ? { ...f, [field]: val } : f) }));
  };

  const addPricing = () => setForm((prev) => ({ ...prev, pricing: [...prev.pricing, { currency: 'THB', amount: '0', billingPeriod: 'monthly' }] }));
  const removePricing = (idx: number) => setForm((prev) => ({ ...prev, pricing: prev.pricing.filter((_, i) => i !== idx) }));
  const updatePricing = (idx: number, field: keyof PricingRow, val: string) => {
    setForm((prev) => ({ ...prev, pricing: prev.pricing.map((p, i) => i === idx ? { ...p, [field]: val } : p) }));
  };

  const items = plans.data?.data ?? [];
  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div>
      {/* Header */}
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{a.plans}</h1>
        <p className="text-sm text-text-muted">{a.plansSubtitle}</p>
      </div>

      {/* Toolbar */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-4 mb-6 animate-fade-in-up delay-1">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/50" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className={`${inputClass} pl-9`}
              style={solidInputStyle}
              placeholder={ui.searchPlaceholder} />
          </div>
          <select value={statusFilter ?? ''} onChange={(e) => { setStatusFilter(e.target.value || undefined); setPage(1); }}
            className={selectClass}
            style={solidSelectStyle}>
            <option value="">{ui.all}</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="flex-1" />
          <button onClick={openCreate}
            className={`${btnPrimary} flex items-center gap-2`}
            style={{ background: 'linear-gradient(to right, #f97316, #fb923c)' }}>
            <Plus className="w-4 h-4" /> {a.planCreate || 'Create Plan'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden animate-fade-in-up delay-2">
        {plans.isLoading ? (
          <div className="p-6"><SkeletonTable rows={5} /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Layers className="w-6 h-6" />} title={ui.noResults} description="" />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted/60">
              <span>{a.planName || 'Plan'}</span>
              <span>{a.planPricing || 'Pricing'}</span>
              <span>Features</span>
              <span>{ui.status}</span>
              <span>{ui.actions}</span>
            </div>
            {items.map((item: any) => (
              <div key={item.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 hover:bg-white/[0.02] transition-all items-center">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                    {item.isDefault ? <Star className="w-4 h-4 text-yellow-400" /> : <Layers className="w-4 h-4 text-brand" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{item.name}</p>
                    <span className="text-[10px] text-text-muted font-mono truncate">{item.slug}</span>
                  </div>
                </div>
                <div className="text-xs text-text-secondary">
                  {item.pricing?.length > 0 ? item.pricing.map((p: any, i: number) => (
                    <div key={i} className="font-mono">{p.currency} {String(p.amount)} <span className="text-text-muted">/{p.billingPeriod}</span></div>
                  )) : <span className="text-text-muted">—</span>}
                </div>
                <div className="text-xs text-text-muted">
                  {item.features?.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {item.features.slice(0, 3).map((f: any, i: number) => (
                        <span key={i} className="inline-flex items-center bg-white/[0.06] text-[10px] px-1.5 py-0.5 rounded-md font-mono" title={`${f.featureKey} = ${f.value}`}>
                          {getFeatureLabel(f.featureKey).substring(0, 2)} {f.featureKey.replace(/_/g, ' ').substring(0, 8)}…
                        </span>
                      ))}
                      {item.features.length > 3 && (
                        <span className="text-[10px] text-text-muted">+{item.features.length - 3}</span>
                      )}
                    </div>
                  ) : <span className="font-mono">0 features</span>}
                </div>
                <StatusBadge status={item.status} />
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-text-muted hover:text-brand transition-all cursor-pointer" title={ui.edit}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setToggleModal({
                    open: true, id: item.id, name: item.name,
                    newStatus: item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                  })} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-text-muted hover:text-yellow-400 transition-all cursor-pointer"
                    title={item.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}>
                    {item.status === 'ACTIVE' ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => setDeleteModal({ open: true, id: item.id, name: item.name })}
                    className="p-1.5 rounded-lg hover:bg-white/[0.06] text-text-muted hover:text-red-400 transition-all cursor-pointer" title={ui.delete}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {(plans.data?.total ?? 0) > 20 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={btnSecondary}>{ui.prev}</button>
          <span className="text-xs text-text-muted">{ui.page} {page} {ui.of} {plans.data?.totalPages ?? 1}</span>
          <button disabled={page >= (plans.data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)} className={btnSecondary}>{ui.next}</button>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={editModal} onClose={closeForm} title={editingId ? (a.planEdit || 'Edit Plan') : (a.planCreate || 'Create Plan')} maxWidth="max-w-2xl">
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Basic Info Section */}
          <div style={sectionCardStyle}>
            <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8b7355', marginBottom: 14 }}>📝 Basic Info</h4>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className={labelClass} style={{ color: '#a89070' }}>{a.planName || 'Name'}</label>
                <input className={inputClass} style={solidInputStyle} value={form.name}
                  onFocus={(e) => Object.assign(e.currentTarget.style, solidInputFocusStyle)}
                  onBlur={(e) => Object.assign(e.currentTarget.style, solidInputStyle)}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Pro" />
              </div>
              <div>
                <label className={labelClass} style={{ color: '#a89070' }}>{a.planSlug || 'Slug'}</label>
                <input className={`${inputClass} font-mono`} style={solidInputStyle} value={form.slug}
                  onFocus={(e) => Object.assign(e.currentTarget.style, solidInputFocusStyle)}
                  onBlur={(e) => Object.assign(e.currentTarget.style, solidInputStyle)}
                  onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  placeholder="e.g. pro" />
              </div>
            </div>
            <div>
              <label className={labelClass} style={{ color: '#a89070' }}>{a.planDescription || 'Description'}</label>
              <input className={inputClass} style={solidInputStyle} value={form.description}
                onFocus={(e) => Object.assign(e.currentTarget.style, solidInputFocusStyle)}
                onBlur={(e) => Object.assign(e.currentTarget.style, solidInputStyle)}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Short description..." />
            </div>
          </div>

          {/* Settings Section */}
          <div style={sectionCardStyle}>
            <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8b7355', marginBottom: 14 }}>⚙️ Settings</h4>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className={labelClass} style={{ color: '#a89070' }}>{ui.status}</label>
                <select className={`${selectClass} w-full`} style={solidSelectStyle} value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} style={{ color: '#a89070' }}>{a.planSortOrder || 'Sort Order'}</label>
                <input type="number" className={inputClass} style={solidInputStyle} value={form.sortOrder}
                  onFocus={(e) => Object.assign(e.currentTarget.style, solidInputFocusStyle)}
                  onBlur={(e) => Object.assign(e.currentTarget.style, solidInputStyle)}
                  onChange={(e) => setForm((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className={labelClass} style={{ color: '#a89070' }}>{a.planTrialDays || 'Trial Days'}</label>
                <input type="number" className={inputClass} style={solidInputStyle} value={form.trialDays}
                  onFocus={(e) => Object.assign(e.currentTarget.style, solidInputFocusStyle)}
                  onBlur={(e) => Object.assign(e.currentTarget.style, solidInputStyle)}
                  onChange={(e) => setForm((p) => ({ ...p, trialDays: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer group" style={{ padding: '8px 12px', borderRadius: 10, backgroundColor: form.isDefault ? 'rgba(249,115,22,0.08)' : '#1e1a16', border: `1px solid ${form.isDefault ? 'rgba(249,115,22,0.3)' : 'rgba(139,115,85,0.25)'}`, transition: 'all 0.2s' }}>
                  <div style={{ width: 36, height: 20, borderRadius: 10, backgroundColor: form.isDefault ? '#f97316' : '#2a241f', transition: 'all 0.2s', position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: '#fff', position: 'absolute', top: 2, left: form.isDefault ? 18 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                  </div>
                  <input type="checkbox" checked={form.isDefault}
                    onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))}
                    className="sr-only" />
                  <span style={{ fontSize: 12, color: form.isDefault ? '#f97316' : '#a89070', fontWeight: 500 }}>{a.planIsDefault || 'แผนเริ่มต้น'}</span>
                </label>
              </div>
            </div>
          </div>

          {/* ─────────── Features Section (with Auto-Suggest) ─────────── */}
          {/* Features Section */}
          <div style={sectionCardStyle}>
            <div className="flex items-center justify-between mb-3">
              <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8b7355' }}>🧩 {a.planFeatures || 'Features'}</h4>
              <button type="button" onClick={addFeature} className={`${btnSecondary} flex items-center gap-1`}>
                <Plus className="w-3 h-3" /> {a.planAddFeature || 'Add Feature'}
              </button>
            </div>
            {form.features.length === 0 ? (
              <p className="text-xs italic py-2" style={{ color: '#6b5d4d' }}>{a.planNoFeatures || 'No features added — click "Add Feature" to start'}</p>
            ) : (
              <div className="space-y-2">
                {form.features.map((f, idx) => (
                  <div key={idx} style={{ backgroundColor: '#1e1a16', border: '1px solid rgba(139,115,85,0.15)', borderRadius: 12, padding: 12 }} className="animate-fade-in-up">
                    <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-start">
                      {/* Feature Key — Auto-suggest Combobox */}
                      <div>
                        <label className="text-[10px] font-medium mb-1 block" style={{ color: '#6b5d4d' }}>Feature Key</label>
                        <Combobox
                          value={f.featureKey}
                          options={featureKeyOptions}
                          placeholder={a.planFeatureKeyPlaceholder || 'Select or type feature key...'}
                          onChange={(val, meta) => {
                            setForm((prev) => ({
                              ...prev,
                              features: prev.features.map((feat, i) => {
                                if (i !== idx) return feat;
                                const newType = meta?.sub
                                  ? (getDefaultType(val) || feat.valueType)
                                  : feat.valueType;
                                // Auto-reset value if switching to boolean
                                const newValue = newType === 'boolean' && feat.valueType !== 'boolean'
                                  ? 'false'
                                  : feat.value;
                                return { ...feat, featureKey: val, valueType: newType, value: newValue };
                              }),
                            }));
                          }}
                        />
                        {/* Show label if key is selected */}
                        {f.featureKey && featureKeyOptions.find((o) => o.value === f.featureKey) && (
                          <p className="text-[10px] text-brand/60 mt-0.5 flex items-center gap-1">
                            {featureKeyOptions.find((o) => o.value === f.featureKey)?.icon}{' '}
                            {featureKeyOptions.find((o) => o.value === f.featureKey)?.label}
                          </p>
                        )}
                      </div>

                      {/* Value — Smart: boolean = select, others = input */}
                      <div>
                        <label className="text-[10px] font-medium mb-1 block" style={{ color: '#6b5d4d' }}>Value</label>
                        {f.valueType === 'boolean' ? (
                          <select
                            className={`${selectClass} w-full text-xs`}
                            style={solidSelectStyle}
                            value={f.value}
                            onChange={(e) => updateFeature(idx, 'value', e.target.value)}
                          >
                            <option value="true">✅ true</option>
                            <option value="false">❌ false</option>
                          </select>
                        ) : (
                          <input
                            className={`${inputClass} text-xs`}
                            style={solidInputStyle}
                            placeholder={f.valueType === 'number' ? 'e.g. 50' : 'Value...'}
                            type={f.valueType === 'number' ? 'number' : 'text'}
                            value={f.value}
                            min={f.valueType === 'number' ? 0 : undefined}
                            onChange={(e) => updateFeature(idx, 'value', e.target.value)}
                          />
                        )}
                      </div>

                      {/* Value Type */}
                      <div>
                        <label className="text-[10px] font-medium mb-1 block" style={{ color: '#6b5d4d' }}>Type</label>
                        <select className={`${selectClass} text-xs`} style={solidSelectStyle} value={f.valueType}
                          onChange={(e) => {
                            const newType = e.target.value as FeatureRow['valueType'];
                            const newValue = newType === 'boolean' ? 'false' : f.value;
                            setForm((prev) => ({
                              ...prev,
                              features: prev.features.map((feat, i) =>
                                i === idx ? { ...feat, valueType: newType, value: newValue } : feat
                              ),
                            }));
                          }}>
                          {VALUE_TYPE_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>

                      {/* Remove */}
                      <div className="pt-5">
                        <button type="button" onClick={() => removeFeature(idx)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-all cursor-pointer">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─────────── Pricing Section (with Currency Auto-Suggest) ─────────── */}
          {/* Pricing Section */}
          <div style={sectionCardStyle}>
            <div className="flex items-center justify-between mb-3">
              <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8b7355' }}>💰 {a.planPricing || 'Pricing'}</h4>
              <button type="button" onClick={addPricing} className={`${btnSecondary} flex items-center gap-1`}>
                <Plus className="w-3 h-3" /> {a.planAddPricing || 'Add Pricing'}
              </button>
            </div>
            {form.pricing.length === 0 ? (
              <p className="text-xs italic py-2" style={{ color: '#6b5d4d' }}>{a.planNoPricing || 'No pricing added (free plan)'}</p>
            ) : (
              <div className="space-y-2">
                {form.pricing.map((p, idx) => (
                  <div key={idx} style={{ backgroundColor: '#1e1a16', border: '1px solid rgba(139,115,85,0.15)', borderRadius: 12, padding: 12 }} className="animate-fade-in-up">
                    <div className="grid grid-cols-[100px_1fr_1fr_auto] gap-2 items-start">
                      {/* Currency — Auto-suggest */}
                      <div>
                        <label className="text-[10px] font-medium mb-1 block" style={{ color: '#6b5d4d' }}>Currency</label>
                        <Combobox
                          value={p.currency}
                          options={currencyOptions}
                          placeholder="THB"
                          onChange={(val) => updatePricing(idx, 'currency', val.toUpperCase())}
                        />
                      </div>

                      {/* Amount */}
                      <div>
                        <label className="text-[10px] font-medium mb-1 block" style={{ color: '#6b5d4d' }}>Amount</label>
                        <input type="number" step="0.01" min="0" className={`${inputClass} text-xs font-mono`}
                          style={solidInputStyle}
                          placeholder="0.00"
                          value={p.amount} onChange={(e) => updatePricing(idx, 'amount', e.target.value)} />
                      </div>

                      {/* Billing Period */}
                      <div>
                        <label className="text-[10px] font-medium mb-1 block" style={{ color: '#6b5d4d' }}>Period</label>
                        <select className={`${selectClass} w-full text-xs`} style={solidSelectStyle} value={p.billingPeriod}
                          onChange={(e) => updatePricing(idx, 'billingPeriod', e.target.value)}>
                          {BILLING_PERIOD_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>

                      {/* Remove */}
                      <div className="pt-5">
                        <button type="button" onClick={() => removePricing(idx)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-all cursor-pointer">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-white/[0.04]">
          <button type="button" onClick={closeForm} disabled={isSaving}
            className="flex-1 py-3 text-sm font-semibold text-text-secondary bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-white/[0.07] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50">
            {ui.cancel}
          </button>
          <button type="button" onClick={handleSubmit} disabled={isSaving || !form.name || !form.slug}
            className={`flex-1 py-3 ${btnPrimary}`}
            style={{ background: 'linear-gradient(to right, #f97316, #fb923c)', boxShadow: '0 8px 24px -4px rgba(249,115,22,0.35)' }}>
            {isSaving ? (a.loading || 'Saving...') : editingId ? (ui.save) : (ui.create)}
          </button>
        </div>
      </Modal>

      {/* Toggle Status Modal */}
      <ConfirmModal
        open={toggleModal.open}
        onClose={() => setToggleModal({ open: false, id: '', name: '', newStatus: '' })}
        onConfirm={async () => { await toggleMut.mutateAsync({ id: toggleModal.id, status: toggleModal.newStatus as any }); }}
        title={toggleModal.newStatus === 'ACTIVE' ? (a.activate || 'Activate') : (a.planDeactivate || 'Deactivate')}
        message={`${a.planToggleMessage || 'Change status of'} "${toggleModal.name}" → ${toggleModal.newStatus}`}
        confirmLabel={ui.confirm}
        cancelLabel={ui.cancel}
        variant="warning"
      />

      {/* Delete Modal */}
      <ConfirmModal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, id: '', name: '' })}
        onConfirm={async () => { await deleteMut.mutateAsync({ id: deleteModal.id }); }}
        title={a.planDeleteTitle || 'Delete Plan'}
        message={`${a.planDeleteMessage || 'Are you sure you want to delete'} "${deleteModal.name}"?`}
        confirmLabel={ui.delete}
        cancelLabel={ui.cancel}
        variant="danger"
      />
    </div>
  );
}
