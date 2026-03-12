'use client';

import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/Toast';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Users, Search, ShieldOff, CheckCircle, LogOut, Coins, MoreVertical, UserCog } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { formatDate } from '@/lib/dayjs';
import { useDebounce } from '@/hooks/useDebounce';
import { ROLE_OPTIONS } from '@/config/ui';

interface AdminUsersProps {
  dict: { admin: Record<string, string>; ui: Record<string, string> };
}

export function AdminUsersContent({ dict }: AdminUsersProps) {
  const a = dict.admin;
  const ui = dict.ui;
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [confirmAction, setConfirmAction] = useState<{ userId: string; action: 'suspend' } | null>(null);

  const users = trpc.admin.user.list.useQuery({
    page,
    pageSize: 20,
    search: debouncedSearch || undefined,
    status: statusFilter as any,
  });

  const suspendUser = trpc.admin.user.suspend.useMutation({
    onSuccess: () => { toast.success(a.suspend); setConfirmAction(null); users.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const unsuspendUser = trpc.admin.user.unsuspend.useMutation({
    onSuccess: () => { toast.success(a.activate); users.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const forceLogout = trpc.admin.user.forceLogout.useMutation({
    onSuccess: () => { toast.success(a.forceLogout); setForceLogoutTarget(null); users.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const grantCredits = trpc.admin.user.grantCredits.useMutation({
    onSuccess: () => { toast.success(a.grantCredits); setCreditsTarget(null); setCreditAmount(''); users.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const assignRole = trpc.admin.user.assignRole.useMutation({
    onSuccess: () => { toast.success(a.assignRole); setRoleTarget(null); setSelectedRole(''); setRoleReason(''); users.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [forceLogoutTarget, setForceLogoutTarget] = useState<string | null>(null);
  const [creditsTarget, setCreditsTarget] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [roleTarget, setRoleTarget] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [roleReason, setRoleReason] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const items = users.data?.data ?? [];

  return (
    <div>
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{a.users}</h1>
        <p className="text-sm text-text-muted">{a.usersSubtitle}</p>
      </div>

      {/* Filters */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-4 mb-6 animate-fade-in-up delay-1">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/50" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 pl-9 pr-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50"
              placeholder={ui.searchPlaceholder} />
          </div>
          <select value={statusFilter ?? ''} onChange={(e) => { setStatusFilter(e.target.value || undefined); setPage(1); }}
            className="bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 transition-all">
            <option value="">{ui.all}</option>
            <option value="ACTIVE">{ui.active}</option>
            <option value="SUSPENDED">{ui.suspended}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden animate-fade-in-up delay-2">
        {users.isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Users className="w-6 h-6" />} title={ui.noResults} description="" />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted/60">
              <span>User</span>
              <span>{a.role}</span>
              <span>{a.plan}</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {items.map((user: any) => (
              <div key={user.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 hover:bg-white/[0.02] transition-all items-center">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-brand" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{user.displayName ?? user.email}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-text-muted font-mono">{user.email}</span>
                      <span className="text-[10px] text-text-muted">{a.joined}: {formatDate(user.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {user.roles?.map((r: any) => (
                    <span key={r.name} className="text-[10px] bg-brand/10 text-brand px-1.5 py-0.5 rounded-md font-medium">{r.displayName ?? r.name}</span>
                  )) ?? <span className="text-[10px] text-text-muted">—</span>}
                </div>
                <span className="text-xs text-text-secondary">{user.plan?.name ?? '—'}</span>
                <StatusBadge status={user.status} />
                <div className="relative" ref={openMenu === user.id ? menuRef : undefined}>
                  <button onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted/40 hover:text-text-primary hover:bg-white/[0.06] transition-all cursor-pointer">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {openMenu === user.id && (
                    <div className="absolute right-0 top-8 z-20 bg-elevated border border-border-subtle rounded-xl shadow-2xl py-1 w-48 animate-fade-in">
                      {user.status === 'ACTIVE' && (
                        <button onClick={() => { setConfirmAction({ userId: user.id, action: 'suspend' }); setOpenMenu(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-white/[0.04] hover:text-warning transition-all cursor-pointer">
                          <ShieldOff className="w-3.5 h-3.5" />{a.suspend}
                        </button>
                      )}
                      {user.status === 'SUSPENDED' && (
                        <button onClick={() => { unsuspendUser.mutate({ userId: user.id, reason: 'Admin unsuspend' }); setOpenMenu(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-white/[0.04] hover:text-success transition-all cursor-pointer">
                          <CheckCircle className="w-3.5 h-3.5" />{a.activate}
                        </button>
                      )}
                      <button onClick={() => { setCreditsTarget(user.id); setOpenMenu(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-white/[0.04] hover:text-brand transition-all cursor-pointer">
                        <Coins className="w-3.5 h-3.5" />{a.grantCredits}
                      </button>
                      <button onClick={() => { setForceLogoutTarget(user.id); setOpenMenu(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-white/[0.04] hover:text-danger transition-all cursor-pointer">
                        <LogOut className="w-3.5 h-3.5" />{a.forceLogout}
                      </button>
                      <div className="h-px bg-border-subtle mx-2 my-1" />
                      <button onClick={() => { setRoleTarget(user.id); setOpenMenu(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-white/[0.04] hover:text-brand transition-all cursor-pointer">
                        <UserCog className="w-3.5 h-3.5" />{a.assignRole}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {(users.data?.total ?? 0) > 20 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.prev}</button>
          <span className="text-xs text-text-muted">{ui.page} {page} {ui.of} {users.data?.totalPages ?? 1}</span>
          <button disabled={page >= (users.data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.next}</button>
        </div>
      )}

      {/* Confirm Suspend */}
      <ConfirmModal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={async () => {
          if (!confirmAction) return;
          await suspendUser.mutateAsync({ userId: confirmAction.userId, reason: 'Suspended by admin' });
        }}
        title={a.suspendTitle}
        message={a.suspendMessage}
        confirmLabel={a.suspend}
        cancelLabel={ui.cancel}
        variant="warning"
      />

      {/* Force Logout Confirm */}
      <ConfirmModal
        open={!!forceLogoutTarget}
        onClose={() => setForceLogoutTarget(null)}
        onConfirm={async () => {
          if (forceLogoutTarget) await forceLogout.mutateAsync({ userId: forceLogoutTarget, reason: 'Admin forced logout' });
        }}
        title={a.forceLogoutTitle}
        message={a.forceLogoutMessage}
        confirmLabel={a.forceLogout}
        cancelLabel={ui.cancel}
        variant="danger"
      />

      {/* Grant Credits Modal */}
      {creditsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in text-left">
          <div className="bg-elevated border border-border-subtle rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-zoom-in">
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xl font-bold text-text-primary">{a.grantCreditsTitle}</h2>
              <p className="text-sm text-text-muted mt-1">{a.grantCreditsMessage}</p>
            </div>
            <div className="p-6">
              <label className="block text-xs font-medium text-text-muted mb-2">Amount</label>
              <input type="number" min="1" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)}
                className="w-full bg-surface border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                placeholder="100" />
            </div>
            <div className="p-4 bg-white/[0.02] border-t border-border-subtle flex justify-end gap-3">
              <button onClick={() => { setCreditsTarget(null); setCreditAmount(''); }} className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors cursor-pointer">{ui.cancel}</button>
              <button onClick={() => grantCredits.mutate({ userId: creditsTarget, amount: Number(creditAmount), reason: 'Admin credit grant' })}
                disabled={grantCredits.isPending || !creditAmount || Number(creditAmount) <= 0}
                className="px-6 py-2 text-sm font-medium text-white bg-brand rounded-xl hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer">{ui.confirm}</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Role Modal */}
      {roleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in text-left">
          <div className="bg-elevated border border-border-subtle rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-zoom-in">
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xl font-bold text-text-primary">{a.assignRole}</h2>
              <p className="text-sm text-text-muted mt-1">Select a role to assign to this user</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Role</label>
                <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full bg-surface border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10">
                  <option value="">Select role...</option>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">{a.reasonForChange}</label>
                <input type="text" value={roleReason} onChange={(e) => setRoleReason(e.target.value)}
                  className="w-full bg-surface border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                  placeholder="e.g. Promoting to admin" />
              </div>
            </div>
            <div className="p-4 bg-white/[0.02] border-t border-border-subtle flex justify-end gap-3">
              <button onClick={() => { setRoleTarget(null); setSelectedRole(''); setRoleReason(''); }}
                className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors cursor-pointer">{ui.cancel}</button>
              <button onClick={() => assignRole.mutate({ userId: roleTarget, roleName: selectedRole, reason: roleReason })}
                disabled={assignRole.isPending || !selectedRole || roleReason.length < 5}
                className="px-6 py-2 text-sm font-medium text-white bg-brand rounded-xl hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer">{ui.confirm}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
