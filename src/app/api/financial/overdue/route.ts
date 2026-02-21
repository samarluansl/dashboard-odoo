import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompanies, round2 } from '@/lib/odoo';

export async function GET(req: NextRequest) {
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

    const todayMs = Date.now();
    const facturas = invoices.map(inv => {
      const dueDate = inv.invoice_date_due;
      const dueMs = new Date(dueDate).getTime();
      const days_overdue = Math.ceil((todayMs - dueMs) / 86400000);

      return {
        partner: Array.isArray(inv.partner_id) ? inv.partner_id[1] : 'Sin cliente',
        amount: round2(inv.amount_residual || 0),
        due_date: dueDate,
        days_overdue,
        invoice: inv.name,
      };
    });

    const total = facturas.reduce((s, f) => s + f.amount, 0);

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
