import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompanies, round2 } from '@/lib/odoo';

export async function GET(req: NextRequest) {
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

    // Odoo 17: subscription_state usa prefijos numéricos:
    // '3_progress' (activa), '4_paused', '5_close' (cerrada), '6_churn' (baja), '1_draft', '2_renewal'
    const ACTIVE_STATES = ['3_progress', '4_paused'];
    const CHURN_STATES = ['5_close', '6_churn'];

    // Suscripciones activas
    const activeDomain: unknown[] = [
      ['is_subscription', '=', true],
      ['subscription_state', 'in', ACTIVE_STATES],
      ...companyDomain,
    ];

    const activas = (await execute('sale.order', 'search_count', [activeDomain])) as number;

    // MRR (recurring_monthly) — solo las activas en progreso
    const mrrDomain: unknown[] = [
      ['is_subscription', '=', true],
      ['subscription_state', '=', '3_progress'],
      ...companyDomain,
    ];

    const mrrGroups = (await execute('sale.order', 'read_group',
      [mrrDomain, ['recurring_monthly'], []], { lazy: false }
    )) as Array<Record<string, unknown>>;

    const mrr = (mrrGroups[0]?.recurring_monthly as number) || 0;

    // Nuevas en el período (fecha de inicio de suscripción en rango)
    const nuevasDomain: unknown[] = [
      ['is_subscription', '=', true],
      ['subscription_state', 'in', ACTIVE_STATES],
      ['date_order', '>=', date_from],
      ['date_order', '<=', date_to],
      ...companyDomain,
    ];

    const nuevas = (await execute('sale.order', 'search_count', [nuevasDomain])) as number;

    // Bajas (churned/closed) en el período
    // Usamos end_date (fecha real de baja) en vez de date_order (fecha de creación)
    const bajasDomain: unknown[] = [
      ['is_subscription', '=', true],
      ['subscription_state', 'in', CHURN_STATES],
      ['end_date', '>=', date_from],
      ['end_date', '<=', date_to],
      ...companyDomain,
    ];

    let bajas: number;
    try {
      bajas = (await execute('sale.order', 'search_count', [bajasDomain])) as number;
    } catch {
      // Fallback: si end_date no existe en este Odoo, intentar con write_date
      const bajasFallbackDomain: unknown[] = [
        ['is_subscription', '=', true],
        ['subscription_state', 'in', CHURN_STATES],
        ['write_date', '>=', date_from],
        ['write_date', '<=', date_to],
        ...companyDomain,
      ];
      bajas = (await execute('sale.order', 'search_count', [bajasFallbackDomain])) as number;
    }

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
