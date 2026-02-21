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

/** PUT /api/users/[id] — Actualizar perfil de usuario */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { name, email, phone, role, allowed_companies, notifications_enabled } = body;

    const sb = createServerClient();

    // Actualizar perfil
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone || null;
    if (role !== undefined) updateData.role = role;
    if (allowed_companies !== undefined) updateData.allowed_companies = allowed_companies;
    if (notifications_enabled !== undefined) updateData.notifications_enabled = notifications_enabled;

    const { error } = await sb
      .from('profiles')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error updating profile:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Si cambió el email, actualizar también en auth.users
    if (email) {
      await sb.auth.admin.updateUserById(id, { email });
    }

    // Si cambió el nombre, actualizar metadata
    if (name) {
      await sb.auth.admin.updateUserById(id, { user_metadata: { name } });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('API users PUT error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/** DELETE /api/users/[id] — Eliminar usuario */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await params;

    // No permitir que el admin se elimine a sí mismo
    if (id === auth.userId) {
      return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 });
    }

    const sb = createServerClient();

    // Eliminar de auth.users (cascade elimina el profile)
    const { error } = await sb.auth.admin.deleteUser(id);

    if (error) {
      console.error('Error deleting user:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('API users DELETE error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
