import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompanies } from '@/lib/odoo';
import { requireAuth } from '@/lib/auth';
import { CHART_COLORS_ALT } from '@/lib/constants';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = req.nextUrl;
    const company_name = searchParams.get('company') || undefined;

    const { domain: companyDomain, error } = await resolveCompanies(company_name);
    if (error) return NextResponse.json({ error }, { status: 404 });

    const domain: unknown[] = [['active', '=', true], ...companyDomain];

    const groups = (await execute('hr.employee', 'read_group',
      [domain, ['id'], ['department_id']], { lazy: false }
    )) as Array<Record<string, unknown>>;

    const departmentCounts = groups
      .map((group, index) => ({
        name: Array.isArray(group.department_id) ? (group.department_id as [number, string])[1] : 'Sin departamento',
        value: ((group.__count ?? group.department_id_count ?? 0) as number),
        color: CHART_COLORS_ALT[index % CHART_COLORS_ALT.length],
      }))
      .filter(dept => dept.value > 0)
      .sort((a, b) => b.value - a.value);

    return NextResponse.json({ data: departmentCounts });
  } catch (err) {
    console.error('API hr/departments error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
