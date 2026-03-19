'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { ROUTES } from '@/config/ui';
import { ChevronRight, Check, Flame, Loader2 } from 'lucide-react';
import { useMemo } from 'react';

// ──────────────────────────────────────────────
// COLOR PALETTES — rotating, no slug dependency
// Admin adds a new plan → it auto-gets a palette
// ──────────────────────────────────────────────
const PALETTES = [
  {
    card: 'border border-border-warm/60 bg-elevated/80 backdrop-blur-sm',
    check: 'from-amber to-gold',
    cta: 'text-text-secondary border border-border-warm hover:bg-brand/10 hover:text-text-primary hover:border-brand/40',
  },
  {
    card: 'border border-teal-500/15 bg-elevated/80 backdrop-blur-sm',
    check: 'from-teal-400 to-emerald-500',
    cta: 'text-text-secondary border border-border-warm hover:bg-emerald-500/10 hover:text-text-primary hover:border-emerald-500/40',
  },
  {
    card: 'border border-sky-500/15 bg-elevated/80 backdrop-blur-sm',
    check: 'from-sky-400 to-blue-500',
    cta: 'text-text-secondary border border-border-warm hover:bg-blue-500/10 hover:text-text-primary hover:border-blue-500/40',
  },
  {
    card: 'border border-violet-500/15 bg-elevated/80 backdrop-blur-sm',
    check: 'from-violet-400 to-purple-500',
    cta: 'text-text-secondary border border-border-warm hover:bg-purple-500/10 hover:text-text-primary hover:border-purple-500/40',
  },
  {
    card: 'border border-rose-500/15 bg-elevated/80 backdrop-blur-sm',
    check: 'from-rose-400 to-pink-500',
    cta: 'text-text-secondary border border-border-warm hover:bg-rose-500/10 hover:text-text-primary hover:border-rose-500/40',
  },
  {
    card: 'border border-indigo-500/15 bg-elevated/80 backdrop-blur-sm',
    check: 'from-indigo-400 to-purple-500',
    cta: 'text-text-secondary border border-border-warm hover:bg-indigo-500/10 hover:text-text-primary hover:border-indigo-500/40',
  },
];

const FEATURED_STYLE = {
  card: 'bg-gradient-to-br from-brand to-amber shadow-2xl shadow-brand/20 md:scale-[1.03] border border-brand/30',
  check: 'from-brand to-coral',
  cta: 'text-white bg-gradient-to-r from-brand to-amber hover:shadow-lg hover:shadow-brand/30 hover:-translate-y-0.5',
};

interface PricingDict {
  title: string;
  titleSuffix: string;
  subtitle: string;
  popular: string;
  perMonth: string;
  forever: string;
  compare: string;
  ctaFree?: string;
  ctaPaid?: string;
  plans?: Record<string, {
    name?: string;
    cta?: string;
    features?: string[];
  }>;
}

interface PricingPageContentProps {
  locale: string;
  dict: {
    pricing: PricingDict;
    nav: Record<string, string>;
    admin?: Record<string, string>;
  };
}

/**
 * Check if a plan is "featured" via its metadata JSON.
 * Admin can set { "featured": true } in plan metadata.
 */
function isFeatured(plan: { slug: string; features: Record<string, unknown> }, metadata?: unknown): boolean {
  if (metadata && typeof metadata === 'object' && 'featured' in (metadata as Record<string, unknown>)) {
    return !!(metadata as Record<string, boolean>).featured;
  }
  // Fallback: if slug is 'pro', treat as featured for legacy data
  return plan.slug === 'pro';
}

/**
 * Format feature value for display in comparison table.
 */
function formatFeatureValue(key: string, val: unknown): string {
  if (val === true || val === 'true') return '✓';
  if (val === false || val === 'false') return '✕';
  if (typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)))) {
    const num = Number(val);
    if (num === -1 || num >= 999999) return '∞';
    if (key === 'retention_hours') {
      if (num >= 8760) return `${Math.round(num / 8760)} year`;
      if (num >= 720) return `${Math.round(num / 720)} mo`;
      if (num >= 168) return `${Math.round(num / 24)} days`;
      return `${num}h`;
    }
    if (key === 'max_message_size_mb') return `${num} MB`;
    return num.toLocaleString();
  }
  return String(val ?? '—');
}

/**
 * Get the monthly pricing for display.
 */
function getMonthlyPrice(pricing: Array<{ currency: string; amount: string; billingPeriod: string }>): { amount: string; currency: string } {
  const monthly = pricing.find((p) => p.billingPeriod === 'monthly');
  if (monthly) return { amount: monthly.amount, currency: monthly.currency };
  const first = pricing[0];
  if (first) return { amount: first.amount, currency: first.currency };
  return { amount: '0', currency: 'THB' };
}

/**
 * Generate user-friendly feature list from DB features object.
 * Labels come from dictionary (fk_<key>) for i18n.
 */
