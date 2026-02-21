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

    const { domain: companyDomain, error } = await resolveCompanies(company_name);
    if (error) return NextResponse.json({ error }, { status: 404 });

    // Generar MRR mes a mes contando suscripciones activas en cada punto
    const start = new Date(date_from);
    const end = new Date(date_to);
    const data: { fecha: string; valor: number }[] = [];
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const current = new Date(start.getFullYear(), start.getMonth(), 1);

    while (current <= end) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
      const monthEnd = `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(lastDay)}`;

      // Suscripciones activas a final de mes
      const domain: unknown[] = [
        ['is_subscription', '=', true],
        ['subscription_state', '=', '3_progress'],
        ['date_order', '<=', monthEnd],
        ...companyDomain,
      ];

      const groups = (await execute('sale.order', 'read_group',
        [domain, ['recurring_monthly'], []], { lazy: false }
      )) as Array<{ recurring_monthly: number }>;

      const mrr = groups[0]?.recurring_monthly || 0;

      data.push({
        fecha: `${monthNames[current.getMonth()]} ${current.getFullYear().toString().slice(2)}`,
        valor: round2(mrr),
      });

      current.setMonth(current.getMonth() + 1);
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('API subscriptions/mrr-history error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
