import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompanies, round2 } from '@/lib/odoo';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = req.nextUrl;
    const company_name = searchParams.get('company') || undefined;

    const { domain: companyDomain, error } = await resolveCompanies(company_name);
    if (error) return NextResponse.json({ error }, { status: 404 });

    const today = new Date().toISOString().split('T')[0];

    const domain: unknown[] = [
      ['move_type', '=', 'out_invoice'],
      ['state', '=', 'posted'],
      ['payment_state', 'in', ['not_paid', 'partial']],
      ['invoice_date_due', '<', today],
      ...companyDomain,
    ];

    const invoices = (await execute('account.move', 'search_read',
      [domain],
      {
        fields: ['partner_id', 'amount_residual', 'invoice_date_due', 'name'],
        order: 'invoice_date_due asc',
        limit: 50,
      }
    )) as Array<{
      partner_id: [number, string] | false;
      amount_residual: number;
      invoice_date_due: string;
      name: string;
    }>;

    const MS_PER_DAY = 86_400_000;
    const todayMs = Date.now();
    const facturas = invoices.map(invoice => {
      const dueDate = invoice.invoice_date_due;
      const dueMs = new Date(dueDate).getTime();
      const days_overdue = Math.ceil((todayMs - dueMs) / MS_PER_DAY);

      return {
        partner: Array.isArray(invoice.partner_id) ? invoice.partner_id[1] : 'Sin cliente',
        amount: round2(invoice.amount_residual || 0),
        due_date: dueDate,
        days_overdue,
        invoice: invoice.name,
      };
    });

    const total = facturas.reduce((sum, factura) => sum + factura.amount, 0);

    return NextResponse.json({
      total: round2(total),
      count: facturas.length,
      facturas,
    });
  } catch (err) {
    console.error('API overdue error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
