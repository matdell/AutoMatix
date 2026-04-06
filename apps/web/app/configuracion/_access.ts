'use client';

import { useEffect, useState } from 'react';
import { getToken } from '@/lib/api';

type RouterLike = {
  push: (href: string) => void;
};

export function useConfigAccess(router: RouterLike) {
  const [role, setRole] = useState<string | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }

    const raw = window.localStorage.getItem('user');
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      setRole(parsed?.role ?? null);
      setSelectedBankId(window.localStorage.getItem('superadmin-bank-id'));
    } catch {
      setRole(null);
    }
  }, [router]);

  const isAdmin = role === 'BANK_ADMIN' || role === 'SUPERADMIN';
  const needsBankSelection = role === 'SUPERADMIN' && !selectedBankId;
  const canManage = isAdmin && !needsBankSelection;

  const withBankQuery = (path: string) => {
    if (role !== 'SUPERADMIN' || !selectedBankId) return path;
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}bankId=${encodeURIComponent(selectedBankId)}`;
  };

  return {
    role,
    selectedBankId,
    isAdmin,
    needsBankSelection,
    canManage,
    withBankQuery,
  };
}
