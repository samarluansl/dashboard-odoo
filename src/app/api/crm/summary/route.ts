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

    // Oportunidades activas
    const activeDomain: unknown[] = [
      ['active', '=', true],
      ['type', '=', 'opportunity'],
      ...companyDomain,
    ];

    const oportunidades_activas = (await execute('crm.lead', 'search_count', [activeDomain])) as number;

    // Pipeline value
    const pipelineGroups = (await execute('crm.lead', 'read_group',
      [activeDomain, ['expected_revenue'], []], { lazy: false }
    )) as Array<{ expected_revenue: number }>;

    const pipeline_value = pipelineGroups[0]?.expected_revenue || 0;

    // Ganadas en el período
    const wonDomain: unknown[] = [
      ['active', '=', true],
      ['type', '=', 'opportunity'],
      ['stage_id.is_won', '=', true],
      ['date_closed', '>=', date_from],
      ['date_closed', '<=', date_to],
      ...companyDomain,
    ];

    const ganadas = (await execute('crm.lead', 'search_count', [wonDomain])) as number;

    // Perdidas en el período
    const lostDomain: unknown[] = [
      ['active', '=', false],
      ['type', '=', 'opportunity'],
      ['date_closed', '>=', date_from],
      ['date_closed', '<=', date_to],
      ...companyDomain,
    ];

    const perdidas = (await execute('crm.lead', 'search_count', [lostDomain])) as number;

    const total_cerradas = ganadas + perdidas;
    const tasa_conversion = total_cerradas > 0 ? round2((ganadas / total_cerradas) * 100) : 0;

    return NextResponse.json({
      empresa: label,
      oportunidades_activas,
      pipeline_value: round2(pipeline_value),
      ganadas,
      perdidas,
      tasa_conversion,
    });
  } catch (err) {
    console.error('API crm/summary error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
