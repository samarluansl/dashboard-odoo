import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/** Resultado exitoso de requireAuth */
export interface AuthSuccess {
  user: import('@supabase/supabase-js').User;
}

/** Resultado con error de requireAuth */
export interface AuthError {
  error: NextResponse;
}

/** Resultado exitoso de requireAdmin (extiende AuthSuccess con userId) */
export interface AdminSuccess extends AuthSuccess {
  userId: string;
}

/**
 * Validate Bearer token from request and return the authenticated user.
 * Uses the Supabase service role client for reliable server-side validation.
 * Returns { user } on success or { error: NextResponse } on failure.
 */
export async function requireAuth(req: NextRequest): Promise<AuthSuccess | AuthError> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }

  const sb = createServerClient();
  const { data: { user }, error } = await sb.auth.getUser(token);

  if (error || !user) {
    return { error: NextResponse.json({ error: 'Token inválido' }, { status: 401 }) };
  }

  return { user };
}

/**
 * Validate Bearer token and require admin role.
 * Used by user management endpoints.
 * Returns { user, userId } on success or { error: NextResponse } on failure.
 */
export async function requireAdmin(req: NextRequest): Promise<AdminSuccess | AuthError> {
  const authResult = await requireAuth(req);
  if ('error' in authResult) return authResult;

  const sb = createServerClient();
  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', authResult.user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Solo administradores' }, { status: 403 }) };
  }

  return { user: authResult.user, userId: authResult.user.id };
}
