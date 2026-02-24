import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('bot_status')
      .select('*')
      .eq('id', 1)
      .single();

    if (error || !data) {
      return NextResponse.json({ status: 'unknown', whatsapp_connected: false, odoo_connected: false });
    }

    // Si el último heartbeat fue hace más de 3 minutos, está offline
    const lastHeartbeat = data.last_heartbeat ? new Date(data.last_heartbeat) : null;
    const minutesSinceHeartbeat = lastHeartbeat
      ? (Date.now() - lastHeartbeat.getTime()) / 60000
      : 999;

    const effectiveStatus = minutesSinceHeartbeat > 3 ? 'offline' : data.status;

    return NextResponse.json({
      ...data,
      status: effectiveStatus,
      minutes_since_heartbeat: Math.round(minutesSinceHeartbeat),
    });
  } catch {
    return NextResponse.json({ status: 'unknown', whatsapp_connected: false, odoo_connected: false });
  }
}
