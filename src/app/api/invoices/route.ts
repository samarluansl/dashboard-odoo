import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompany, round2 } from '@/lib/odoo';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');
    const company_name = searchParams.get('company') || undefined;
    const type = searchParams.get('type') || 'out_invoice'; // out_invoice | in_invoice
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!date_from || !date_to) {
      return NextResponse.json({ error: 'date_from y date_to son obligatorios' }, { status: 400 });
    }

    const { companyId, label, error } = await resolveCompany(company_name);
    if (error) return NextResponse.json({ error }, { status: 404 });

    const domain: unknown[] = [
      ['move_type', '=', type],
      ['state', '=', 'posted'],
      ['invoice_date', '>=', date_from],
      ['invoice_date', '<=', date_to],
    ];
    if (companyId) domain.push(['company_id', '=', companyId]);

    const invoices = (await execute('account.move', 'search_read',
      [domain],
      {
        fields: [
          'name', 'partner_id', 'invoice_date', 'invoice_date_due',
          'amount_total_signed', 'amount_residual', 'payment_state', 'currency_id',
        ],
        order: 'invoice_date desc',
        limit,
      }
    )) as Array<{
      id: number;
      name: string;
      partner_id: [number, string] | false;
      invoice_date: string;
      invoice_date_due: string | false;
      amount_total_signed: number;
      amount_residual: number;
      payment_state: string;
      currency_id: [number, string] | false;
    }>;

    const facturas = invoices.map(inv => ({
      id: inv.id,
      numero: inv.name,
      cliente: Array.isArray(inv.partner_id) ? inv.partner_id[1] : 'Sin cliente',
      fecha: inv.invoice_date,
      vencimiento: inv.invoice_date_due || null,
      total: round2(Math.abs(inv.amount_total_signed || 0)),
      pendiente: round2(inv.amount_residual || 0),
      estado: inv.payment_state,
      moneda: Array.isArray(inv.currency_id) ? inv.currency_id[1] : 'EUR',
    }));

    // Totales
    const total_facturado = facturas.reduce((s, f) => s + f.total, 0);
    const total_pendiente = facturas.reduce((s, f) => s + f.pendiente, 0);

    return NextResponse.json({
      empresa: label,
      periodo: `${date_from} a ${date_to}`,
      tipo: type === 'out_invoice' ? 'Ventas' : 'Compras',
      count: facturas.length,
      total_facturado: round2(total_facturado),
      total_pendiente: round2(total_pendiente),
      facturas,
    });
  } catch (err) {
    console.error('API invoices error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
