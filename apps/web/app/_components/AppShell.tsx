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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
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
    const media = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      const nextDesktop = media.matches;
      setIsDesktop(nextDesktop);
      if (nextDesktop) {
        setMobileOpen(false);
      }
    };
    sync();
    media.addEventListener('change', sync);
    return () => {
      media.removeEventListener('change', sync);
    };
  }, []);

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

  const sidebarWidth = isDesktop ? (collapsed ? '5rem' : '16rem') : '0rem';
  const mainClasses = ['ml-[var(--sidebar-width)] min-h-screen transition-[margin] duration-200', mainClassName]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className="bg-surface text-on-surface min-h-screen"
      style={{ '--sidebar-width': sidebarWidth } as CSSProperties}
    >
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Cerrar menu"
          className="fixed inset-0 z-30 bg-slate-900/35 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <button
        type="button"
        aria-label={mobileOpen ? 'Minimizar menu' : 'Expandir menu'}
        className="fixed left-3 top-3 z-50 lg:hidden rounded-lg border border-slate-200 bg-white/95 px-2.5 py-2 text-slate-700 shadow-sm"
        onClick={() => setMobileOpen((prev) => !prev)}
      >
        <span className="material-symbols-outlined text-[20px]">
          {mobileOpen ? 'chevron_left' : 'menu'}
        </span>
      </button>

      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        onToggle={() => {
          if (isDesktop) {
            setCollapsed((prev) => !prev);
          } else {
            setMobileOpen(false);
          }
        }}
      />
      <main className={mainClasses}>{children}</main>
    </div>
  );
}
