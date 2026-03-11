'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
  User, Users, Plus, Pencil, Trash2, X,
  Check, Phone, Mail, Shield, MessageCircle,
  Bell,
} from 'lucide-react';
// FIX #20: Extracted components
import { BotStatusCard } from '@/components/ajustes/BotStatusCard';
import { CompanyMultiSelect } from '@/components/ajustes/CompanyMultiSelect';
import { NotificationPreferences } from '@/components/ajustes/NotificationPreferences';

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
          role: '',
        });
      }
    });
  }, []);

  const currentUserId = currentUser?.id;
  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const usersResponse = await res.json();
        setUsers(usersResponse.users || []);
        const me = usersResponse.users?.find((u: Profile) => u.id === currentUserId);
        if (me) {
          setCurrentUser(prev => prev ? { ...prev, role: me.role } : prev);
        }
      }
    } catch (err) { console.error('Error loading users:', err); }
    setLoading(false);
  }, [token, currentUserId]);

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
      else { const body = await res.json(); showMessage(body.error || 'Error al actualizar', 'error'); }
    } catch { showMessage('Error de conexion', 'error'); }
  };

  const createUser = async () => {
    if (!token) return;
    if (!newForm.name || !newForm.email || !newForm.password) { showMessage('Nombre, email y contrasena son obligatorios', 'error'); return; }
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
      } else { const body = await res.json(); showMessage(body.error || 'Error al crear', 'error'); }
    } catch { showMessage('Error de conexion', 'error'); }
  };

  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`Eliminar al usuario "${name}"? Esta accion no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { showMessage('Usuario eliminado'); loadUsers(); }
      else { const body = await res.json(); showMessage(body.error || 'Error al eliminar', 'error'); }
    } catch { showMessage('Error de conexion', 'error'); }
  };

  const startEdit = (user: Profile) => {
    setEditingId(user.id);
    setEditForm({ name: user.name, email: user.email, phone: user.phone || '', role: user.role, allowed_companies: user.allowed_companies || [], notifications_enabled: user.notifications_enabled });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ajustes</h1>
        <p className="text-sm text-gray-500">Configuracion y gestion de usuarios</p>
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
              <p className="font-semibold text-gray-900">{currentUser?.name || '\u2014'}</p>
              <p className="text-sm text-gray-500">{currentUser?.email || '\u2014'}</p>
            </div>
            <Badge variant={currentUser?.role === 'admin' ? 'info' : 'default'}>
              {ROLES.find(r => r.value === currentUser?.role)?.label || currentUser?.role}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Notificaciones WhatsApp */}
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

      {/* Gestion de usuarios (solo admin) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" />Usuarios</CardTitle>
              <Button size="sm" onClick={() => setShowNew(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />Anadir
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
                  <input type="password" placeholder="Contrasena temporal" value={newForm.password}
                    onChange={e => setNewForm(f => ({ ...f, password: e.target.value }))} className={inputClass} />
                  <input type="tel" placeholder="Telefono (opcional)" value={newForm.phone}
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
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Telefono</label>
                            <input type="tel" value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                              className={inputClass} placeholder="Telefono" />
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

                  return (
                    <div key={user.id} className="group rounded-xl border border-gray-100 bg-white p-4 hover:border-gray-200 hover:shadow-sm transition-all">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold">
                          {user.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900">{user.name}</span>
                            {isMe && <span className="text-xs text-gray-400">(tu)</span>}
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
                            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                              companyCount === 0 ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-700'
                            )}>
                              {companyCount === 0 ? 'Todas las empresas' : `${companyCount} empresas`}
                            </span>

                            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                              user.notifications_enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'
                            )}>
                              <MessageCircle className="h-3 w-3" />
                              WA {user.notifications_enabled ? 'on' : 'off'}
                            </span>
                          </div>
                        </div>

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
            <span>Conectado a Odoo v17 -- samarluan.odoo.com</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
