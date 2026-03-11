import { NextRequest, NextResponse } from 'next/server';
import { execute, executeStatic, resolveCompanies, round2 } from '@/lib/odoo';
import { requireAuth } from '@/lib/auth';

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

    // PERF: Bank account IDs are semi-static — use long-lived cache
    const bankAccounts = (await executeStatic('account.account', 'search_read', [
      [['account_type', '=', 'asset_cash']],
    ], { fields: ['id'] })) as Array<{ id: number }>;

    const bankIds = bankAccounts.map(acc => acc.id);

    // PERF: Execute both balance queries in parallel
    const [preBalanceGroups, monthlyGroups] = await Promise.all([
      // Cumulative balance before date_from
      execute('account.move.line', 'read_group', [
        [
          ['account_id', 'in', bankIds],
          ['parent_state', '=', 'posted'],
          ['date', '<', date_from],
          ...companyDomain,
        ],
        ['balance'],
        [],
      ], { lazy: false }) as Promise<Array<{ balance: number }>>,

      // Monthly balances within range
      execute('account.move.line', 'read_group', [
        [
          ['account_id', 'in', bankIds],
          ['parent_state', '=', 'posted'],
          ['date', '>=', date_from],
          ['date', '<=', date_to],
          ...companyDomain,
        ],
        ['balance'],
        ['date:month'],
      ], { lazy: false }) as Promise<Array<{ balance: number; 'date:month': string; __domain: unknown[] }>>,
    ]);

    let cumBalance = preBalanceGroups[0]?.balance || 0;

    // Build monthly map
    const monthBalanceMap = new Map<string, number>();
    for (const monthGroup of monthlyGroups) {
      // date:month returns "Month YYYY" format like "January 2025"
      // We need to map this to our iteration
      monthBalanceMap.set(monthGroup['date:month'], monthGroup.balance || 0);
    }

    // Calcular balance acumulado mes a mes
    const start = new Date(date_from);
    const end = new Date(date_to);
    const data: { fecha: string; valor: number }[] = [];
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const current = new Date(start.getFullYear(), start.getMonth(), 1);

    while (current <= end) {
      const enKey = `${monthNamesEn[current.getMonth()]} ${current.getFullYear()}`;
      const monthBalance = monthBalanceMap.get(enKey) || 0;
      cumBalance += monthBalance;

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
