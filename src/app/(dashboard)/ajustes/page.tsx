'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
  User, Users, Plus, Pencil, Trash2, X,
  Check, ChevronDown, Phone, Mail, Shield, Building2, MessageCircle,
  Bell, Clock, Calendar, Loader2, Wifi, WifiOff, Activity,
} from 'lucide-react';
import { COMPANIES } from '@/lib/companies';
import { ALERT_TYPES, FREQUENCY_OPTIONS, DAY_OPTIONS, type FrequencyOption } from '@/lib/alert-types';

const ROLES = [
  { value: 'admin', label: 'Admin', color: 'info' as const },
  { value: 'manager', label: 'Manager', color: 'warning' as const },
  { value: 'viewer', label: 'Viewer', color: 'default' as const },
];

interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  default_company: string | null;
  notifications_enabled: boolean;
  allowed_companies: string[];
  created_at: string;
}

/* ── Card de estado del bot ── */
function BotStatusCard() {
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
      const res = await fetch('/api/bot-status');
      if (res.ok) setStatus(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Actualizar cada 30s
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const isOnline = status?.status === 'online';
  const isDegraded = status?.status === 'degraded';

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const formatUptime = (iso: string | null) => {
    if (!iso) return '—';
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
            {/* Estado principal */}
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
                  Último heartbeat: {status.minutes_since_heartbeat < 999 ? `hace ${status.minutes_since_heartbeat} min` : '—'}
                </p>
              </div>
              <div className={cn(
                'ml-auto h-2.5 w-2.5 rounded-full',
                isOnline ? 'bg-emerald-500 animate-pulse' : isDegraded ? 'bg-amber-400' : 'bg-red-400'
              )} />
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-xs text-gray-400 mb-0.5">WhatsApp</p>
                <p className={cn('text-sm font-semibold', status.whatsapp_connected ? 'text-emerald-600' : 'text-red-500')}>
                  {status.whatsapp_connected ? '✓ Conectado' : '✗ Desconectado'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-xs text-gray-400 mb-0.5">Odoo</p>
                <p className={cn('text-sm font-semibold', status.odoo_connected ? 'text-emerald-600' : 'text-red-500')}>
                  {status.odoo_connected ? '✓ Conectado' : '✗ Desconectado'}
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

            {/* Último mensaje */}
            {status.last_message_at && (
              <p className="text-xs text-gray-400">
                Último mensaje recibido: {formatTime(status.last_message_at)}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Multi-select de empresas ── */
function CompanyMultiSelect({ selected, onChange }: { selected: string[]; onChange: (c: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };

  const count = selected.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm w-full',
          'hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
          count > 0 ? 'border-blue-300 text-blue-700' : 'border-gray-300 text-gray-600',
        )}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate text-left flex-1">
          {count === 0 ? 'Todas las empresas' : `${count} empresas`}
        </span>
        {count > 0 && (
          <span
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); onChange([]); }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onChange([]); } }}
            className="rounded-full p-0.5 hover:bg-blue-100 cursor-pointer"
          >
            <X className="h-3 w-3" />
          </span>
        )}
        <ChevronDown className={cn('h-3.5 w-3.5 text-gray-400 transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-72 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => onChange([])}
            className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50', count === 0 ? 'text-blue-700 font-medium' : 'text-gray-600')}
          >
            <div className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', count === 0 ? 'border-blue-500 bg-blue-500' : 'border-gray-300')}>
              {count === 0 && <Check className="h-3 w-3 text-white" />}
            </div>
            Todas
          </button>
          <div className="my-1 border-t border-gray-100" />
          <div className="max-h-52 overflow-y-auto">
            {COMPANIES.map(c => {
              const active = selected.includes(c.value);
              return (
                <button key={c.value} type="button" onClick={() => toggle(c.value)}
                  className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50', active ? 'text-blue-700' : 'text-gray-700')}
                >
                  <div className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', active ? 'border-blue-500 bg-blue-500' : 'border-gray-300')}>
                    {active && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className="truncate">{c.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sección de notificaciones WhatsApp ── */
interface AlertPref {
  enabled: boolean;
  frequency: FrequencyOption;
  preferred_day: number | null;
  preferred_time: string;
}

function NotificationPreferences({ token }: { token: string }) {
  const [prefs, setPrefs] = useState<Record<string, AlertPref>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setPrefs(data.preferences || {}); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  const toggleEnabled = (key: string) => {
    setPrefs(p => ({
      ...p,
      [key]: { ...p[key], enabled: !p[key]?.enabled },
    }));
    setDirty(true);
  };

  const updatePref = (key: string, field: keyof AlertPref, value: AlertPref[keyof AlertPref]) => {
    setPrefs(p => ({
      ...p,
      [key]: { ...p[key], [field]: value },
    }));
    setDirty(true);
  };

  const toggleAll = (enabled: boolean) => {
    setPrefs(p => {
      const updated = { ...p };
      for (const at of ALERT_TYPES) {
        updated[at.value] = { ...updated[at.value], enabled };
      }
      return updated;
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ preferences: prefs }),
      });
      if (res.ok) {
        setDirty(false);
        setFeedback('Preferencias guardadas');
        setTimeout(() => setFeedback(''), 2500);
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const enabledCount = Object.values(prefs).filter(p => p?.enabled).length;
  const allEnabled = enabledCount === ALERT_TYPES.length;
  const noneEnabled = enabledCount === 0;

  // Agrupar por frecuencia ORIGINAL de la alerta
  const groups: { label: string; icon: React.ReactNode; items: typeof ALERT_TYPES }[] = [
    { label: 'Diarias', icon: <Clock className="h-3.5 w-3.5" />, items: ALERT_TYPES.filter(a => a.frequency === 'Diario') },
    { label: 'Semanales', icon: <Calendar className="h-3.5 w-3.5" />, items: ALERT_TYPES.filter(a => a.frequency === 'Semanal') },
    { label: 'Mensuales', icon: <Calendar className="h-3.5 w-3.5" />, items: ALERT_TYPES.filter(a => a.frequency === 'Mensual') },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header con acciones */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant={enabledCount > 0 ? 'success' : 'default'}>
            {enabledCount} de {ALERT_TYPES.length} activas
          </Badge>
          {feedback && (
            <span className="text-xs text-emerald-600 font-medium">{feedback}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleAll(!allEnabled)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {allEnabled ? 'Desactivar todas' : noneEnabled ? 'Activar todas' : 'Activar todas'}
          </button>
          {dirty && (
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
              Guardar
            </Button>
          )}
        </div>
      </div>

      {/* Grupos de alertas */}
      {groups.map(group => (
        <div key={group.label}>
          <div className="flex items-center gap-2 mb-2">
            {group.icon}
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{group.label}</h4>
          </div>
          <div className="space-y-1.5">
            {group.items.map(alert => {
              const pref = prefs[alert.value];
              const enabled = pref?.enabled ?? false;
              const freq = pref?.frequency ?? alert.frequency;
              const needsDay = freq === 'Semanal' || freq === 'Quincenal';
              const freqChanged = freq !== alert.frequency;

              return (
                <div
                  key={alert.value}
                  className={cn(
                    'rounded-lg px-3 py-2.5 transition-colors',
                    enabled ? 'bg-emerald-50' : 'bg-gray-50',
                  )}
                >
                  {/* Fila principal: toggle + info */}
                  <button
                    type="button"
                    onClick={() => toggleEnabled(alert.value)}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    {/* Toggle visual */}
                    <div className={cn(
                      'flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
                      enabled ? 'bg-emerald-500' : 'bg-gray-300',
                    )}>
                      <div className={cn(
                        'h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                        enabled ? 'translate-x-4' : 'translate-x-0',
                      )} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm font-medium', enabled ? 'text-gray-900' : 'text-gray-500')}>
                          {alert.label}
                        </span>
                        {freqChanged && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                            {freq}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{alert.description}</p>
                    </div>
                  </button>

                  {/* Controles de schedule (solo cuando enabled) */}
                  {enabled && (
                    <div className="mt-2 ml-12 flex flex-wrap items-center gap-2">
                      {/* Frecuencia */}
                      <select
                        value={freq}
                        onChange={e => {
                          const newFreq = e.target.value as FrequencyOption;
                          updatePref(alert.value, 'frequency', newFreq);
                          // Si cambia a diario o mensual, limpiar día
                          if (newFreq === 'Diario' || newFreq === 'Mensual') {
                            updatePref(alert.value, 'preferred_day', null);
                          } else if (pref?.preferred_day == null) {
                            // Si cambia a semanal/quincenal y no tiene día, poner lunes
                            updatePref(alert.value, 'preferred_day', 0);
                          }
                        }}
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {FREQUENCY_OPTIONS.map(f => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>

                      {/* Día (solo semanal/quincenal) */}
                      {needsDay && (
                        <select
                          value={pref?.preferred_day ?? 0}
                          onChange={e => updatePref(alert.value, 'preferred_day', parseInt(e.target.value))}
                          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {DAY_OPTIONS.map(d => (
                            <option key={d.value} value={d.value}>{d.label}</option>
                          ))}
                        </select>
                      )}

                      {/* Hora */}
                      <input
                        type="time"
                        value={pref?.preferred_time ?? alert.defaultTime}
                        onChange={e => updatePref(alert.value, 'preferred_time', e.target.value)}
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Input reutilizable ── */
const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

/* ── Página principal ── */
export default function AjustesPage() {
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; name: string; role: string } | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');

  // Edición
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Profile>>({});

  // Nuevo usuario
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', email: '', password: '', phone: '', role: 'viewer', allowed_companies: [] as string[], notifications_enabled: true });

  // Feedback
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const showMessage = (msg: string, type: 'success' | 'error' = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setToken(session.access_token);
        setCurrentUser({
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || session.user.email || '',
          role: '', // Se carga después desde el perfil
        });
      }
    });
  }, []);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        const me = data.users?.find((u: Profile) => u.id === currentUser?.id);
        if (me && currentUser) {
          setCurrentUser(prev => prev ? { ...prev, role: me.role } : prev);
        }
      }
    } catch (err) { console.error('Error loading users:', err); }
    setLoading(false);
  }, [token, currentUser?.id]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const isAdmin = currentUser?.role === 'admin';

  const saveEdit = async () => {
    if (!editingId || !token) return;
    try {
      const res = await fetch(`/api/users/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm),
      });
      if (res.ok) { showMessage('Usuario actualizado'); setEditingId(null); loadUsers(); }
      else { const d = await res.json(); showMessage(d.error || 'Error al actualizar', 'error'); }
    } catch { showMessage('Error de conexión', 'error'); }
  };

  const createUser = async () => {
    if (!token) return;
    if (!newForm.name || !newForm.email || !newForm.password) { showMessage('Nombre, email y contraseña son obligatorios', 'error'); return; }
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newForm),
      });
      if (res.ok) {
        showMessage('Usuario creado');
        setShowNew(false);
        setNewForm({ name: '', email: '', password: '', phone: '', role: 'viewer', allowed_companies: [], notifications_enabled: true });
        loadUsers();
      } else { const d = await res.json(); showMessage(d.error || 'Error al crear', 'error'); }
    } catch { showMessage('Error de conexión', 'error'); }
  };

  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar al usuario "${name}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { showMessage('Usuario eliminado'); loadUsers(); }
      else { const d = await res.json(); showMessage(d.error || 'Error al eliminar', 'error'); }
    } catch { showMessage('Error de conexión', 'error'); }
  };

  const startEdit = (user: Profile) => {
    setEditingId(user.id);
    setEditForm({ name: user.name, email: user.email, phone: user.phone || '', role: user.role, allowed_companies: user.allowed_companies || [], notifications_enabled: user.notifications_enabled });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ajustes</h1>
        <p className="text-sm text-gray-500">Configuración y gestión de usuarios</p>
      </div>

      {message && (
        <div className={cn('rounded-lg px-4 py-2.5 text-sm font-medium', messageType === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
          {message}
        </div>
      )}

      {/* Mi perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="h-4 w-4" />Mi perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-lg font-bold">
              {currentUser?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{currentUser?.name || '—'}</p>
              <p className="text-sm text-gray-500">{currentUser?.email || '—'}</p>
            </div>
            <Badge variant={currentUser?.role === 'admin' ? 'info' : 'default'}>
              {ROLES.find(r => r.value === currentUser?.role)?.label || currentUser?.role}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Notificaciones WhatsApp — visible para todos los usuarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notificaciones WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          {token ? (
            <NotificationPreferences token={token} />
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">Cargando...</p>
          )}
        </CardContent>
      </Card>

      {/* Gestión de usuarios (solo admin) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" />Usuarios</CardTitle>
              <Button size="sm" onClick={() => setShowNew(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />Añadir
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Formulario nuevo usuario */}
            {showNew && (
              <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Nuevo usuario</h3>
                  <button type="button" onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="text" placeholder="Nombre completo" value={newForm.name}
                    onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
                  <input type="email" placeholder="Email" value={newForm.email}
                    onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} className={inputClass} />
                  <input type="password" placeholder="Contraseña temporal" value={newForm.password}
                    onChange={e => setNewForm(f => ({ ...f, password: e.target.value }))} className={inputClass} />
                  <input type="tel" placeholder="Teléfono (opcional)" value={newForm.phone}
                    onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))} className={inputClass} />
                  <select value={newForm.role} onChange={e => setNewForm(f => ({ ...f, role: e.target.value }))} className={inputClass}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <CompanyMultiSelect selected={newForm.allowed_companies} onChange={c => setNewForm(f => ({ ...f, allowed_companies: c }))} />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={newForm.notifications_enabled}
                      onChange={e => setNewForm(f => ({ ...f, notifications_enabled: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                    WhatsApp
                  </label>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>Cancelar</Button>
                    <Button size="sm" onClick={createUser}>Crear usuario</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de usuarios como cards */}
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
            ) : users.length > 0 ? (
              <div className="space-y-3">
                {users.map(user => {
                  const isEditing = editingId === user.id;
                  const isMe = user.id === currentUser?.id;
                  const role = ROLES.find(r => r.value === user.role);
                  const companyCount = user.allowed_companies?.length || 0;

                  /* ── Modo edición ── */
                  if (isEditing) {
                    return (
                      <div key={user.id} className="rounded-xl border-2 border-blue-300 bg-blue-50/30 p-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Nombre</label>
                            <input type="text" value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                              className={inputClass} placeholder="Nombre completo" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
                            <input type="email" value={editForm.email || ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                              className={inputClass} placeholder="Email" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Teléfono</label>
                            <input type="tel" value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                              className={inputClass} placeholder="Teléfono" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Rol</label>
                            <select value={editForm.role || 'viewer'} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                              className={inputClass}>
                              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Empresas permitidas</label>
                            <CompanyMultiSelect selected={editForm.allowed_companies || []} onChange={c => setEditForm(f => ({ ...f, allowed_companies: c }))} />
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input type="checkbox" checked={editForm.notifications_enabled ?? true}
                              onChange={e => setEditForm(f => ({ ...f, notifications_enabled: e.target.checked }))}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                            WhatsApp
                          </label>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                            <Button size="sm" onClick={saveEdit}>
                              <Check className="h-3.5 w-3.5 mr-1" />Guardar
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  /* ── Modo vista ── */
                  return (
                    <div key={user.id} className="group rounded-xl border border-gray-100 bg-white p-4 hover:border-gray-200 hover:shadow-sm transition-all">
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold">
                          {user.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900">{user.name}</span>
                            {isMe && <span className="text-xs text-gray-400">(tú)</span>}
                            <Badge variant={role?.color || 'default'}>
                              <Shield className="h-3 w-3 mr-0.5" />
                              {role?.label || user.role}
                            </Badge>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </span>
                            {user.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {user.phone}
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {/* Empresas */}
                            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                              companyCount === 0 ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-700'
                            )}>
                              <Building2 className="h-3 w-3" />
                              {companyCount === 0 ? 'Todas las empresas' : `${companyCount} empresas`}
                            </span>

                            {/* WhatsApp */}
                            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                              user.notifications_enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'
                            )}>
                              <MessageCircle className="h-3 w-3" />
                              WA {user.notifications_enabled ? 'on' : 'off'}
                            </span>
                          </div>
                        </div>

                        {/* Acciones */}
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button type="button" onClick={() => startEdit(user)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-blue-600" title="Editar">
                            <Pencil className="h-4 w-4" />
                          </button>
                          {!isMe && (
                            <button type="button" onClick={() => deleteUser(user.id, user.name)}
                              className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Eliminar">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No hay usuarios</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Estado del Bot */}
      <BotStatusCard />

      {/* Info del sistema */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-xs text-gray-400">
            <span>Grupo Samarluan v1.0</span>
            <span>Conectado a Odoo v17 — samarluan.odoo.com</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
