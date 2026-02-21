import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompanies } from '@/lib/odoo';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#f97316'];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const company_name = searchParams.get('company') || undefined;

    const { domain: companyDomain, error } = await resolveCompanies(company_name);
    if (error) return NextResponse.json({ error }, { status: 404 });

    const domain: unknown[] = [['active', '=', true], ...companyDomain];

    const groups = (await execute('hr.employee', 'read_group',
      [domain, ['id'], ['department_id']], { lazy: false }
    )) as Array<Record<string, unknown>>;

    const data = groups
      .map((g, i) => ({
        name: Array.isArray(g.department_id) ? (g.department_id as [number, string])[1] : 'Sin departamento',
        value: ((g.__count ?? g.department_id_count ?? 0) as number),
        color: COLORS[i % COLORS.length],
      }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);

    return NextResponse.json({ data });
  } catch (err) {
    console.error('API hr/departments error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
