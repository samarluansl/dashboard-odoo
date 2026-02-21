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

    // Odoo 17 con lazy:false devuelve __count en vez de stage_id_count
    const groups = (await execute('crm.lead', 'read_group',
      [domain, ['expected_revenue'], ['stage_id']], { lazy: false }
    )) as Array<Record<string, unknown>>;

    const stages = groups.map((g, i) => {
      const count = (g.__count ?? g.stage_id_count ?? 0) as number;
      return {
        name: Array.isArray(g.stage_id) ? (g.stage_id as [number, string])[1] : 'Sin etapa',
        value: round2((g.expected_revenue as number) || 0),
        count,
        color: COLORS[i % COLORS.length],
      };
    });

    return NextResponse.json({ stages });
  } catch (err) {
    console.error('API crm/pipeline error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
