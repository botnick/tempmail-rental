const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-success/10 text-success border-success/20',
  VERIFIED: 'bg-success/10 text-success border-success/20',
  TRIALING: 'bg-brand/10 text-brand border-brand/20',
  PENDING: 'bg-warning/10 text-warning border-warning/20',
  PENDING_VERIFICATION: 'bg-warning/10 text-warning border-warning/20',
  PENDING_DNS: 'bg-warning/10 text-warning border-warning/20',
  EXPIRED: 'bg-text-muted/10 text-text-muted border-text-muted/20',
  SUSPENDED: 'bg-danger/10 text-danger border-danger/20',
  BANNED: 'bg-danger/10 text-danger border-danger/20',
  QUARANTINED: 'bg-warning/10 text-warning border-warning/20',
  DELETED: 'bg-text-muted/10 text-text-muted/60 border-text-muted/10',
  DEACTIVATED: 'bg-text-muted/10 text-text-muted/60 border-text-muted/10',
  CANCELLED: 'bg-text-muted/10 text-text-muted/60 border-text-muted/10',
  APPROVED: 'bg-success/10 text-success border-success/20',
  REJECTED: 'bg-danger/10 text-danger border-danger/20',
};

const DEFAULT_STYLE = 'bg-white/[0.06] text-text-secondary border-white/[0.08]';

interface StatusBadgeProps {
  status: string;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? DEFAULT_STYLE;
  return (
    <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${style}`}>
      {label ?? status}
    </span>
  );
}
