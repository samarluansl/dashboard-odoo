'use client';

import { Bell, Menu, LogOut } from 'lucide-react';
import { CompanyFilter } from '@/components/dashboard/CompanyFilter';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import { useCompanyFilter } from '@/lib/context/CompanyContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface TopbarProps {
  onMenuClick: () => void;
  userName?: string;
  unreadAlerts?: number;
}

export function Topbar({ onMenuClick, userName = 'Usuario', unreadAlerts = 0 }: TopbarProps) {
  const router = useRouter();
  const { period, setPeriod } = useCompanyFilter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:px-6">
      <button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg hover:bg-gray-100" aria-label="Abrir menú">
        <Menu className="h-5 w-5 text-gray-500" />
      </button>

      {/* Filtros globales juntos */}
      <div className="flex items-center gap-2">
        <CompanyFilter />
        <DateRangePicker value={period} onChange={setPeriod} />
      </div>

      <div className="flex-1" />

      {/* Alertas */}
      <button
        onClick={() => router.push('/alertas')}
        className="relative p-2.5 rounded-lg hover:bg-gray-100"
        aria-label={unreadAlerts > 0 ? `${unreadAlerts} alertas pendientes` : 'Ver alertas'}
      >
        <Bell className="h-5 w-5 text-gray-500" />
        {unreadAlerts > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadAlerts > 9 ? '9+' : unreadAlerts}
          </span>
        )}
      </button>

      {/* User menu */}
      <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
          <span className="text-xs font-bold text-white">{userName.charAt(0).toUpperCase()}</span>
        </div>
        <span className="hidden sm:block text-sm font-medium text-gray-700">{userName}</span>
        <button onClick={handleLogout} className="p-2.5 rounded-lg hover:bg-gray-100" title="Cerrar sesión" aria-label="Cerrar sesión">
          <LogOut className="h-4 w-4 text-gray-400" />
        </button>
      </div>
    </header>
  );
}
