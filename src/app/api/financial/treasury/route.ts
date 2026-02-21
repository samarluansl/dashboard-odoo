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

    // Cuentas de tesorería
    const bankAccounts = (await execute('account.account', 'search_read', [
      [['account_type', '=', 'asset_cash']],
    ], { fields: ['id'] })) as Array<{ id: number }>;

    const bankIds = bankAccounts.map(a => a.id);

    // Generar puntos mes a mes
    const start = new Date(date_from);
    const end = new Date(date_to);
    const data: { fecha: string; valor: number }[] = [];

    const current = new Date(start.getFullYear(), start.getMonth(), 1);

    while (current <= end) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
      const monthEnd = `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(lastDay)}`;

      const domain: unknown[] = [
        ['account_id', 'in', bankIds],
        ['parent_state', '=', 'posted'],
        ['date', '<=', monthEnd],
        ...companyDomain,
      ];

      const groups = (await execute('account.move.line', 'read_group',
        [domain, ['balance'], ['account_id']], { lazy: false }
      )) as Array<{ balance: number }>;

      const total = groups.reduce((s, g) => s + (g.balance || 0), 0);

      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      data.push({
        fecha: `${monthNames[current.getMonth()]} ${current.getFullYear().toString().slice(2)}`,
        valor: round2(total),
      });

      current.setMonth(current.getMonth() + 1);
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('API treasury error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
