import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompanies, round2 } from '@/lib/odoo';
import { requireAuth } from '@/lib/auth';
import { CRM_STAGES, ALL_STAGE_IDS } from '@/lib/crm-stages';
import { CHART_COLORS } from '@/lib/constants';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = req.nextUrl;
    const company_name = searchParams.get('company') || undefined;

    const { domain: companyDomain, error } = await resolveCompanies(company_name);
    if (error) return NextResponse.json({ error }, { status: 404 });

    const domain: unknown[] = [
      ['active', '=', true],
      ['type', '=', 'opportunity'],
      ['stage_id', 'in', ALL_STAGE_IDS],
      ...companyDomain,
    ];

    // Agrupar oportunidades activas por stage_id
    const groups = (await execute('crm.lead', 'read_group',
      [domain, ['expected_revenue'], ['stage_id']], { lazy: false }
    )) as Array<Record<string, unknown>>;

    const stageGroupMap = new Map<number, { count: number; revenue: number }>();
    for (const group of groups) {
      const stageId = Array.isArray(group.stage_id) ? (group.stage_id as [number, string])[0] : 0;
      const count = (group.__count ?? group.stage_id_count ?? 0) as number;
      stageGroupMap.set(stageId, {
        count,
        revenue: (group.expected_revenue as number) || 0,
      });
    }

    // Construir todas las etapas (incluso las vacías)
    const stages = CRM_STAGES.map((stage, index) => {
      const stageData = stageGroupMap.get(stage.id);
      return {
        name: stage.name,
        value: round2(stageData?.revenue ?? 0),
        count: stageData?.count ?? 0,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    });

    return NextResponse.json({ stages });
  } catch (err) {
    console.error('API crm/pipeline error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
