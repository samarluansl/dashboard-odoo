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

    // Altas — fecha de firma/alta (campo Odoo Studio: x_studio_fecha_firma_alta, datetime)
    const altasDomain: unknown[] = [
      ['type', '=', 'opportunity'],
      ['x_studio_fecha_firma_alta', '>=', date_from],
      ['x_studio_fecha_firma_alta', '<=', date_to],
      ...companyDomain,
    ];
    const altas = (await execute('crm.lead', 'search_count', [altasDomain])) as number;

    // Bajas — fecha de baja (campo Odoo Studio: x_studio_fecha_baja, date)
    const bajasDomain: unknown[] = [
      ['type', '=', 'opportunity'],
      ['x_studio_fecha_baja', '>=', date_from],
      ['x_studio_fecha_baja', '<=', date_to],
      ...companyDomain,
    ];
    const bajas = (await execute('crm.lead', 'search_count', [bajasDomain])) as number;

    // Impagos — etapa ID 19 (sequence 7)
    const impagosDomain: unknown[] = [
      ['active', '=', true],
      ['type', '=', 'opportunity'],
      ['stage_id', '=', 19],
      ...companyDomain,
    ];
    const impagos = (await execute('crm.lead', 'search_count', [impagosDomain])) as number;

    // Posibles bajas — etapa ID 11 (sequence 8)
    const posiblesBajasDomain: unknown[] = [
      ['active', '=', true],
      ['type', '=', 'opportunity'],
      ['stage_id', '=', 11],
      ...companyDomain,
    ];
    const posibles_bajas = (await execute('crm.lead', 'search_count', [posiblesBajasDomain])) as number;

    // Clubs activos — etapas: 2 (Firmados), 4 (Arrancado), 11 (Posible baja), 19 (Impagos)
    const clubsActivosDomain: unknown[] = [
      ['active', '=', true],
      ['type', '=', 'opportunity'],
      ['stage_id', 'in', [2, 4, 11, 19]],
      ...companyDomain,
    ];
    const clubs_activos = (await execute('crm.lead', 'search_count', [clubsActivosDomain])) as number;

    return NextResponse.json({
      empresa: label,
      oportunidades_activas,
      pipeline_value: round2(pipeline_value),
      ganadas,
      perdidas,
      tasa_conversion,
      altas,
      bajas,
      impagos,
      posibles_bajas,
      clubs_activos,
    });
  } catch (err) {
    console.error('API crm/summary error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
