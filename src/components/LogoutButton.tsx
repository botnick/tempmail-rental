'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut, Loader2 } from 'lucide-react';

interface LogoutButtonProps {
  locale: string;
  label: string;
}

export function LogoutButton({ locale, label }: LogoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Always proceed with logout
    }
    router.push(`/${locale}/login`);
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text-muted/60 hover:text-danger hover:bg-danger/5 transition-all duration-200 w-full disabled:opacity-50 cursor-pointer"
    >
      {loading ? (
        <Loader2 className="w-[18px] h-[18px] animate-spin" />
      ) : (
        <LogOut className="w-[18px] h-[18px]" />
      )}
      <span className="font-medium">{label}</span>
    </button>
  );
}
