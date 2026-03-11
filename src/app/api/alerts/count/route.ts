import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompanies } from '@/lib/odoo';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = req.nextUrl;
    const company_name = searchParams.get('company') || undefined;

    const { domain: companyDomain } = await resolveCompanies(company_name);

    // Contar facturas de clientes vencidas > 30 días
    const today = new Date().toISOString().split('T')[0];
    // FIX #8: removed unused thirtyAgo variable

    const overdueDomain: unknown[] = [
      ['move_type', '=', 'out_invoice'],
      ['state', '=', 'posted'],
      ['payment_state', 'in', ['not_paid', 'partial']],
      ['invoice_date_due', '<', today],
      ...companyDomain,
    ];

    // Facturas muy vencidas (>60 dias) = criticas
    const CRITICAL_OVERDUE_DAYS = 60;
    const MS_PER_DAY = 86_400_000;
    const sixtyAgo = new Date(Date.now() - CRITICAL_OVERDUE_DAYS * MS_PER_DAY).toISOString().split('T')[0];
    const criticalDomain: unknown[] = [
      ['move_type', '=', 'out_invoice'],
      ['state', '=', 'posted'],
      ['payment_state', 'in', ['not_paid', 'partial']],
      ['invoice_date_due', '<', sixtyAgo],
      ...companyDomain,
    ];

    // PERF: Execute both counts in parallel
    const [overdueCount, criticalCount] = await Promise.all([
      execute('account.move', 'search_count', [overdueDomain]) as Promise<number>,
      execute('account.move', 'search_count', [criticalDomain]) as Promise<number>,
    ]);

    return NextResponse.json({
      count: overdueCount,
      critical: criticalCount,
    });
  } catch (err) {
    console.error('API alerts/count error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
