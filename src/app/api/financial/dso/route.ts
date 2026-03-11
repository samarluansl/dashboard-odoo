import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompanies, round2 } from '@/lib/odoo';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

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

    // Ventas del período + Cuentas a cobrar — en paralelo
    const ventasDomain: unknown[] = [
      ['move_type', '=', 'out_invoice'],
      ['state', '=', 'posted'],
      ['invoice_date', '>=', date_from],
      ['invoice_date', '<=', date_to],
      ...companyDomain,
    ];

    const cobroDomain: unknown[] = [
      ['move_type', 'in', ['out_invoice', 'out_refund']],
      ['state', '=', 'posted'],
      ['payment_state', 'in', ['not_paid', 'partial']],
      ...companyDomain,
    ];

    // PERF: Parallelise both queries + use read_group for cobros instead of search_read
    const [ventasGroups, cobrosGroups] = await Promise.all([
      execute('account.move', 'read_group',
        [ventasDomain, ['amount_total_signed'], []], { lazy: false }
      ) as Promise<Array<{ amount_total_signed: number }>>,

      execute('account.move', 'read_group',
        [cobroDomain, ['amount_residual'], []], { lazy: false }
      ) as Promise<Array<{ amount_residual: number }>>,
    ]);

    const ventas_periodo = ventasGroups[0]?.amount_total_signed || 0;
    const cuentas_cobrar = cobrosGroups[0]?.amount_residual || 0;

    // DSO = (Cuentas a cobrar / Ventas) x dias del periodo
    const MS_PER_DAY = 86_400_000;
    const d1 = new Date(date_from);
    const d2 = new Date(date_to);
    const dias = Math.ceil((d2.getTime() - d1.getTime()) / MS_PER_DAY) + 1;
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
