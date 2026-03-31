'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import Sidebar from './Sidebar';

type AppShellProps = {
  children: React.ReactNode;
  mainClassName?: string;
};

export default function AppShell({ children, mainClassName }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('sidebar-collapsed');
    if (stored) {
      setCollapsed(stored === '1');
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('sidebar-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

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
