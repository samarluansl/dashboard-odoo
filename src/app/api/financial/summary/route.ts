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

    // Obtener todas las cuentas P&L
    const plTypes = ['income', 'income_other', 'expense', 'expense_depreciation', 'expense_direct_cost'];
    const accounts = (await execute('account.account', 'search_read', [
      [['account_type', 'in', plTypes]],
    ], { fields: ['id', 'code', 'name', 'account_type'] })) as Array<{
      id: number; code: string; name: string; account_type: string;
    }>;

    const accountIds = accounts.map(a => a.id);

    // Obtener saldos agrupados por cuenta
    const lineDomain: unknown[] = [
      ['account_id', 'in', accountIds],
      ['parent_state', '=', 'posted'],
      ['date', '>=', date_from],
      ['date', '<=', date_to],
      ...companyDomain,
    ];

    const groups = (await execute('account.move.line', 'read_group',
      [lineDomain, ['balance'], ['account_id']], { lazy: false }
    )) as Array<{ account_id: [number, string]; balance: number }>;

    // Clasificar por PGC
    let ingExpl = 0, gasExpl = 0, ingFin = 0, gasFin = 0;
    for (const g of groups) {
      const accId = g.account_id?.[0];
      const acc = accounts.find(a => a.id === accId);
      if (!acc) continue;
      const code = acc.code;
      const c1 = code.charAt(0);
      const c2 = code.substring(0, 2);
      const balance = g.balance || 0;

      if (c1 === '7') {
        const c3 = code.substring(0, 3);
        if (['76', '77'].some(p => c2.startsWith(p)) || c3 === '769') {
          if (balance < 0) ingFin += Math.abs(balance);
          else gasFin += balance;
        } else {
          if (balance < 0) ingExpl += Math.abs(balance);
          else gasExpl += balance;
        }
      } else if (c1 === '6') {
        if (['66', '67'].some(p => c2.startsWith(p))) {
          if (balance > 0) gasFin += balance;
          else ingFin += Math.abs(balance);
        } else {
          if (balance > 0) gasExpl += balance;
          else ingExpl += Math.abs(balance);
        }
      }
    }

    return NextResponse.json({
      empresa: label,
      periodo: `${date_from} a ${date_to}`,
      explotacion: {
        ingresos: round2(ingExpl),
        gastos: round2(-gasExpl),
        resultado: round2(ingExpl - gasExpl),
      },
      financiero: {
        ingresos: round2(ingFin),
        gastos: round2(-gasFin),
        resultado: round2(ingFin - gasFin),
      },
      resultado_antes_impuestos: round2(ingExpl - gasExpl + ingFin - gasFin),
    });
  } catch (err) {
    console.error('API financial/summary error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
