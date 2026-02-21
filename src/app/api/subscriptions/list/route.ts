import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompanies, round2 } from '@/lib/odoo';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const company_name = searchParams.get('company') || undefined;

    const { domain: companyDomain, error } = await resolveCompanies(company_name);
    if (error) return NextResponse.json({ error }, { status: 404 });

    const domain: unknown[] = [
      ['is_subscription', '=', true],
      ...companyDomain,
    ];

    // Odoo 17: subscription_state usa prefijos numéricos
    const STATE_LABELS: Record<string, string> = {
      '1_draft': 'Borrador',
      '2_renewal': 'Renovación',
      '3_progress': 'Activa',
      '4_paused': 'Pausada',
      '5_close': 'Cerrada',
      '6_churn': 'Baja',
    };

    const orders = (await execute('sale.order', 'search_read',
      [domain],
      {
        fields: ['name', 'partner_id', 'recurring_monthly', 'date_order', 'next_invoice_date', 'subscription_state'],
        order: 'recurring_monthly desc',
        limit: 200,
      }
    )) as Array<{
      name: string;
      partner_id: [number, string] | false;
      recurring_monthly: number;
      date_order: string;
      next_invoice_date: string | false;
      subscription_state: string;
    }>;

    const subscriptions = orders.map(o => {
      const rawState = o.subscription_state || 'unknown';
      return {
        name: o.name || 'Sin nombre',
        partner: Array.isArray(o.partner_id) ? o.partner_id[1] : 'Sin cliente',
        mrr: round2(o.recurring_monthly || 0),
        start_date: o.date_order || '',
        next_invoice: o.next_invoice_date || '',
        status: rawState,
        status_label: STATE_LABELS[rawState] || rawState,
      };
    });

    return NextResponse.json({ subscriptions });
  } catch (err) {
    console.error('API subscriptions/list error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
