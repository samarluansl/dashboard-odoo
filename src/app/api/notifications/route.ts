import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { ALERT_TYPES } from '@/lib/alert-types';

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

  // Cargar preferencias existentes
  const { data: prefs, error } = await sb
    .from('notification_preferences')
    .select('alert_type, enabled')
    .eq('user_id', user.id);

  if (error) {
    console.error('API notifications GET error:', error);
    return NextResponse.json({ error: 'Error al obtener preferencias' }, { status: 500 });
  }

  // Construir mapa: alert_type → enabled (si no existe, false por defecto)
  const prefsMap: Record<string, boolean> = {};
  for (const at of ALERT_TYPES) {
    const found = prefs?.find(p => p.alert_type === at.value);
    prefsMap[at.value] = found ? found.enabled : false;
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
    const { preferences } = body as { preferences: Record<string, boolean> };

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json({ error: 'Se requiere un objeto preferences' }, { status: 400 });
    }

    const sb = createServerClient();
    const validTypes = ALERT_TYPES.map(a => a.value);

    // Upsert cada preferencia
    const upserts = Object.entries(preferences)
      .filter(([key]) => validTypes.includes(key))
      .map(([alert_type, enabled]) => ({
        user_id: user.id,
        alert_type,
        enabled,
        updated_at: new Date().toISOString(),
      }));

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
