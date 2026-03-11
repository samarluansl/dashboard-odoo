import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompanies, round2 } from '@/lib/odoo';
import { requireAuth } from '@/lib/auth';
import { CRM_STAGES } from '@/lib/crm-stages';

// Pre-compute stage IDs from centralized CRM_STAGES (avoids repeated .find() per request)
const STAGE_IMPAGOS = CRM_STAGES.find(s => s.name === 'Impagos')!.id;
const STAGE_POSIBLE_BAJA = CRM_STAGES.find(s => s.name === 'Posible baja')!.id;
const STAGE_FIRMADOS = CRM_STAGES.find(s => s.name.startsWith('Firmados'))!.id;
const STAGE_ARRANCADO = CRM_STAGES.find(s => s.name === 'Arrancado')!.id;
const ACTIVE_CLUB_STAGES = [STAGE_FIRMADOS, STAGE_ARRANCADO, STAGE_POSIBLE_BAJA, STAGE_IMPAGOS];

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

    // Build all domains upfront
    const activeDomain: unknown[] = [
      ['active', '=', true],
      ['type', '=', 'opportunity'],
      ...companyDomain,
    ];

    const wonDomain: unknown[] = [
      ['active', '=', true],
      ['type', '=', 'opportunity'],
      ['stage_id.is_won', '=', true],
      ['date_closed', '>=', date_from],
      ['date_closed', '<=', date_to],
      ...companyDomain,
    ];

    const lostDomain: unknown[] = [
      ['active', '=', false],
      ['type', '=', 'opportunity'],
      ['date_closed', '>=', date_from],
      ['date_closed', '<=', date_to],
      ...companyDomain,
    ];

    const altasDomain: unknown[] = [
      ['type', '=', 'opportunity'],
      ['x_studio_fecha_firma_alta', '>=', date_from],
      ['x_studio_fecha_firma_alta', '<=', date_to],
      ...companyDomain,
    ];

    const bajasDomain: unknown[] = [
      ['type', '=', 'opportunity'],
      ['x_studio_fecha_baja', '>=', date_from],
      ['x_studio_fecha_baja', '<=', date_to],
      ...companyDomain,
    ];

    const impagosDomain: unknown[] = [
      ['active', '=', true],
      ['type', '=', 'opportunity'],
      ['stage_id', '=', STAGE_IMPAGOS],
      ...companyDomain,
    ];

    const posiblesBajasDomain: unknown[] = [
      ['active', '=', true],
      ['type', '=', 'opportunity'],
      ['stage_id', '=', STAGE_POSIBLE_BAJA],
      ...companyDomain,
    ];

    const clubsActivosDomain: unknown[] = [
      ['active', '=', true],
      ['type', '=', 'opportunity'],
      ['stage_id', 'in', ACTIVE_CLUB_STAGES],
      ...companyDomain,
    ];

    // PERF: Execute ALL 8 Odoo queries in parallel instead of sequentially
    // This reduces total latency from ~8*RTT to ~1*RTT
    const [
      oportunidades_activas,
      pipelineGroups,
      ganadas,
      perdidas,
      altas,
      bajas,
      impagos,
      posibles_bajas,
      clubs_activos,
    ] = await Promise.all([
      execute('crm.lead', 'search_count', [activeDomain]) as Promise<number>,
      execute('crm.lead', 'read_group',
        [activeDomain, ['expected_revenue'], []], { lazy: false }
      ) as Promise<Array<{ expected_revenue: number }>>,
      execute('crm.lead', 'search_count', [wonDomain]) as Promise<number>,
      execute('crm.lead', 'search_count', [lostDomain]) as Promise<number>,
      execute('crm.lead', 'search_count', [altasDomain]) as Promise<number>,
      execute('crm.lead', 'search_count', [bajasDomain]) as Promise<number>,
      execute('crm.lead', 'search_count', [impagosDomain]) as Promise<number>,
      execute('crm.lead', 'search_count', [posiblesBajasDomain]) as Promise<number>,
      execute('crm.lead', 'search_count', [clubsActivosDomain]) as Promise<number>,
    ]);

    const pipeline_value = pipelineGroups[0]?.expected_revenue || 0;
    const total_cerradas = ganadas + perdidas;
    const tasa_conversion = total_cerradas > 0 ? round2((ganadas / total_cerradas) * 100) : 0;

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
