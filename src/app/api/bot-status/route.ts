import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  try {
    // FIX #4: Use server client instead of anon client
    const sb = createServerClient();
    const { data: botStatus, error } = await sb
      .from('bot_status')
      .select('*')
      .eq('id', 1)
      .single();

    if (error || !botStatus) {
      return NextResponse.json({ status: 'unknown', whatsapp_connected: false, odoo_connected: false });
    }

    // Si el ultimo heartbeat supera el umbral, el bot se considera offline
    const HEARTBEAT_TIMEOUT_MINUTES = 3;
    const NO_HEARTBEAT_SENTINEL = 999;
    const lastHeartbeat = botStatus.last_heartbeat ? new Date(botStatus.last_heartbeat) : null;
    const minutesSinceHeartbeat = lastHeartbeat
      ? (Date.now() - lastHeartbeat.getTime()) / 60_000
      : NO_HEARTBEAT_SENTINEL;

    const effectiveStatus = minutesSinceHeartbeat > HEARTBEAT_TIMEOUT_MINUTES ? 'offline' : botStatus.status;

    return NextResponse.json({
      ...botStatus,
      status: effectiveStatus,
      minutes_since_heartbeat: Math.round(minutesSinceHeartbeat),
    });
  } catch {
    return NextResponse.json({ status: 'unknown', whatsapp_connected: false, odoo_connected: false });
  }
}
