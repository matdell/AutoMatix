'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AutoMatixLogo from './AutoMatixLogo';
import { apiJson, clearToken } from '@/lib/api';
import { isCurrentCentralHost } from '@/lib/platform';

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const baseItems: NavItem[] = [
  { href: '/dashboard', label: 'Tablero', icon: 'dashboard' },
  { href: '/campanas', label: 'Campanas', icon: 'campaign' },
  { href: '/comercios', label: 'Comercios', icon: 'storefront' },
  { href: '#', label: 'Puntos de venta', icon: 'location_on' },
  { href: '/invitaciones', label: 'Invitaciones', icon: 'mail' },
  { href: '/validaciones', label: 'Errores de Validacion', icon: 'report_problem' },
  { href: '/perfil', label: 'Perfil', icon: 'account_circle' },
  { href: '#', label: 'Registros de Auditoria', icon: 'history_edu' },
];

const superAdminItems: NavItem[] = [
  { href: '/superadmin/users', label: 'Usuarios', icon: 'group' },
  { href: '/superadmin/banks', label: 'Bancos', icon: 'account_balance' },
  { href: '/superadmin/campaigns', label: 'Campanas', icon: 'campaign' },
  { href: '/superadmin/brands', label: 'Marcas', icon: 'branding_watermark' },
];

const centralSuperAdminItems: NavItem[] = [
  { href: '/superadmin/users', label: 'Usuarios', icon: 'group' },
  { href: '/superadmin/banks', label: 'Bancos', icon: 'account_balance' },
  { href: '/perfil', label: 'Perfil', icon: 'account_circle' },
];

const footerItems: NavItem[] = [
  { href: '#', label: 'Configuracion', icon: 'settings' },
  { href: '#', label: 'Soporte', icon: 'contact_support' },
];

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [bankLogoUrl, setBankLogoUrl] = useState<string | null>(null);
  const [isCentralHost, setIsCentralHost] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem('user');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setUserRole(parsed?.role ?? null);
    } catch {
      setUserRole(null);
    }
  }, []);

  useEffect(() => {
    setIsCentralHost(isCurrentCentralHost());
  }, []);

  useEffect(() => {
    if (!userRole || userRole === 'SUPERADMIN') {
      setBankLogoUrl(null);
      return;
    }

    let cancelled = false;
    void apiJson<{ logoUrl?: string | null }>('/banks/me')
      .then((bank) => {
        if (cancelled) return;
        setBankLogoUrl(bank.logoUrl ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setBankLogoUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [userRole]);

  const useCentralSuperAdminMenu = userRole === 'SUPERADMIN' && isCentralHost;
  const primaryItems = useMemo(() => {
    if (useCentralSuperAdminMenu) {
      return centralSuperAdminItems;
    }
    return baseItems;
  }, [useCentralSuperAdminMenu]);

  const isActive = (href: string) => {
    if (!href || href === '#') return false;
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const linkClassName = (active: boolean) =>
    [
      'flex items-center px-3 py-2 rounded-lg transition-all duration-200 ease-in-out',
      collapsed ? 'justify-center' : 'space-x-3',
      active
        ? 'bg-white text-indigo-600 shadow-sm font-semibold'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50',
    ].join(' ');

  const subLinkClassName = (active: boolean) =>
    [
      linkClassName(active),
      'text-xs',
      collapsed ? '' : 'ml-6',
    ]
      .filter(Boolean)
      .join(' ');

  const groupHeaderClassName = (active: boolean) =>
    [
      'flex items-center px-3 py-2 rounded-lg',
      collapsed ? 'justify-center' : 'space-x-3',
      active ? 'text-indigo-600 font-semibold' : 'text-slate-500',
    ].join(' ');

  const superAdminActive = superAdminItems.some((item) => isActive(item.href));

  const handleLogout = () => {
    clearToken();
    router.push('/login');
  };

  return (
    <aside
      className={[
        'fixed left-0 top-0 h-full z-40 bg-slate-50 border-r border-slate-200/15 flex flex-col p-4 space-y-2 font-[\'Inter\'] text-sm font-medium transition-all duration-200',
        collapsed ? 'w-20' : 'w-64',
      ].join(' ')}
    >
      <div className={['px-2 mb-8 mt-2 flex items-center', collapsed ? 'justify-center' : ''].join(' ')}>
        {bankLogoUrl ? (
          <img
            src={bankLogoUrl}
            alt="Logo del banco"
            className={collapsed ? 'h-10 w-10 rounded-lg object-cover' : 'h-12 w-full rounded-lg object-contain'}
            onError={(event) => {
              event.currentTarget.style.display = 'none';
              setBankLogoUrl(null);
            }}
          />
        ) : (
          <AutoMatixLogo className={collapsed ? 'h-10 w-16' : 'h-12 w-full'} showSubtitle={!collapsed} />
        )}
      </div>

      <nav className="flex-1 space-y-1">
        {primaryItems.map((item, index) => {
          const active = isActive(item.href);
          const link = (
            <a
              key={item.label}
              className={linkClassName(active)}
              href={item.href}
              title={collapsed ? item.label : undefined}
              aria-current={active ? 'page' : undefined}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              <span className={collapsed ? 'sr-only' : ''}>{item.label}</span>
            </a>
          );

          if (index !== 0 || userRole !== 'SUPERADMIN' || useCentralSuperAdminMenu) {
            return link;
          }

          return (
            <div key={`${item.label}-group`} className="space-y-2">
              {link}
              <div>
                <div className={groupHeaderClassName(superAdminActive)}>
                  <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
                  <span className={collapsed ? 'sr-only' : ''}>SuperAdmin</span>
                  {!collapsed ? (
                    <span className="material-symbols-outlined text-[16px] ml-auto text-slate-400">expand_more</span>
                  ) : null}
                </div>
                <div className="space-y-1">
                  {superAdminItems.map((subItem) => {
                    const subActive = isActive(subItem.href);
                    return (
                      <a
                        key={subItem.label}
                        className={subLinkClassName(subActive)}
                        href={subItem.href}
                        title={collapsed ? subItem.label : undefined}
                        aria-current={subActive ? 'page' : undefined}
                      >
                        <span
                          className="material-symbols-outlined text-[18px]"
                          style={subActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                        >
                          {subItem.icon}
                        </span>
                        <span className={collapsed ? 'sr-only' : ''}>{subItem.label}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      <div className="pt-4 border-t border-slate-200/50 space-y-1">
        {footerItems.map((item) => (
          <a
            key={item.label}
            className={linkClassName(false)}
            href={item.href}
            title={collapsed ? item.label : undefined}
          >
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            <span className={collapsed ? 'sr-only' : ''}>{item.label}</span>
          </a>
        ))}
        <button
          className={linkClassName(false)}
          type="button"
          onClick={handleLogout}
          title={collapsed ? 'Cerrar sesion' : undefined}
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span className={collapsed ? 'sr-only' : ''}>Cerrar sesion</span>
        </button>
        <button
          className={linkClassName(false)}
          type="button"
          onClick={onToggle}
          aria-pressed={collapsed}
          title={collapsed ? 'Expandir menu' : 'Minimizar menu'}
        >
          <span className="material-symbols-outlined text-[20px]">
            {collapsed ? 'chevron_right' : 'chevron_left'}
          </span>
          <span className={collapsed ? 'sr-only' : ''}>{collapsed ? 'Expandir menu' : 'Minimizar menu'}</span>
        </button>
      </div>
    </aside>
  );
}
