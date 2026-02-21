import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompanies, round2 } from '@/lib/odoo';

const COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const company_name = searchParams.get('company') || undefined;

    const { domain: companyDomain, error } = await resolveCompanies(company_name);
    if (error) return NextResponse.json({ error }, { status: 404 });

    const domain: unknown[] = [
      ['active', '=', true],
      ['type', '=', 'opportunity'],
      ...companyDomain,
    ];

    // 1. Obtener TODAS las etapas de crm.stage (incluye las que no tienen oportunidades)
    const allStages = (await execute('crm.stage', 'search_read',
      [[]],
      { fields: ['id', 'name', 'is_won', 'sequence'], order: 'sequence asc' }
    )) as Array<{ id: number; name: string; is_won: boolean; sequence: number }>;

    // 2. Agrupar oportunidades activas por stage_id
    const groups = (await execute('crm.lead', 'read_group',
      [domain, ['expected_revenue'], ['stage_id']], { lazy: false }
    )) as Array<Record<string, unknown>>;

    // Mapa stage_id → datos agrupados
    const groupMap = new Map<number, { count: number; revenue: number }>();
    for (const g of groups) {
      const stageId = Array.isArray(g.stage_id) ? (g.stage_id as [number, string])[0] : 0;
      const count = (g.__count ?? g.stage_id_count ?? 0) as number;
      groupMap.set(stageId, {
        count,
        revenue: (g.expected_revenue as number) || 0,
      });
    }

    // 3. Construir etapas completas (todas, incluso las vacías)
    const stages = allStages.map((s, i) => {
      const data = groupMap.get(s.id);
      return {
        name: s.name,
        value: round2(data?.revenue ?? 0),
        count: data?.count ?? 0,
        color: COLORS[i % COLORS.length],
      };
    });

    return NextResponse.json({ stages });
  } catch (err) {
    console.error('API crm/pipeline error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
