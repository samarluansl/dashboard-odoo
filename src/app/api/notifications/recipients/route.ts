import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { timingSafeEqual } from '@/lib/validation';
import { ALERT_TYPES } from '@/lib/alert-types';

// Pre-compute valid alert type values for fast lookup
const VALID_ALERT_TYPES = new Set(ALERT_TYPES.map(a => a.value));

/**
 * GET /api/notifications/recipients?alert_type=daily_summary
 * Devuelve la lista de usuarios que tienen activa esa notificación.
 * Usado por el bot de WhatsApp para saber a quién enviar cada alerta.
 * Requiere service role key o API secret para autenticación.
 */
export async function GET(req: NextRequest) {
  // FIX: Timing-safe comparison to prevent timing attacks on bot secret
  const botSecret = req.headers.get('x-bot-secret') || '';
  const expectedSecret = process.env.BOT_API_SECRET || '';
  if (!expectedSecret || !botSecret || !timingSafeEqual(botSecret, expectedSecret)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const alertType = req.nextUrl.searchParams.get('alert_type');
  if (!alertType) {
    return NextResponse.json({ error: 'Se requiere alert_type' }, { status: 400 });
  }

  // FIX: Validate alert_type against known types to prevent arbitrary DB queries
  if (!VALID_ALERT_TYPES.has(alertType)) {
    return NextResponse.json({ error: 'Tipo de alerta no válido' }, { status: 400 });
  }

  const sb = createServerClient();

  // Buscar usuarios que tienen esta alerta activada Y notificaciones habilitadas
  const { data: prefRows, error } = await sb
    .from('notification_preferences')
    .select(`
      user_id,
      profiles!inner (
        name,
        phone,
        notifications_enabled
      )
    `)
    .eq('alert_type', alertType)
    .eq('enabled', true);

  if (error) {
    console.error('API recipients GET error:', error);
    return NextResponse.json({ error: 'Error al obtener destinatarios' }, { status: 500 });
  }

  // Filtrar solo los que tienen notifications_enabled=true Y teléfono
  interface PrefRow {
    user_id: string;
    profiles: {
      name: string;
      phone: string | null;
      notifications_enabled: boolean;
    };
  }

  const recipients = (prefRows as unknown as PrefRow[] || [])
    .filter(row => row.profiles?.notifications_enabled && row.profiles?.phone)
    .map(row => ({
      name: row.profiles.name,
      phone: row.profiles.phone,
    }));

  return NextResponse.json({ recipients });
}
