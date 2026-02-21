'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Euro,
  Users,
  Target,
  RefreshCw,
  Bell,
  MessageCircle,
  Settings,
  ChevronLeft,
  X,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/financiero', label: 'Financiero', icon: Euro },
  { href: '/rrhh', label: 'RRHH', icon: Users },
  { href: '/crm', label: 'CRM', icon: Target },
  { href: '/suscripciones', label: 'Suscripciones', icon: RefreshCw },
  { href: '/alertas', label: 'Alertas', icon: Bell },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/ajustes', label: 'Ajustes', icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLElement>(null);

  // Escape key cierra el sidebar mobile
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMobileClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [mobileOpen, onMobileClose]);

  // Focus trap en mobile sidebar
  useEffect(() => {
    if (!mobileOpen || !sidebarRef.current) return;

    const sidebar = sidebarRef.current;
    const focusable = sidebar.querySelectorAll<HTMLElement>(
      'a[href], button, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Dar foco al primer elemento
    first.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [mobileOpen]);

  const content = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={cn('flex items-center border-b border-gray-200 px-4 h-16', collapsed ? 'justify-center' : 'justify-between')}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img src="/logo-samarluan.svg" alt="Samarluan" className="h-7 w-7 object-contain" />
            <span className="text-lg font-bold text-gray-900">Samarluan</span>
          </div>
        )}
        {collapsed && <img src="/logo-samarluan.svg" alt="S" className="h-7 w-7 object-contain" />}
        <button
          onClick={onToggle}
          className="hidden lg:flex items-center justify-center h-11 w-11 rounded-lg hover:bg-gray-100"
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          <ChevronLeft className={cn('h-4 w-4 text-gray-500 transition-transform', collapsed && 'rotate-180')} />
        </button>
        <button
          onClick={onMobileClose}
          className="lg:hidden flex items-center justify-center h-11 w-11 rounded-lg hover:bg-gray-100"
          aria-label="Cerrar menú"
        >
          <X className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <item.icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-blue-600' : 'text-gray-400')} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-gray-200 p-4">
          <p className="text-xs text-gray-400">Grupo Samarluan</p>
          <p className="text-xs text-gray-400">25 empresas &middot; Odoo v17</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={cn(
        'hidden lg:flex flex-col border-r border-gray-200 bg-white transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}>
        {content}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú de navegación">
          <div className="fixed inset-0 bg-black/50" onClick={onMobileClose} aria-hidden="true" />
          <aside ref={sidebarRef} className="fixed left-0 top-0 bottom-0 w-72 bg-white shadow-xl z-50">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
