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

    // Empleados activos
    const empDomain: unknown[] = [['active', '=', true], ...companyDomain];

    const empleados_activos = (await execute('hr.employee', 'search_count', [empDomain])) as number;

    // Nuevas altas en el período (create_date o first_contract_date)
    const altasDomain: unknown[] = [
      ['active', 'in', [true, false]],
      '|',
      '&', ['first_contract_date', '>=', date_from], ['first_contract_date', '<=', date_to],
      '&', ['first_contract_date', '=', false],
      '&', ['create_date', '>=', date_from + ' 00:00:00'], ['create_date', '<=', date_to + ' 23:59:59'],
      ...companyDomain,
    ];

    const nuevas_altas = (await execute('hr.employee', 'search_count', [altasDomain])) as number;

    // Horas registradas en el período
    const horasDomain: unknown[] = [
      ['date', '>=', date_from],
      ['date', '<=', date_to],
      ['project_id', '!=', false],
      ...companyDomain,
    ];

    const horasGroups = (await execute('account.analytic.line', 'read_group',
      [horasDomain, ['unit_amount'], []], { lazy: false }
    )) as Array<{ unit_amount: number }>;

    const horas_mes = horasGroups[0]?.unit_amount || 0;

    // Coste de nómina (cuentas 640x)
    const nominaAccounts = (await execute('account.account', 'search_read', [
      [['code', '=like', '640%']],
    ], { fields: ['id'] })) as Array<{ id: number }>;

    const nominaIds = nominaAccounts.map(a => a.id);
    const nominaDomain: unknown[] = [
      ['account_id', 'in', nominaIds],
      ['parent_state', '=', 'posted'],
      ['date', '>=', date_from],
      ['date', '<=', date_to],
      ...companyDomain,
    ];

    const nominaGroups = (await execute('account.move.line', 'read_group',
      [nominaDomain, ['debit'], ['account_id']], { lazy: false }
    )) as Array<{ debit: number }>;

    const coste_nomina = nominaGroups.reduce((s, g) => s + (g.debit || 0), 0);

    return NextResponse.json({
      empresa: label,
      empleados_activos,
      nuevas_altas,
      horas_mes: round2(horas_mes),
      coste_nomina: round2(coste_nomina),
    });
  } catch (err) {
    console.error('API hr/summary error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
