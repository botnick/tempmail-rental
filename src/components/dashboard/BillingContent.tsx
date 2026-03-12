'use client';

import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton';
import { Wallet, ArrowUpRight, ArrowDownLeft, CreditCard, Receipt } from 'lucide-react';
import { useState } from 'react';
import { formatDate } from '@/lib/dayjs';

interface BillingContentProps {
  dict: {
    billing: Record<string, string>;
    ui: Record<string, string>;
  };
}

export function BillingContent({ dict }: BillingContentProps) {
  const d = dict.billing;
  const ui = dict.ui;
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [showTopup, setShowTopup] = useState(false);
  const [amount, setAmount] = useState(100);

  const wallet = trpc.billing.getWallet.useQuery();
  const ledger = trpc.billing.getLedger.useQuery({ page, pageSize: 20 });

  const createTopup = trpc.billing.createTopup.useMutation({
    onSuccess: () => {
      toast.success(d.topupSuccess);
      setShowTopup(false);
      wallet.refetch();
      ledger.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const transactions = ledger.data?.data ?? [];

  return (
    <div>
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{d.title}</h1>
        <p className="text-sm text-text-muted">{d.subtitle}</p>
      </div>

      {/* Balance Card */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-6 mb-6 animate-fade-in-up delay-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-success to-accent-teal flex items-center justify-center shadow-lg">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-text-muted font-medium">{d.balance}</p>
              {wallet.isLoading ? (
                <div className="w-24 h-8 bg-white/[0.04] rounded-lg animate-pulse mt-1" />
              ) : (
                <p className="text-3xl font-extrabold text-text-primary tracking-tight">฿{Number(wallet.data?.balance ?? 0).toLocaleString()}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowTopup(true)}
            className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 transition-all duration-300 flex items-center gap-2 cursor-pointer"
          >
            <CreditCard className="w-4 h-4" />
            {d.topup}
          </button>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden animate-fade-in-up delay-2">
        <div className="px-6 pt-5 pb-4 border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-brand" />
            <h2 className="text-sm font-bold text-text-primary">{d.transactions}</h2>
          </div>
        </div>

        {ledger.isLoading ? (
          <div className="p-6"><SkeletonTable rows={5} /></div>
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={<Receipt className="w-6 h-6" />}
            title={d.emptyTitle}
            description={d.emptyDesc}
          />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {transactions.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-all">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.type === 'CREDIT' ? 'bg-success/10' : 'bg-danger/10'}`}>
                    {tx.type === 'CREDIT' ? <ArrowDownLeft className="w-4 h-4 text-success" /> : <ArrowUpRight className="w-4 h-4 text-danger" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{tx.description ?? tx.type}</p>
                    <p className="text-[10px] text-text-muted">{formatDate(tx.createdAt)}</p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${tx.type === 'CREDIT' ? 'text-success' : 'text-danger'}`}>
                  {tx.type === 'CREDIT' ? '+' : '-'}฿{Number(tx.amount).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {(ledger.data?.total ?? 0) > 20 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.prev}</button>
          <span className="text-xs text-text-muted">{ui.page} {page}</span>
          <button onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.next}</button>
        </div>
      )}

      {/* Topup Modal */}
      <Modal open={showTopup} onClose={() => setShowTopup(false)} title={d.topupTitle}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{d.amount}</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[100, 300, 500].map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(v)}
                  className={`py-2.5 text-sm font-bold rounded-xl border transition-all cursor-pointer ${
                    amount === v
                      ? 'border-brand/40 bg-brand/10 text-brand'
                      : 'border-border-subtle bg-white/[0.02] text-text-secondary hover:border-brand/20'
                  }`}
                >
                  ฿{v}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={10}
              className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 px-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all"
            />
          </div>
          <button
            onClick={() => createTopup.mutate({ amount } as any)}
            disabled={createTopup.isPending || amount < 10}
            className="w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 transition-all disabled:opacity-50 cursor-pointer"
          >
            {createTopup.isPending ? ui.loading : `${d.topup} ฿${amount}`}
          </button>
        </div>
      </Modal>
    </div>
  );
}
