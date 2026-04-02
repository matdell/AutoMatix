'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import { isCurrentCentralHost } from '@/lib/platform';

type AppShellProps = {
  children: React.ReactNode;
  mainClassName?: string;
};

export default function AppShell({ children, mainClassName }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const stored = window.localStorage.getItem('sidebar-collapsed');
    if (stored) {
      setCollapsed(stored === '1');
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('sidebar-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    if (!isCurrentCentralHost()) {
      return;
    }

    const raw = window.localStorage.getItem('user');
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (parsed?.role !== 'SUPERADMIN') {
        return;
      }
      const allowedPrefixes = ['/superadmin/users', '/superadmin/banks', '/perfil'];
      const allowed = allowedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
      if (!allowed) {
        router.replace('/superadmin/users');
      }
    } catch {
      // Ignora errores de parseo y deja actuar a los guards de cada pantalla.
    }
  }, [pathname, router]);

  const sidebarWidth = collapsed ? '5rem' : '16rem';
  const mainClasses = ['ml-[var(--sidebar-width)] min-h-screen transition-[margin] duration-200', mainClassName]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className="bg-surface text-on-surface min-h-screen"
      style={{ '--sidebar-width': sidebarWidth } as CSSProperties}
    >
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
      <main className={mainClasses}>{children}</main>
    </div>
  );
}
