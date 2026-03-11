import { NextRequest, NextResponse } from 'next/server';
import { execute, executeStatic, resolveCompanies, round2 } from '@/lib/odoo';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = req.nextUrl;
    const company_name = searchParams.get('company') || undefined;

    const { label, domain: companyDomain, error } = await resolveCompanies(company_name);
    if (error) return NextResponse.json({ error }, { status: 404 });

    // PERF: Bank account IDs are semi-static — use long-lived cache
    const bankAccounts = (await executeStatic('account.account', 'search_read', [
      [['account_type', '=', 'asset_cash']],
    ], { fields: ['id'] })) as Array<{ id: number }>;

    const bankIds = bankAccounts.map(acc => acc.id);

    // ═══ Paso 2: Ejecutar las 3 queries en paralelo ═══
    const treasuryDomain: unknown[] = [
      ['account_id', 'in', bankIds],
      ['parent_state', '=', 'posted'],
      ...companyDomain,
    ];

    const cobroDomain: unknown[] = [
      ['move_type', 'in', ['out_invoice', 'out_refund']],
      ['state', '=', 'posted'],
      ['payment_state', 'in', ['not_paid', 'partial']],
      ...companyDomain,
    ];

    const pagoDomain: unknown[] = [
      ['move_type', 'in', ['in_invoice', 'in_refund']],
      ['state', '=', 'posted'],
      ['payment_state', 'in', ['not_paid', 'partial']],
      ...companyDomain,
    ];

    // Parallelise: treasury read_group + cobros read_group + pagos read_group
    const [treasuryGroups, cobrosGroups, pagosGroups] = await Promise.all([
      execute('account.move.line', 'read_group',
        [treasuryDomain, ['balance'], ['account_id']], { lazy: false }
      ) as Promise<Array<{ balance: number }>>,

      // PERF: Use read_group instead of search_read to avoid transferring all records
      execute('account.move', 'read_group',
        [cobroDomain, ['amount_residual'], []], { lazy: false }
      ) as Promise<Array<{ amount_residual: number; __count: number }>>,

      execute('account.move', 'read_group',
        [pagoDomain, ['amount_residual'], []], { lazy: false }
      ) as Promise<Array<{ amount_residual: number; __count: number }>>,
    ]);

    const tesoreria = treasuryGroups.reduce((sum, group) => sum + (group.balance || 0), 0);
    const cobros_pendientes = cobrosGroups[0]?.amount_residual || 0;
    const cobros_count = (cobrosGroups[0] as Record<string, unknown>)?.__count as number || 0;
    const pagos_pendientes = pagosGroups[0]?.amount_residual || 0;
    const pagos_count = (pagosGroups[0] as Record<string, unknown>)?.__count as number || 0;

    return NextResponse.json({
      empresa: label,
      tesoreria: round2(tesoreria),
      cobros_pendientes: round2(cobros_pendientes),
      cobros_count,
      pagos_pendientes: round2(pagos_pendientes),
      pagos_count,
      posicion_neta: round2(tesoreria + cobros_pendientes - pagos_pendientes),
    });
  } catch (err) {
    console.error('API cashflow error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
