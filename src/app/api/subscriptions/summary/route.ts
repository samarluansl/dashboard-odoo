import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompanies, round2 } from '@/lib/odoo';
import { requireAuth } from '@/lib/auth';
import { ACTIVE_SUBSCRIPTION_STATES, CHURN_SUBSCRIPTION_STATES } from '@/lib/subscription-states';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = req.nextUrl;
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');
    const company_name = searchParams.get('company') || undefined;

    if (!date_from || !date_to) {
      return NextResponse.json({ error: 'date_from y date_to son obligatorios' }, { status: 400 });
    }

    const { label, domain: companyDomain, error } = await resolveCompanies(company_name);
    if (error) return NextResponse.json({ error }, { status: 404 });

    // Build all domains upfront
    const activeDomain: unknown[] = [
      ['is_subscription', '=', true],
      ['subscription_state', 'in', ACTIVE_SUBSCRIPTION_STATES],
      ...companyDomain,
    ];

    const mrrDomain: unknown[] = [
      ['is_subscription', '=', true],
      ['subscription_state', '=', '3_progress'],
      ...companyDomain,
    ];

    const nuevasDomain: unknown[] = [
      ['is_subscription', '=', true],
      ['subscription_state', 'in', ACTIVE_SUBSCRIPTION_STATES],
      ['date_order', '>=', date_from],
      ['date_order', '<=', date_to],
      ...companyDomain,
    ];

    const bajasDomain: unknown[] = [
      ['is_subscription', '=', true],
      ['subscription_state', 'in', CHURN_SUBSCRIPTION_STATES],
      ['end_date', '>=', date_from],
      ['end_date', '<=', date_to],
      ...companyDomain,
    ];

    // PERF: Execute all 4 queries in parallel
    const [activas, mrrGroups, nuevas, bajasResult] = await Promise.all([
      execute('sale.order', 'search_count', [activeDomain]) as Promise<number>,
      execute('sale.order', 'read_group',
        [mrrDomain, ['recurring_monthly'], []], { lazy: false }
      ) as Promise<Array<Record<string, unknown>>>,
      execute('sale.order', 'search_count', [nuevasDomain]) as Promise<number>,
      (async () => {
        try {
          return (await execute('sale.order', 'search_count', [bajasDomain])) as number;
        } catch {
          const bajasFallbackDomain: unknown[] = [
            ['is_subscription', '=', true],
            ['subscription_state', 'in', CHURN_SUBSCRIPTION_STATES],
            ['write_date', '>=', date_from],
            ['write_date', '<=', date_to],
            ...companyDomain,
          ];
          return (await execute('sale.order', 'search_count', [bajasFallbackDomain])) as number;
        }
      })(),
    ]);

    const mrr = (mrrGroups[0]?.recurring_monthly as number) || 0;
    const bajas = bajasResult;

    // Churn rate
    const churn_rate = activas > 0 ? round2((bajas / (activas + bajas)) * 100) : 0;

    return NextResponse.json({
      empresa: label,
      mrr: round2(mrr),
      activas,
      nuevas,
      bajas,
      churn_rate,
    });
  } catch (err) {
    console.error('API subscriptions/summary error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
