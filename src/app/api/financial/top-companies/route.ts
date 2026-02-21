import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompanies, round2 } from '@/lib/odoo';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#6366f1',
];

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

    // Obtener cuentas de ingreso (7x)
    const incomeAccounts = (await execute('account.account', 'search_read', [
      [['account_type', 'in', ['income', 'income_other']]],
    ], { fields: ['id'] })) as Array<{ id: number }>;

    const incomeIds = incomeAccounts.map(a => a.id);

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

    const data = groups
      .map((g, i) => ({
        name: g.company_id?.[1] || 'Desconocida',
        value: round2(Math.abs(g.balance || 0)),
        color: COLORS[i % COLORS.length],
      }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return NextResponse.json({ data });
  } catch (err) {
    console.error('API top-companies error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
