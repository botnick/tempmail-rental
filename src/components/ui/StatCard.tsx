import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  gradient: string;
  index?: number;
}

/** Map Tailwind gradient names to actual CSS gradient values */
const GRADIENT_MAP: Record<string, string> = {
  'from-brand to-amber': 'linear-gradient(135deg, #f97316, #f59e0b)',
  'from-brand-deep to-coral': 'linear-gradient(135deg, #ea580c, #f87171)',
  'from-tangerine to-peach': 'linear-gradient(135deg, #ff8c42, #ffb088)',
  'from-success to-accent-teal': 'linear-gradient(135deg, #22c55e, #14b8a6)',
  'from-brand to-brand-deep': 'linear-gradient(135deg, #f97316, #ea580c)',
  'from-coral to-brand-bright': 'linear-gradient(135deg, #f87171, #fb923c)',
  'from-amber to-gold': 'linear-gradient(135deg, #f59e0b, #eab308)',
  'from-warning to-amber': 'linear-gradient(135deg, #f59e0b, #f59e0b)',
  'from-danger to-coral': 'linear-gradient(135deg, #ef4444, #f87171)',
  'from-brand-deep to-brand': 'linear-gradient(135deg, #ea580c, #f97316)',
};

export function StatCard({ icon: Icon, label, value, gradient, index = 0 }: StatCardProps) {
  const bgGradient = GRADIENT_MAP[gradient] ?? 'linear-gradient(135deg, #f97316, #f59e0b)';

  return (
    <div
      className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-5 hover:bg-white/[0.04] hover:border-brand/12 hover:-translate-y-0.5 transition-all duration-300 animate-fade-in-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
        style={{ background: bgGradient, boxShadow: '0 8px 16px -4px rgba(0,0,0,0.3)' }}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{value}</p>
      <p className="text-xs text-text-muted font-medium">{label}</p>
    </div>
  );
}
