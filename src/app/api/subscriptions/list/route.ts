import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompanies, round2 } from '@/lib/odoo';
import { requireAuth } from '@/lib/auth';
import { SUBSCRIPTION_STATE_LABELS } from '@/lib/subscription-states';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = req.nextUrl;
    const company_name = searchParams.get('company') || undefined;

    const { domain: companyDomain, error } = await resolveCompanies(company_name);
    if (error) return NextResponse.json({ error }, { status: 404 });

    const domain: unknown[] = [
      ['is_subscription', '=', true],
      ...companyDomain,
    ];

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

    const subscriptions = orders.map(order => {
      const rawState = order.subscription_state || 'unknown';
      return {
        name: order.name || 'Sin nombre',
        partner: Array.isArray(order.partner_id) ? order.partner_id[1] : 'Sin cliente',
        mrr: round2(order.recurring_monthly || 0),
        start_date: order.date_order || '',
        next_invoice: order.next_invoice_date || '',
        status: rawState,
        status_label: SUBSCRIPTION_STATE_LABELS[rawState] || rawState,
      };
    });

    return NextResponse.json({ subscriptions });
  } catch (err) {
    console.error('API subscriptions/list error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
