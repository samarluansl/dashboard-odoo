import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function proxy(req: NextRequest) {
  const res = NextResponse.next();

  // La autenticación de páginas se gestiona client-side en (dashboard)/layout.tsx
  // que usa supabase.auth.getSession() desde localStorage.
  // El middleware solo añade headers de seguridad (configurados en next.config.ts).

  // Para API routes: verificar el token Bearer si existe
  // (las API routes ya verifican auth internamente con Supabase service role)

  return res;
}

export const config = {
  matcher: [
    // Proteger todo excepto archivos estáticos y _next
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
