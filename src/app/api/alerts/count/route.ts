import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompanies, round2 } from '@/lib/odoo';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const company_name = searchParams.get('company') || undefined;

    const { domain: companyDomain } = await resolveCompanies(company_name);

    // Contar facturas de clientes vencidas > 30 días
    const today = new Date().toISOString().split('T')[0];
    const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const overdueDomain: unknown[] = [
      ['move_type', '=', 'out_invoice'],
      ['state', '=', 'posted'],
      ['payment_state', 'in', ['not_paid', 'partial']],
      ['invoice_date_due', '<', today],
      ...companyDomain,
    ];

    const overdueCount = (await execute('account.move', 'search_count', [overdueDomain])) as number;

    // Facturas muy vencidas (>60 días) → críticas
    const sixtyAgo = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];
    const criticalDomain: unknown[] = [
      ...overdueDomain.filter((_, i) => i < overdueDomain.length), // copiar
      ['invoice_date_due', '<', sixtyAgo],
    ];

    const criticalCount = (await execute('account.move', 'search_count', [criticalDomain])) as number;

    return NextResponse.json({
      count: overdueCount,
      critical: criticalCount,
    });
  } catch (err) {
    console.error('API alerts/count error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
