'use client';

import { trpc } from '@/lib/trpc';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Shield, Search, Users, Key, UserPlus, X, Check, ChevronDown, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { formatDate } from '@/lib/dayjs';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/components/ui/Toast';

interface AdminRbacProps {
  dict: { admin: Record<string, string>; ui: Record<string, string> };
}

type Tab = 'roles' | 'permissions' | 'userRoles';

export function AdminRbacContent({ dict }: AdminRbacProps) {
  const a = dict.admin;
  const ui = dict.ui;
  const [tab, setTab] = useState<Tab>('roles');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'roles', label: a.rbacRoles, icon: <Shield className="w-4 h-4" /> },
    { key: 'permissions', label: a.rbacPermissions, icon: <Key className="w-4 h-4" /> },
    { key: 'userRoles', label: a.rbacUserRoles, icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <div>
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{a.rbac}</h1>
        <p className="text-sm text-text-muted">{a.rbacSubtitle}</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-1 mb-6 animate-fade-in-up delay-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              tab === t.key
                ? 'bg-brand/10 text-brand border border-brand/20'
                : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.03]'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'roles' && <RolesTab a={a} ui={ui} selectedRoleId={selectedRoleId} onSelectRole={setSelectedRoleId} />}
      {tab === 'permissions' && <PermissionsTab a={a} ui={ui} />}
      {tab === 'userRoles' && <UserRolesTab a={a} ui={ui} />}
    </div>
  );
}

/* ──────────────────── ROLES TAB ──────────────────── */

