import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/';

  if (!code) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const res = NextResponse.redirect(new URL(next, req.url));

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () =>
            req.cookies.getAll().map(c => ({ name: c.name, value: c.value })),
          setAll: (cookies) => {
            for (const { name, value, options } of cookies) {
              res.cookies.set(name, value, options);
            }
          },
        },
      }
    );

    await supabase.auth.exchangeCodeForSession(code);
  } catch (err) {
    console.error('Auth callback error:', err);
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return res;
}
