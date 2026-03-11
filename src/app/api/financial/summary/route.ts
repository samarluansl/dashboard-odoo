import { NextRequest, NextResponse } from 'next/server';
import { execute, executeStatic, resolveCompanies, round2 } from '@/lib/odoo';
import { requireAuth } from '@/lib/auth';
import { classifyPGC, type AccountInfo, type GroupEntry } from '@/lib/classify-pgc';
import { isValidDate } from '@/lib/validation';

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

    // FIX: Validate date format to prevent injection via Odoo domains
    if (!isValidDate(date_from) || !isValidDate(date_to)) {
      return NextResponse.json({ error: 'Formato de fecha inválido. Usar YYYY-MM-DD' }, { status: 400 });
    }

    const { label, domain: companyDomain, error } = await resolveCompanies(company_name);
    if (error) return NextResponse.json({ error }, { status: 404 });

    // PERF: Account types are semi-static — use long-lived cache (10 min)
    const plTypes = ['income', 'income_other', 'expense', 'expense_depreciation', 'expense_direct_cost'];
    const accounts = (await executeStatic('account.account', 'search_read', [
      [['account_type', 'in', plTypes]],
    ], { fields: ['id', 'code', 'name', 'account_type'] })) as AccountInfo[];

    const accountIds = accounts.map(acc => acc.id);

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
    )) as GroupEntry[];

    // Clasificar por PGC (centralizado)
    const { ingExpl, gasExpl, ingFin, gasFin } = classifyPGC(groups, accounts);

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
