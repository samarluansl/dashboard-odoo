import { NextRequest, NextResponse } from 'next/server';
import { execute, executeStatic, resolveCompanies, round2 } from '@/lib/odoo';
import { requireAuth } from '@/lib/auth';
import { CHART_COLORS } from '@/lib/constants';

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

    const { domain: companyDomain, error } = await resolveCompanies(company_name);
    if (error) return NextResponse.json({ error }, { status: 404 });

    // PERF: Income account IDs are semi-static — use long-lived cache
    const incomeAccounts = (await executeStatic('account.account', 'search_read', [
      [['account_type', 'in', ['income', 'income_other']]],
    ], { fields: ['id'] })) as Array<{ id: number }>;

    const incomeIds = incomeAccounts.map(acc => acc.id);

    // Agrupar ingresos por empresa
    const groups = (await execute('account.move.line', 'read_group', [
      [
        ['account_id', 'in', incomeIds],
        ['parent_state', '=', 'posted'],
        ['date', '>=', date_from],
        ['date', '<=', date_to],
        ...companyDomain,
      ],
      ['balance'],
      ['company_id'],
    ], { lazy: false })) as Array<{ company_id: [number, string]; balance: number }>;

    const companyRevenues = groups
      .map((group, index) => ({
        name: group.company_id?.[1] || 'Desconocida',
        value: round2(Math.abs(group.balance || 0)),
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
      .filter(company => company.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return NextResponse.json({ data: companyRevenues });
  } catch (err) {
    console.error('API top-companies error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
