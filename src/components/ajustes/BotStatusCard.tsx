'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff, Activity, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function BotStatusCard() {
  const [status, setStatus] = useState<{
    status: string;
    whatsapp_connected: boolean;
    odoo_connected: boolean;
    last_heartbeat: string | null;
    last_message_at: string | null;
    messages_today: number;
    uptime_since: string | null;
    minutes_since_heartbeat: number;
  } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch('/api/bot-status', { headers });
      if (res.ok) setStatus(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const isOnline = status?.status === 'online';
  const isDegraded = status?.status === 'degraded';

  const formatTime = (iso: string | null) => {
    if (!iso) return '\u2014';
    return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const formatUptime = (iso: string | null) => {
    if (!iso) return '\u2014';
    const ms = Date.now() - new Date(iso).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Estado del Bot WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!status ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full',
                isOnline ? 'bg-emerald-100' : isDegraded ? 'bg-amber-100' : 'bg-red-100'
              )}>
                {isOnline ? (
                  <Wifi className="h-5 w-5 text-emerald-600" />
                ) : (
                  <WifiOff className={cn('h-5 w-5', isDegraded ? 'text-amber-600' : 'text-red-500')} />
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {isOnline ? 'Online' : isDegraded ? 'Degradado' : 'Offline'}
                </p>
                <p className="text-xs text-gray-400">
                  Ultimo heartbeat: {status.minutes_since_heartbeat < 999 ? `hace ${status.minutes_since_heartbeat} min` : '\u2014'}
                </p>
              </div>
              <div className={cn(
                'ml-auto h-2.5 w-2.5 rounded-full',
                isOnline ? 'bg-emerald-500 animate-pulse' : isDegraded ? 'bg-amber-400' : 'bg-red-400'
              )} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-xs text-gray-400 mb-0.5">WhatsApp</p>
                <p className={cn('text-sm font-semibold', status.whatsapp_connected ? 'text-emerald-600' : 'text-red-500')}>
                  {status.whatsapp_connected ? 'Conectado' : 'Desconectado'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-xs text-gray-400 mb-0.5">Odoo</p>
                <p className={cn('text-sm font-semibold', status.odoo_connected ? 'text-emerald-600' : 'text-red-500')}>
                  {status.odoo_connected ? 'Conectado' : 'Desconectado'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-xs text-gray-400 mb-0.5">Mensajes hoy</p>
                <p className="text-sm font-semibold text-gray-900">{status.messages_today ?? 0}</p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-xs text-gray-400 mb-0.5">Uptime</p>
                <p className="text-sm font-semibold text-gray-900">{formatUptime(status.uptime_since)}</p>
              </div>
            </div>

            {status.last_message_at && (
              <p className="text-xs text-gray-400">
                Ultimo mensaje recibido: {formatTime(status.last_message_at)}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
