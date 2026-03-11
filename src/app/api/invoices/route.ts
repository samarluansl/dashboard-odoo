import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompany, round2 } from '@/lib/odoo';
import { requireAuth } from '@/lib/auth';

// FIX #5: Whitelist for invoice types
const VALID_TYPES = ['out_invoice', 'in_invoice'];

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = req.nextUrl;
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');
    const company_name = searchParams.get('company') || undefined;
    const type = searchParams.get('type') || 'out_invoice';

    // FIX #5: Validate type against whitelist
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: `Tipo inválido. Valores permitidos: ${VALID_TYPES.join(', ')}` }, { status: 400 });
    }

    // FIX #6: Validate limit is positive and <= 500
    const rawLimit = parseInt(searchParams.get('limit') || '50');
    const limit = Number.isNaN(rawLimit) || rawLimit < 1 ? 50 : Math.min(rawLimit, 500);

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

    const facturas = invoices.map(invoice => ({
      id: invoice.id,
      numero: invoice.name,
      cliente: Array.isArray(invoice.partner_id) ? invoice.partner_id[1] : 'Sin cliente',
      fecha: invoice.invoice_date,
      vencimiento: invoice.invoice_date_due || null,
      total: round2(Math.abs(invoice.amount_total_signed || 0)),
      pendiente: round2(invoice.amount_residual || 0),
      estado: invoice.payment_state,
      moneda: Array.isArray(invoice.currency_id) ? invoice.currency_id[1] : 'EUR',
    }));

    // Totales
    const total_facturado = facturas.reduce((sum, factura) => sum + factura.total, 0);
    const total_pendiente = facturas.reduce((sum, factura) => sum + factura.pendiente, 0);

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
