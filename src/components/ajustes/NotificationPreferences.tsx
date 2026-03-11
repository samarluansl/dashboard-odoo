'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check, Clock, Calendar, Loader2 } from 'lucide-react';
import { ALERT_TYPES, FREQUENCY_OPTIONS, DAY_OPTIONS, type FrequencyOption } from '@/lib/alert-types';

interface AlertPref {
  enabled: boolean;
  frequency: FrequencyOption;
  preferred_day: number | null;
  preferred_time: string;
}

export function NotificationPreferences({ token }: { token: string }) {
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
                  <button
                    type="button"
                    onClick={() => toggleEnabled(alert.value)}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    <div className={cn(
                      'flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
                      enabled ? 'bg-emerald-500' : 'bg-gray-300',
                    )}>
                      <div className={cn(
                        'h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                        enabled ? 'translate-x-4' : 'translate-x-0',
                      )} />
                    </div>

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

                  {enabled && (
                    <div className="mt-2 ml-12 flex flex-wrap items-center gap-2">
                      <select
                        value={freq}
                        onChange={e => {
                          const newFreq = e.target.value as FrequencyOption;
                          updatePref(alert.value, 'frequency', newFreq);
                          if (newFreq === 'Diario' || newFreq === 'Mensual') {
                            updatePref(alert.value, 'preferred_day', null);
                          } else if (pref?.preferred_day == null) {
                            updatePref(alert.value, 'preferred_day', 0);
                          }
                        }}
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {FREQUENCY_OPTIONS.map(f => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>

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
