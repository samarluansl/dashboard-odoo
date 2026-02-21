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

    // Ventas del período
    const ventasDomain: unknown[] = [
      ['move_type', '=', 'out_invoice'],
      ['state', '=', 'posted'],
      ['invoice_date', '>=', date_from],
      ['invoice_date', '<=', date_to],
      ...companyDomain,
    ];

    const ventasGroups = (await execute('account.move', 'read_group',
      [ventasDomain, ['amount_total_signed'], []], { lazy: false }
    )) as Array<{ amount_total_signed: number }>;

    const ventas_periodo = ventasGroups[0]?.amount_total_signed || 0;

    // Cuentas a cobrar
    const cobroDomain: unknown[] = [
      ['move_type', 'in', ['out_invoice', 'out_refund']],
      ['state', '=', 'posted'],
      ['payment_state', 'in', ['not_paid', 'partial']],
      ...companyDomain,
    ];

    const cobros = (await execute('account.move', 'search_read',
      [cobroDomain], { fields: ['amount_residual'] }
    )) as Array<{ amount_residual: number }>;

    const cuentas_cobrar = cobros.reduce((s, c) => s + (c.amount_residual || 0), 0);

    // DSO = (Cuentas a cobrar / Ventas) × días del período
    const d1 = new Date(date_from);
    const d2 = new Date(date_to);
    const dias = Math.ceil((d2.getTime() - d1.getTime()) / 86400000) + 1;
    const dso = ventas_periodo > 0 ? round2((cuentas_cobrar / ventas_periodo) * dias) : 0;

    return NextResponse.json({
      empresa: label,
      dso,
      ventas_periodo: round2(ventas_periodo),
      cuentas_cobrar: round2(cuentas_cobrar),
    });
  } catch (err) {
    console.error('API dso error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
