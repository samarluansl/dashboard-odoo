import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';

/** Verificar que el usuario autenticado es admin */
async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) return { error: 'No autorizado', status: 401 };

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { error: 'Token inválido', status: 401 };

  const sb = createServerClient();
  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return { error: 'Solo administradores', status: 403 };
  }

  return { userId: user.id };
}

/** GET /api/users — Listar todos los usuarios */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const sb = createServerClient();
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('API users GET error:', error);
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 });
  }

  return NextResponse.json({ users: data });
}

/** POST /api/users — Crear nuevo usuario */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { name, email, password, phone, role, allowed_companies, notifications_enabled } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nombre, email y contraseña son obligatorios' }, { status: 400 });
    }

    const sb = createServerClient();

    // Crear usuario en auth.users
    const { data: authData, error: authError } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // Actualizar perfil (el trigger lo crea, pero actualizamos campos extra)
    // Pequeño delay para que el trigger de Supabase haya creado la fila
    await new Promise(r => setTimeout(r, 500));

    // Intentar update; si falla (trigger no ejecutado aún), hacer upsert
    const profileData = {
      name,
      phone: phone || null,
      role: role || 'viewer',
      allowed_companies: allowed_companies || [],
      notifications_enabled: notifications_enabled ?? true,
    };

    const { error: profileError } = await sb
      .from('profiles')
      .update(profileData)
      .eq('id', authData.user.id);

    if (profileError) {
      // Fallback: insertar directamente si el trigger no creó la fila
      await sb.from('profiles').upsert({
        id: authData.user.id,
        email,
        ...profileData,
      });
    }

    return NextResponse.json({ success: true, user_id: authData.user.id });
  } catch (err) {
    console.error('API users POST error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
