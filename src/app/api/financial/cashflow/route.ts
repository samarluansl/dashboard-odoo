import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompanies, round2 } from '@/lib/odoo';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const company_name = searchParams.get('company') || undefined;

    const { label, domain: companyDomain, error } = await resolveCompanies(company_name);
    if (error) return NextResponse.json({ error }, { status: 404 });

    // ═══ TESORERÍA (cuentas 57x) ═══
    const bankAccounts = (await execute('account.account', 'search_read', [
      [['account_type', '=', 'asset_cash']],
    ], { fields: ['id'] })) as Array<{ id: number }>;

    const bankIds = bankAccounts.map(a => a.id);

    const treasuryDomain: unknown[] = [
      ['account_id', 'in', bankIds],
      ['parent_state', '=', 'posted'],
      ...companyDomain,
    ];

    const treasuryGroups = (await execute('account.move.line', 'read_group',
      [treasuryDomain, ['balance'], ['account_id']], { lazy: false }
    )) as Array<{ balance: number }>;

    const tesoreria = treasuryGroups.reduce((s, g) => s + (g.balance || 0), 0);

    // ═══ COBROS PENDIENTES ═══
    const cobroDomain: unknown[] = [
      ['move_type', 'in', ['out_invoice', 'out_refund']],
      ['state', '=', 'posted'],
      ['payment_state', 'in', ['not_paid', 'partial']],
      ...companyDomain,
    ];

    const cobros = (await execute('account.move', 'search_read',
      [cobroDomain], { fields: ['amount_residual'] }
    )) as Array<{ amount_residual: number }>;

    const cobros_pendientes = cobros.reduce((s, c) => s + (c.amount_residual || 0), 0);

    // ═══ PAGOS PENDIENTES ═══
    const pagoDomain: unknown[] = [
      ['move_type', 'in', ['in_invoice', 'in_refund']],
      ['state', '=', 'posted'],
      ['payment_state', 'in', ['not_paid', 'partial']],
      ...companyDomain,
    ];

    const pagos = (await execute('account.move', 'search_read',
      [pagoDomain], { fields: ['amount_residual'] }
    )) as Array<{ amount_residual: number }>;

    const pagos_pendientes = pagos.reduce((s, p) => s + (p.amount_residual || 0), 0);

    return NextResponse.json({
      empresa: label,
      tesoreria: round2(tesoreria),
      cobros_pendientes: round2(cobros_pendientes),
      cobros_count: cobros.length,
      pagos_pendientes: round2(pagos_pendientes),
      pagos_count: pagos.length,
      posicion_neta: round2(tesoreria + cobros_pendientes - pagos_pendientes),
    });
  } catch (err) {
    console.error('API cashflow error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
