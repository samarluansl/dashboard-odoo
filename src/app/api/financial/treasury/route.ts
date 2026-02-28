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

    // Una sola llamada: todas las líneas hasta date_to (sin límite inferior para balance acumulado correcto)
    const allLines = (await execute('account.move.line', 'search_read', [
      [
        ['account_id', 'in', bankIds],
        ['parent_state', '=', 'posted'],
        ['date', '<=', date_to],
        ...companyDomain,
      ],
    ], { fields: ['date', 'balance'], order: 'date asc', limit: 0 })) as Array<{ date: string; balance: number }>;

    // Calcular balance acumulado mes a mes en JS (sin llamadas adicionales a Odoo)
    const start = new Date(date_from);
    const end = new Date(date_to);
    const data: { fecha: string; valor: number }[] = [];
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const pad = (n: number) => String(n).padStart(2, '0');
    let lineIdx = 0;
    let cumBalance = 0;
    const current = new Date(start.getFullYear(), start.getMonth(), 1);

    while (current <= end) {
      const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
      const monthEnd = `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(lastDay)}`;

      // Avanzar líneas ordenadas hasta el fin de mes
      while (lineIdx < allLines.length && allLines[lineIdx].date <= monthEnd) {
        cumBalance += allLines[lineIdx].balance || 0;
        lineIdx++;
      }

      data.push({
        fecha: `${monthNames[current.getMonth()]} ${current.getFullYear().toString().slice(2)}`,
        valor: round2(cumBalance),
      });

      current.setMonth(current.getMonth() + 1);
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('API treasury error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
