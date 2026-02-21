import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { ALERT_TYPES, type FrequencyOption } from '@/lib/alert-types';

/** Preferencia expandida con schedule */
export interface AlertPreference {
  enabled: boolean;
  frequency: FrequencyOption;
  preferred_day: number | null;
  preferred_time: string;
}

/** Obtener usuario autenticado */
async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/** GET /api/notifications — Preferencias del usuario autenticado */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const sb = createServerClient();

  // Cargar preferencias existentes (incluido campos de schedule)
  const { data: prefs, error } = await sb
    .from('notification_preferences')
    .select('alert_type, enabled, frequency, preferred_day, preferred_time')
    .eq('user_id', user.id);

  if (error) {
    console.error('API notifications GET error:', error);
    return NextResponse.json({ error: 'Error al obtener preferencias' }, { status: 500 });
  }

  // Construir mapa con defaults para cada alert type
  const prefsMap: Record<string, AlertPreference> = {};
  for (const at of ALERT_TYPES) {
    const found = prefs?.find(p => p.alert_type === at.value);
    prefsMap[at.value] = {
      enabled: found ? found.enabled : false,
      frequency: (found?.frequency && found.frequency !== 'default'
        ? found.frequency
        : at.frequency) as FrequencyOption,
      preferred_day: found?.preferred_day ?? (at.frequency === 'Semanal' ? 0 : null),
      preferred_time: found?.preferred_time ?? at.defaultTime,
    };
  }

  return NextResponse.json({ preferences: prefsMap });
}

/** PUT /api/notifications — Actualizar preferencias del usuario autenticado */
export async function PUT(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { preferences } = body as { preferences: Record<string, AlertPreference | boolean> };

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json({ error: 'Se requiere un objeto preferences' }, { status: 400 });
    }

    const sb = createServerClient();
    const validTypes = ALERT_TYPES.map(a => a.value);

    // Upsert cada preferencia
    const upserts = Object.entries(preferences)
      .filter(([key]) => validTypes.includes(key))
      .map(([alert_type, value]) => {
        const alertDef = ALERT_TYPES.find(a => a.value === alert_type)!;

        // Compatibilidad: si es boolean, solo toggle enabled
        if (typeof value === 'boolean') {
          return {
            user_id: user.id,
            alert_type,
            enabled: value,
            updated_at: new Date().toISOString(),
          };
        }

        // Objeto completo con schedule
        const freq = value.frequency || alertDef.frequency;
        return {
          user_id: user.id,
          alert_type,
          enabled: value.enabled,
          frequency: freq === alertDef.frequency ? 'default' : freq,
          preferred_day: (freq === 'Semanal' || freq === 'Quincenal')
            ? (value.preferred_day ?? 0)
            : null,
          preferred_time: value.preferred_time || alertDef.defaultTime,
          updated_at: new Date().toISOString(),
        };
      });

    if (upserts.length > 0) {
      const { error } = await sb
        .from('notification_preferences')
        .upsert(upserts, { onConflict: 'user_id,alert_type' });

      if (error) {
        console.error('API notifications PUT error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('API notifications PUT error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