function RolesTab({
  a, ui, selectedRoleId, onSelectRole,
}: {
  a: Record<string, string>;
  ui: Record<string, string>;
  selectedRoleId: string | null;
  onSelectRole: (id: string | null) => void;
}) {
  const toast = useToast();
  const roles = trpc.admin.rbac.listRoles.useQuery();
  const roleDetail = trpc.admin.rbac.getRoleDetail.useQuery(
    { roleId: selectedRoleId! },
    { enabled: !!selectedRoleId },
  );
  const allPerms = trpc.admin.rbac.listPermissions.useQuery(undefined, {
    enabled: !!selectedRoleId,
  });
  const utils = trpc.useUtils();

  const [editMode, setEditMode] = useState(false);
  const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');

  // CRUD modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [crudName, setCrudName] = useState('');
  const [crudDisplayName, setCrudDisplayName] = useState('');
  const [crudDescription, setCrudDescription] = useState('');
  const [crudReason, setCrudReason] = useState('');

  const updatePermsMutation = trpc.admin.rbac.updateRolePermissions.useMutation({
    onSuccess: () => {
      toast.success(a.rbacUpdateSuccess);
      setEditMode(false);
      setReason('');
      utils.admin.rbac.getRoleDetail.invalidate();
      utils.admin.rbac.listRoles.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const createRoleMutation = trpc.admin.rbac.createRole.useMutation({
    onSuccess: (data) => {
      toast.success(a.rbacCreateSuccess);
      resetCrudModal();
      utils.admin.rbac.listRoles.invalidate();
      if (data.roleId) onSelectRole(data.roleId);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateRoleMutation = trpc.admin.rbac.updateRole.useMutation({
    onSuccess: () => {
      toast.success(a.rbacEditSuccess);
      resetCrudModal();
      utils.admin.rbac.getRoleDetail.invalidate();
      utils.admin.rbac.listRoles.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteRoleMutation = trpc.admin.rbac.deleteRole.useMutation({
    onSuccess: () => {
      toast.success(a.rbacDeleteSuccess);
      resetCrudModal();
      onSelectRole(null);
      utils.admin.rbac.listRoles.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const resetCrudModal = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setCrudName('');
    setCrudDisplayName('');
    setCrudDescription('');
    setCrudReason('');
  };

  const handleOpenEdit = () => {
    if (!roleDetail.data) return;
    setCrudDisplayName(roleDetail.data.displayName || '');
    setCrudDescription(roleDetail.data.description || '');
    setShowEditModal(true);
  };

  // When roleDetail loads, sync selectedPermIds
  const currentPermIds = useMemo(() => {
    if (!roleDetail.data) return new Set<string>();
    return new Set(roleDetail.data.permissions.map((p) => p.id));
  }, [roleDetail.data]);

  const handleStartEdit = () => {
    setSelectedPermIds(new Set(currentPermIds));
    setEditMode(true);
  };

  const handleSavePerms = () => {
    if (!selectedRoleId || !reason.trim()) return;
    updatePermsMutation.mutate({
      roleId: selectedRoleId,
      permissionIds: Array.from(selectedPermIds),
      reason: reason.trim(),
    });
  };

  const togglePerm = (id: string) => {
    setSelectedPermIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllInModule = (perms: any[], checked: boolean) => {
    setSelectedPermIds((prev) => {
      const next = new Set(prev);
      for (const p of perms) {
        if (checked) next.add(p.id);
        else next.delete(p.id);
      }
      return next;
    });
  };

  const changedCount = useMemo(() => {
    if (!editMode) return 0;
    const added = [...selectedPermIds].filter((id) => !currentPermIds.has(id)).length;
    const removed = [...currentPermIds].filter((id) => !selectedPermIds.has(id)).length;
    return added + removed;
  }, [editMode, selectedPermIds, currentPermIds]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-6 animate-fade-in-up delay-2">
      {/* Roles list */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
          <h2 className="text-sm font-bold text-text-primary">{a.rbacRoles}</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-brand border border-brand/20 rounded-lg hover:bg-brand/5 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {a.rbacCreateRole}
          </button>
        </div>
        {roles.isLoading ? (
          <div className="p-4"><SkeletonTable rows={6} /></div>
        ) : (
          <div className="divide-y divide-white/[0.04] overflow-x-auto">
            {roles.data?.map((role) => (
              <button
                key={role.id}
                onClick={() => onSelectRole(role.id)}
                className={`w-full text-left px-4 py-3 transition-all cursor-pointer ${
                  selectedRoleId === role.id
                    ? 'bg-brand/5 border-l-2 border-l-brand'
                    : 'hover:bg-white/[0.02] border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-text-primary">{role.displayName || role.name}</div>
                    <div className="text-[10px] text-text-muted/60 font-mono">{role.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-text-muted">
                      {role.permissionCount} {a.rbacPermissions?.toLowerCase()} · {role.userCount} {a.rbacUserCount?.toLowerCase()}
                    </div>
                    {role.isSystem && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 rounded-full font-mono">
                        {a.rbacSystem}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Role detail panel (view mode only) */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden">
        {!selectedRoleId ? (
          <EmptyState
            icon={<Shield className="w-6 h-6" />}
            title={a.rbacSelectRole}
            description=""
          />
        ) : roleDetail.isLoading ? (
          <div className="p-4"><SkeletonTable rows={8} /></div>
        ) : (
          <div>
            <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-text-primary">
                  {roleDetail.data?.displayName || roleDetail.data?.name}
                </h2>
                <div className="text-[10px] text-text-muted/60">
                  {roleDetail.data?.permissions.length} {a.rbacPermissions?.toLowerCase()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenEdit}
                  className="p-1.5 text-text-muted hover:text-brand transition-colors cursor-pointer" title={a.rbacEditRole}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {!roleDetail.data?.isSystem && (
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="p-1.5 text-text-muted hover:text-red-400 transition-colors cursor-pointer" title={a.rbacDeleteRole}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={handleStartEdit}
                  className="px-3 py-1.5 text-xs font-medium text-brand border border-brand/20 rounded-lg hover:bg-brand/5 transition-all cursor-pointer"
                >
                  {a.rbacEditPermissions}
                </button>
              </div>
            </div>

            <div className="max-h-[500px] overflow-y-auto divide-y divide-white/[0.04]">
              {roleDetail.data?.permissions.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <div className="flex-1">
                    <div className="text-xs text-text-primary">{p.displayName}</div>
                    <div className="text-[10px] text-text-muted/50 font-mono">{p.key}</div>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 bg-brand/5 text-brand/70 rounded-full font-mono">
                    {p.module}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Full-screen permissions editor modal — rendered via portal to escape backdrop-filter containing block */}
      {editMode && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0d0e12] animate-fade-in" style={{ overflow: 'hidden' }}>
          {/* Modal header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-bg-card/80 backdrop-blur-xl flex-shrink-0">
            <div className="flex items-center gap-4">
              <Shield className="w-5 h-5 text-brand" />
              <div>
                <h2 className="text-lg font-bold text-text-primary">
                  {a.rbacEditPermissions} — {roleDetail.data?.displayName || roleDetail.data?.name}
                </h2>
                <div className="text-xs text-text-muted">
                  {selectedPermIds.size} {a.rbacPermissions?.toLowerCase()} · {changedCount > 0 && (
                    <span className="text-amber-400">{changedCount} {a.rbacChanges || 'changes'}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setEditMode(false); setReason(''); }}
                className="px-4 py-2 text-sm font-medium text-text-muted border border-border-subtle rounded-xl hover:bg-white/[0.04] transition-all cursor-pointer"
              >
                {ui.cancel}
              </button>
              <button
                onClick={handleSavePerms}
                disabled={updatePermsMutation.isPending || !reason.trim() || changedCount === 0}
                className="px-5 py-2 text-sm font-semibold text-white bg-brand rounded-xl hover:bg-brand/90 disabled:opacity-40 transition-all cursor-pointer flex items-center gap-2"
              >
                {updatePermsMutation.isPending && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {ui.save}
              </button>
            </div>
          </div>

          {/* Reason input — sticky below header */}
          <div className="px-6 py-3 border-b border-border-subtle bg-bg-card/60 flex-shrink-0">
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={a.rbacReasonPlaceholder || 'Reason for changes...'}
              className="w-full max-w-lg bg-white/[0.04] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50"
            />
            {!reason.trim() && (
              <p className="text-[10px] text-amber-400/80 mt-1">{a.rbacReasonRequired || 'Please provide a reason to save'}</p>
            )}
          </div>

          {/* Scrollable permissions grid */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {allPerms.data && Object.entries(allPerms.data.grouped).map(([mod, perms]) => {
                const items = perms as any[];
                const allChecked = items.every((p) => selectedPermIds.has(p.id));
                const noneChecked = items.every((p) => !selectedPermIds.has(p.id));
                return (
                  <div key={mod} className="bg-white/[0.025] border border-border-subtle rounded-xl overflow-hidden">
                    {/* Module header with select-all */}
                    <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.04] flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted/70">{mod}</span>
                      <button
                        onClick={() => toggleAllInModule(items, !allChecked)}
                        className="text-[10px] text-brand/70 hover:text-brand transition-colors cursor-pointer"
                      >
                        {allChecked ? (a.rbacDeselectAll || 'Deselect All') : (a.rbacSelectAll || 'Select All')}
                      </button>
                    </div>
                    {/* Permissions list */}
                    <div className="divide-y divide-white/[0.03]">
                      {items.map((p: any) => {
                        const isSelected = selectedPermIds.has(p.id);
                        const wasOriginal = currentPermIds.has(p.id);
                        const changed = isSelected !== wasOriginal;
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center gap-3 px-4 py-2.5 transition-all cursor-pointer ${
                              changed ? 'bg-amber-500/[0.03]' : 'hover:bg-white/[0.02]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => togglePerm(p.id)}
                              className="w-4 h-4 rounded bg-white/[0.05] border-border-subtle accent-brand flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-text-primary">{p.displayName}</div>
                              <div className="text-[10px] text-text-muted/50 font-mono truncate">{p.key}</div>
                            </div>
                            {changed && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                                isSelected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                              }`}>
                                {isSelected ? '+' : '−'}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Create Role Modal */}
      {showCreateModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1a1b20] border border-border-subtle rounded-2xl w-full max-w-md p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-text-primary">{a.rbacCreateRole}</h3>
              <button onClick={resetCrudModal} className="text-text-muted hover:text-text-primary cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">{a.rbacRoleName}</label>
                <input type="text" value={crudName} onChange={(e) => setCrudName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))} className="w-full bg-white/[0.04] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50 font-mono" placeholder="CUSTOM_ROLE" />
                <p className="text-[10px] text-text-muted/60 mt-1">{a.rbacNameFormat}</p>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">{a.rbacDisplayName}</label>
                <input type="text" value={crudDisplayName} onChange={(e) => setCrudDisplayName(e.target.value)} className="w-full bg-white/[0.04] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50" placeholder="Custom Role" />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">{a.rbacDescription}</label>
                <input type="text" value={crudDescription} onChange={(e) => setCrudDescription(e.target.value)} className="w-full bg-white/[0.04] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50" />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">{a.rbacReason}</label>
                <input type="text" value={crudReason} onChange={(e) => setCrudReason(e.target.value)} className="w-full bg-white/[0.04] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50" placeholder={a.rbacReasonPlaceholder} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={resetCrudModal} className="px-4 py-2 text-sm text-text-muted border border-border-subtle rounded-xl hover:bg-white/[0.04] transition-all cursor-pointer">{ui.cancel}</button>
              <button
                onClick={() => { if (crudName.length >= 2 && crudDisplayName.length >= 2 && crudReason.trim()) createRoleMutation.mutate({ name: crudName, displayName: crudDisplayName, description: crudDescription || undefined, reason: crudReason.trim() }); }}
                disabled={createRoleMutation.isPending || crudName.length < 2 || crudDisplayName.length < 2 || !crudReason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-xl hover:bg-brand/90 disabled:opacity-40 transition-all cursor-pointer flex items-center gap-2"
              >
                {createRoleMutation.isPending && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {a.rbacCreateRole}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Edit Role Modal */}
      {showEditModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1a1b20] border border-border-subtle rounded-2xl w-full max-w-md p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-text-primary">{a.rbacEditRole}</h3>
              <button onClick={resetCrudModal} className="text-text-muted hover:text-text-primary cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">{a.rbacRoleName}</label>
                <div className="text-sm text-text-muted/60 font-mono bg-white/[0.02] border border-border-subtle rounded-xl py-2.5 px-4">
                  {roleDetail.data?.name}
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">{a.rbacDisplayName}</label>
                <input type="text" value={crudDisplayName} onChange={(e) => setCrudDisplayName(e.target.value)} className="w-full bg-white/[0.04] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50" />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">{a.rbacDescription}</label>
                <input type="text" value={crudDescription} onChange={(e) => setCrudDescription(e.target.value)} className="w-full bg-white/[0.04] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50" />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">{a.rbacReason}</label>
                <input type="text" value={crudReason} onChange={(e) => setCrudReason(e.target.value)} className="w-full bg-white/[0.04] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50" placeholder={a.rbacReasonPlaceholder} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={resetCrudModal} className="px-4 py-2 text-sm text-text-muted border border-border-subtle rounded-xl hover:bg-white/[0.04] transition-all cursor-pointer">{ui.cancel}</button>
              <button
                onClick={() => { if (selectedRoleId && crudDisplayName.length >= 2 && crudReason.trim()) updateRoleMutation.mutate({ roleId: selectedRoleId, displayName: crudDisplayName, description: crudDescription || undefined, reason: crudReason.trim() }); }}
                disabled={updateRoleMutation.isPending || crudDisplayName.length < 2 || !crudReason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-xl hover:bg-brand/90 disabled:opacity-40 transition-all cursor-pointer flex items-center gap-2"
              >
                {updateRoleMutation.isPending && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {ui.save}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Delete Role Confirmation */}
      {showDeleteModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1a1b20] border border-border-subtle rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-scale-in">
            <h3 className="text-lg font-bold text-text-primary mb-2">{a.rbacDeleteTitle}</h3>
            <p className="text-sm text-text-muted mb-1">
              {a.rbacDeleteWarning}
            </p>
            <p className="text-sm font-semibold text-red-400 mb-4">
              {roleDetail.data?.displayName || roleDetail.data?.name}
            </p>
            <input
              type="text"
              value={crudReason}
              onChange={(e) => setCrudReason(e.target.value)}
              placeholder={a.rbacReasonPlaceholder}
              className="w-full bg-white/[0.04] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-4 outline-none focus:border-brand/40 transition-all placeholder:text-text-muted/50 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={resetCrudModal} className="px-4 py-2 text-sm text-text-muted border border-border-subtle rounded-xl hover:bg-white/[0.04] transition-all cursor-pointer">{ui.cancel}</button>
              <button
                onClick={() => { if (selectedRoleId && crudReason.trim()) deleteRoleMutation.mutate({ roleId: selectedRoleId, reason: crudReason.trim() }); }}
                disabled={deleteRoleMutation.isPending || !crudReason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-40 transition-all cursor-pointer flex items-center gap-2"
              >
                {deleteRoleMutation.isPending && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {a.rbacDeleteRole}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ──────────────── PERMISSIONS TAB ──────────────── */

function PermissionsTab({ a, ui }: { a: Record<string, string>; ui: Record<string, string> }) {
  const perms = trpc.admin.rbac.listPermissions.useQuery();
  const [search, setSearch] = useState('');
  const toast = useToast();
  const utils = trpc.useUtils();

  const syncMutation = trpc.admin.rbac.syncPermissions.useMutation({
    onSuccess: (data) => {
      const msg = (a.rbacSyncSuccess || 'Synced! Created: {created}, Updated: {updated}, Assigned: {assigned}')
        .replace('{created}', String(data.created))
        .replace('{updated}', String(data.updated))
        .replace('{assigned}', String(data.assigned));
      toast.success(msg);
      utils.admin.rbac.listPermissions.invalidate();
      utils.admin.rbac.listRoles.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const filtered = useMemo(() => {
    if (!perms.data || !search.trim()) return perms.data?.grouped ?? {};
    const q = search.toLowerCase();
    const result: Record<string, any[]> = {};
    for (const [mod, items] of Object.entries(perms.data.grouped)) {
      const matched = (items as any[]).filter(
        (p: any) => p.key.toLowerCase().includes(q) || p.displayName.toLowerCase().includes(q),
      );
      if (matched.length) result[mod] = matched;
    }
    return result;
  }, [perms.data, search]);

  return (
    <div className="animate-fade-in-up delay-2">
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-4 mb-6 flex items-center gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 pl-9 pr-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50"
            placeholder={`${a.rbacPermissionKey}...`}
          />
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-brand rounded-xl hover:bg-brand/90 disabled:opacity-50 transition-all cursor-pointer ml-auto"
          title={a.rbacSyncDescription}
        >
          {syncMutation.isPending ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {syncMutation.isPending ? (a.rbacSyncing || 'Syncing...') : (a.rbacSyncPermissions || 'Sync Permissions')}
        </button>
      </div>

      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden">
        {perms.isLoading ? (
          <div className="p-6"><SkeletonTable rows={10} /></div>
        ) : Object.keys(filtered).length === 0 ? (
          <EmptyState icon={<Key className="w-6 h-6" />} title={ui.noResults} description="" />
        ) : (
          <div className="divide-y divide-white/[0.04] overflow-x-auto">
            {Object.entries(filtered).map(([mod, items]) => (
              <div key={mod}>
                <div className="px-4 py-2.5 bg-white/[0.02] flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted/60">{mod}</span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-brand/5 text-brand/60 rounded-full">
                    {(items as any[]).length}
                  </span>
                </div>
                {(items as any[]).map((p: any) => (
                  <div key={p.id} className="flex items-center gap-4 px-4 py-2 hover:bg-white/[0.02] transition-all">
                    <Key className="w-3.5 h-3.5 text-text-muted/40" />
                    <div className="flex-1">
                      <div className="text-xs text-text-primary">{p.displayName}</div>
                      <div className="text-[10px] text-text-muted/50 font-mono">{p.key}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────── USER ROLES TAB ──────────────── */

function UserRolesTab({ a, ui }: { a: Record<string, string>; ui: Record<string, string> }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [assignModal, setAssignModal] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{ userRoleId: string; roleName: string } | null>(null);
  const [reason, setReason] = useState('');

  // Fetch users + roles for assignment
  const userRoles = trpc.admin.rbac.listUserRoles.useQuery({
    page,
    pageSize: 20,
    search: debouncedSearch || undefined,
  });
  const toast = useToast();
  const allRoles = trpc.admin.rbac.listRoles.useQuery();
  const utils = trpc.useUtils();

  // Assign state
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRoleId, setAssignRoleId] = useState('');
  const [assignReason, setAssignReason] = useState('');

  const assignMutation = trpc.admin.rbac.assignRole.useMutation({
    onSuccess: () => {
      toast.success(a.rbacAssignSuccess);
      setAssignModal(false);
      setAssignUserId('');
      setAssignRoleId('');
      setAssignReason('');
      utils.admin.rbac.listUserRoles.invalidate();
      utils.admin.rbac.listRoles.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const revokeMutation = trpc.admin.rbac.revokeRole.useMutation({
    onSuccess: () => {
      toast.success(a.rbacRevokeSuccess);
      setRevokeTarget(null);
      setReason('');
      utils.admin.rbac.listUserRoles.invalidate();
      utils.admin.rbac.listRoles.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const users = userRoles.data?.users ?? [];

  return (
    <div className="animate-fade-in-up delay-2">
      {/* Search + Assign button */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-4 mb-6 flex items-center gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 pl-9 pr-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50"
            placeholder={ui.searchPlaceholder}
          />
        </div>
        <button
          onClick={() => setAssignModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-brand rounded-xl hover:bg-brand/90 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          {a.rbacAssignRole}
        </button>
      </div>

      {/* User Roles table */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden">
        {userRoles.isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : users.length === 0 ? (
          <EmptyState icon={<Users className="w-6 h-6" />} title={ui.noResults} description="" />
        ) : (
          <div className="divide-y divide-white/[0.04] overflow-x-auto">
            <div className="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-4 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted/60">
              <span>{a.users}</span>
              <span>{a.rbacRoles}</span>
              <span>{a.rbacGrantedAt}</span>
              <span>{ui.actions}</span>
            </div>
            {users.map((user: any) => (
              <div key={user.id} className="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-4 px-4 py-3 hover:bg-white/[0.02] transition-all items-center">
                <div>
                  <div className="text-sm text-text-primary">{user.displayName || user.email}</div>
                  <div className="text-[10px] text-text-muted/50">{user.email}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {user.roles.length === 0 ? (
                    <span className="text-[10px] text-text-muted/40 italic">{a.rbacNoRoles}</span>
                  ) : (
                    user.roles.map((r: any) => (
                      <span
                        key={r.userRoleId}
                        className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-brand/5 text-brand/80 rounded-full font-medium"
                      >
                        {r.roleDisplayName || r.roleName}
                        <button
                          onClick={() => setRevokeTarget({ userRoleId: r.userRoleId, roleName: r.roleDisplayName || r.roleName })}
                          className="hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <div className="text-[10px] text-text-muted">
                  {user.roles[0]?.grantedAt ? formatDate(user.roles[0].grantedAt) : '—'}
                </div>
                <button
                  onClick={() => { setAssignUserId(user.id); setAssignModal(true); }}
                  className="text-xs text-brand hover:text-brand/80 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {(userRoles.data?.total ?? 0) > 20 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.prev}</button>
          <span className="text-xs text-text-muted">{ui.page} {page} {ui.of} {userRoles.data?.totalPages ?? 1}</span>
          <button disabled={page >= (userRoles.data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.next}</button>
        </div>
      )}

      {/* Assign Role Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-card border border-border-subtle rounded-2xl w-full max-w-md p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-text-primary">{a.rbacAssignRole}</h3>
              <button onClick={() => { setAssignModal(false); setAssignUserId(''); }} className="text-text-muted hover:text-text-primary cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User ID (pre-filled or manual) */}
            <div className="mb-3">
              <label className="block text-xs text-text-muted mb-1">{a.rbacSelectUser} (ID)</label>
              <input
                type="text"
                value={assignUserId}
                onChange={(e) => setAssignUserId(e.target.value)}
                className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-2 px-3 outline-none focus:border-brand/40 transition-all placeholder:text-text-muted/50"
                placeholder="User ID"
              />
            </div>

            {/* Role selector */}
            <div className="mb-3">
              <label className="block text-xs text-text-muted mb-1">{a.rbacSelectRole}</label>
              <select
                value={assignRoleId}
                onChange={(e) => setAssignRoleId(e.target.value)}
                className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-2 px-3 outline-none focus:border-brand/40 transition-all cursor-pointer"
              >
                <option value="">{a.rbacSelectRole}...</option>
                {allRoles.data?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.displayName || r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Reason */}
            <div className="mb-4">
              <label className="block text-xs text-text-muted mb-1">{a.rbacReason}</label>
              <input
                type="text"
                value={assignReason}
                onChange={(e) => setAssignReason(e.target.value)}
                className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-2 px-3 outline-none focus:border-brand/40 transition-all placeholder:text-text-muted/50"
                placeholder={a.rbacReasonPlaceholder}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setAssignModal(false); setAssignUserId(''); }}
                className="px-4 py-2 text-sm text-text-muted border border-border-subtle rounded-xl hover:bg-white/[0.04] transition-all cursor-pointer"
              >
                {ui.cancel}
              </button>
              <button
                onClick={() => {
                  if (!assignUserId || !assignRoleId || !assignReason.trim()) return;
                  assignMutation.mutate({
                    userId: assignUserId,
                    roleId: assignRoleId,
                    reason: assignReason.trim(),
                  });
                }}
                disabled={assignMutation.isPending || !assignUserId || !assignRoleId || !assignReason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-xl hover:bg-brand/90 disabled:opacity-40 transition-all cursor-pointer"
              >
                {a.rbacAssignRole}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke confirmation */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-card border border-border-subtle rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-scale-in">
            <h3 className="text-lg font-bold text-text-primary mb-2">{a.rbacRevokeTitle}</h3>
            <p className="text-sm text-text-muted mb-4">
              {a.rbacRevokeMessage} <span className="font-semibold text-red-400">({revokeTarget.roleName})</span>
            </p>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={a.rbacReasonPlaceholder}
              className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-2 px-3 outline-none focus:border-brand/40 transition-all placeholder:text-text-muted/50 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setRevokeTarget(null); setReason(''); }}
                className="px-4 py-2 text-sm text-text-muted border border-border-subtle rounded-xl hover:bg-white/[0.04] transition-all cursor-pointer"
              >
                {ui.cancel}
              </button>
              <button
                onClick={() => {
                  if (!reason.trim()) return;
                  revokeMutation.mutate({
                    userRoleId: revokeTarget.userRoleId,
                    reason: reason.trim(),
                  });
                }}
                disabled={revokeMutation.isPending || !reason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-40 transition-all cursor-pointer"
              >
                {a.rbacRevokeRole}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
