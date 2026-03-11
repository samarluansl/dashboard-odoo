import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { isValidUUID, isValidRole } from '@/lib/validation';

/** PUT /api/users/[id] — Actualizar perfil de usuario */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if ('error' in auth) return auth.error;

  try {
    const { id } = await params;

    // FIX: Validate UUID format to prevent injection
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'ID de usuario inválido' }, { status: 400 });
    }

    const body = await req.json();
    const { name, email, phone, role, allowed_companies, notifications_enabled } = body;

    // FIX: Validate role against whitelist
    if (role !== undefined && !isValidRole(role)) {
      return NextResponse.json({ error: 'Rol inválido. Valores permitidos: admin, manager, viewer' }, { status: 400 });
    }

    // FIX: Validate allowed_companies is an array of strings
    if (allowed_companies !== undefined && (!Array.isArray(allowed_companies) || !allowed_companies.every((c: unknown) => typeof c === 'string'))) {
      return NextResponse.json({ error: 'allowed_companies debe ser un array de strings' }, { status: 400 });
    }

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
  if ('error' in auth) return auth.error;

  try {
    const { id } = await params;

    // FIX: Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'ID de usuario inválido' }, { status: 400 });
    }

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