function generateFeatureList(
  features: Record<string, unknown>,
  trialDays: number,
  adminDict: Record<string, string>
): string[] {
  const result: string[] = [];
  for (const [key, val] of Object.entries(features)) {
    const label = adminDict[`fk_${key}`] || key.replace(/_/g, ' ');

    if (val === true || val === 'true') {
      result.push(label);
    } else if (val === false || val === 'false') {
      // skip disabled features
    } else if (typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)))) {
      const num = Number(val);
      if (num === -1 || num >= 999999) {
        result.push(`${label}: Unlimited`);
      } else if (key === 'retention_hours') {
        if (num >= 8760) result.push(`${Math.round(num / 8760)}-year retention`);
        else if (num >= 720) result.push(`${Math.round(num / 720)}-month retention`);
        else if (num >= 168) result.push(`${Math.round(num / 24)}-day retention`);
        else result.push(`${num}-hour retention`);
      } else if (key === 'max_message_size_mb') {
        result.push(`${num} MB max attachment`);
      } else {
        result.push(`${num} ${label.toLowerCase()}`);
      }
    } else {
      result.push(`${label}: ${val}`);
    }
  }
  if (trialDays > 0) {
    result.push(`${trialDays}-day free trial`);
  }
  return result;
}

/**
 * Auto-generate CTA text.
 */
function getCta(planName: string, isFree: boolean, dict: PricingDict): string {
  if (dict.plans?.[planName.toLowerCase()]?.cta) return dict.plans[planName.toLowerCase()].cta!;
  if (isFree) return dict.ctaFree || `Start ${planName}`;
  return dict.ctaPaid ? dict.ctaPaid.replace('{name}', planName) : `Try ${planName}`;
}

export function PricingPageContent({ locale, dict }: PricingPageContentProps) {
  const { data: plans, isLoading } = trpc.plan.list.useQuery();
  const adminDict = dict.admin ?? {};

  // Extract ALL unique feature keys dynamically from DB
  const allFeatureKeys = useMemo(() => {
    if (!plans) return [];
    const keySet = new Set<string>();
    for (const plan of plans) {
      for (const key of Object.keys(plan.features)) {
        keySet.add(key);
      }
    }
    return Array.from(keySet);
  }, [plans]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
      </div>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <div className="text-center py-32">
        <p className="text-text-muted">No plans available</p>
      </div>
    );
  }

  return (
    <>
      {/* Plan Cards */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 pb-20">
        <div className={`grid grid-cols-1 gap-5 ${
          plans.length <= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'
        }`}>
          {plans.map((plan, i) => {
            const featured = isFeatured(plan, (plan as Record<string, unknown>).metadata);
            const palette = featured ? FEATURED_STYLE : PALETTES[i % PALETTES.length];
            const priceInfo = getMonthlyPrice(plan.pricing);
            const isFree = Number(priceInfo.amount) === 0;

            const displayFeatures = generateFeatureList(plan.features, plan.trialDays, adminDict);
            const ctaText = getCta(plan.name, isFree, dict.pricing);

            return (
              <div
                key={plan.slug}
                className={`rounded-3xl p-[1.5px] animate-fade-in-up ${palette.card}`}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="bg-surface/95 rounded-3xl p-7 h-full flex flex-col">
                  {featured && (
                    <span className="self-start text-[10px] font-bold uppercase tracking-wider text-brand bg-brand/10 border border-brand/20 px-3 py-1 rounded-full mb-4 flex items-center gap-1">
                      <Flame className="w-3 h-3" />
                      {dict.pricing.popular}
                    </span>
                  )}
                  <h3 className="text-lg font-extrabold text-text-primary mb-1">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-4xl font-extrabold tracking-tight text-text-primary">
                      ฿{priceInfo.amount}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mb-6">
                    {isFree ? dict.pricing.forever : dict.pricing.perMonth}
                  </p>

                  <ul className="space-y-3 flex-1 mb-8">
                    {displayFeatures.map((f, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-sm text-text-secondary">
                        <div className={`w-[18px] h-[18px] rounded-full bg-gradient-to-br ${palette.check} flex items-center justify-center shrink-0 mt-0.5`}>
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={`/${locale}${ROUTES.register}`}
                    className={`w-full py-3 text-sm font-bold rounded-xl text-center transition-all duration-300 flex items-center justify-center gap-2 ${palette.cta}`}
                  >
                    {ctaText}
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="mt-20 bg-elevated/70 backdrop-blur-xl border border-border-warm/40 rounded-2xl overflow-hidden animate-fade-in-up delay-3">
          <div className="p-6 border-b border-border-subtle">
            <h2 className="text-base font-bold text-text-primary">{dict.pricing.compare}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-widest text-text-muted font-semibold">Feature</th>
                  {plans.map((plan) => {
                    const featured = isFeatured(plan, (plan as Record<string, unknown>).metadata);
                    return (
                      <th
                        key={plan.slug}
                        className={`text-center px-4 py-3 text-[10px] uppercase tracking-widest font-semibold ${
                          featured ? 'text-brand' : 'text-text-muted'
                        }`}
                      >
                        {plan.name}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {allFeatureKeys.map((featureKey) => (
                  <tr key={featureKey} className="border-b border-border-subtle/50 hover:bg-brand/[0.02] transition-colors">
                    <td className="px-6 py-3 text-sm text-text-secondary font-medium">
                      {adminDict[`fk_${featureKey}`] || featureKey.replace(/_/g, ' ')}
                    </td>
                    {plans.map((plan) => {
                      const val = plan.features[featureKey];
                      const featured = isFeatured(plan, (plan as Record<string, unknown>).metadata);
                      return (
                        <td
                          key={plan.slug}
                          className={`text-center px-4 py-3 text-sm ${
                            featured ? 'text-brand font-semibold' : 'text-text-muted'
                          }`}
                        >
                          {val !== undefined ? formatFeatureValue(featureKey, val) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
