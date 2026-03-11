/**
 * @deprecated DEAD CODE — This file is NOT active as middleware.
 * Authentication is handled inside each API route via requireAuth/requireAdmin.
 * To activate, move to src/middleware.ts.
 *
 * TODO: Remove this file if middleware-based auth is not planned.
 * Keeping dead code increases maintenance burden without providing value.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API routes: verify Bearer token
  if (pathname.startsWith('/api/')) {
    // Allow public endpoints without auth
    const publicPaths = ['/api/auth/callback'];
    if (publicPaths.some(p => pathname.startsWith(p))) {
      return NextResponse.next();
    }

    // Allow bot-secret authenticated endpoints
    if (pathname === '/api/notifications/recipients' && req.headers.get('x-bot-secret')) {
      return NextResponse.next();
    }

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Validate token with Supabase
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );
      const { error } = await supabase.auth.getUser(token);
      if (error) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: 'Error de autenticación' }, { status: 500 });
    }

    return NextResponse.next();
  }

  // Dashboard pages: check for Supabase auth cookie/session
  // The actual session check happens client-side in (dashboard)/layout.tsx
  // Middleware just passes through for pages
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Proteger todo excepto archivos estáticos y _next
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
