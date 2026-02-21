import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompanies, round2 } from '@/lib/odoo';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const company_name = searchParams.get('company') || undefined;

    const { domain: companyDomain, error } = await resolveCompanies(company_name);
    if (error) return NextResponse.json({ error }, { status: 404 });

    const domain: unknown[] = [
      ['active', '=', true],
      ['type', '=', 'opportunity'],
      ['expected_revenue', '>', 0],
      ...companyDomain,
    ];

    const leads = (await execute('crm.lead', 'search_read',
      [domain],
      {
        fields: ['name', 'partner_id', 'expected_revenue', 'stage_id', 'probability'],
        order: 'expected_revenue desc',
        limit: 15,
      }
    )) as Array<{
      name: string;
      partner_id: [number, string] | false;
      expected_revenue: number;
      stage_id: [number, string] | false;
      probability: number;
    }>;

    const deals = leads.map(l => ({
      name: l.name || 'Sin nombre',
      partner: Array.isArray(l.partner_id) ? l.partner_id[1] : 'Sin cliente',
      expected_revenue: round2(l.expected_revenue || 0),
      stage: Array.isArray(l.stage_id) ? l.stage_id[1] : 'Sin etapa',
      probability: l.probability || 0,
    }));

    return NextResponse.json({ deals });
  } catch (err) {
    console.error('API crm/top-deals error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
