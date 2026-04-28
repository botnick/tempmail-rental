/**
 * RankBadge — visualises a user's tier (Bronze/Silver/Gold/etc.).
 *
 * All tier metadata (name, color, icon) is read from the Plan row in DB,
 * so admin can rename/recolor without code changes.
 */
import {
  Shield,
  Star,
  Crown,
  Gem,
  Eye,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  shield: Shield,
  star: Star,
  crown: Crown,
  gem: Gem,
  eye: Eye,
};

interface Props {
  tierName: string | null | undefined;
  tierColor: string | null | undefined;
  tierIcon: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function RankBadge({ tierName, tierColor, tierIcon, size = 'md', className = '' }: Props) {
  if (!tierName) return null;

  const IconCmp: LucideIcon = (tierIcon && ICONS[tierIcon]) || Shield;
  const color = tierColor ?? '#6b7280';

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }[size];

  const iconSize = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-bold uppercase tracking-wider rounded-full border ${sizeClasses} ${className}`}
      style={{
        color,
        backgroundColor: `${color}15`,
        borderColor: `${color}40`,
      }}
    >
      <IconCmp className={iconSize} style={{ color }} />
      {tierName}
    </span>
  );
}
