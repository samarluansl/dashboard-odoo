import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') || '/';

  if (!code) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // FIX: Prevent open redirect — only allow relative paths starting with /
  const next = (rawNext.startsWith('/') && !rawNext.startsWith('//')) ? rawNext : '/';
  const redirectResponse = NextResponse.redirect(new URL(next, req.url));

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () =>
            req.cookies.getAll().map(cookie => ({ name: cookie.name, value: cookie.value })),
          setAll: (cookies) => {
            for (const { name, value, options } of cookies) {
              redirectResponse.cookies.set(name, value, options);
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

  return redirectResponse;
}
