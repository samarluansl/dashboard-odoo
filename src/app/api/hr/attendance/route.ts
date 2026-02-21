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

    const { domain: companyDomain, error } = await resolveCompanies(company_name);
    if (error) return NextResponse.json({ error }, { status: 404 });

    // Remap company_id to employee_id.company_id for attendance model
    const attendanceCompanyDomain = companyDomain.map((d: unknown) =>
      Array.isArray(d) && d[0] === 'company_id'
        ? ['employee_id.company_id', d[1], d[2]]
        : d
    );

    // Agrupar horas de asistencia por empleado
    const domain: unknown[] = [
      ['check_in', '>=', date_from + ' 00:00:00'],
      ['check_in', '<=', date_to + ' 23:59:59'],
      ...attendanceCompanyDomain,
    ];

    const groups = (await execute('hr.attendance', 'read_group',
      [domain, ['worked_hours', 'overtime_hours'], ['employee_id']], { lazy: false }
    )) as Array<{
      employee_id: [number, string];
      worked_hours: number;
      overtime_hours: number;
    }>;

    // Obtener departamentos
    const empIds = groups.map(g => g.employee_id?.[0]).filter(Boolean);
    const empleados = empIds.length > 0
      ? (await execute('hr.employee', 'search_read',
        [[['id', 'in', empIds]]], { fields: ['id', 'name', 'department_id'] }
      )) as Array<{ id: number; name: string; department_id: [number, string] | false }>
      : [];

    const empMap = new Map(empleados.map(e => [e.id, e]));

    const result = groups
      .map(g => {
        const emp = empMap.get(g.employee_id?.[0]);
        return {
          nombre: g.employee_id?.[1] || 'Desconocido',
          horas_trabajadas: round2(g.worked_hours || 0),
          horas_extra: round2(g.overtime_hours || 0),
          departamento: emp?.department_id ? (Array.isArray(emp.department_id) ? emp.department_id[1] : '') : 'Sin departamento',
        };
      })
      .sort((a, b) => b.horas_trabajadas - a.horas_trabajadas);

    return NextResponse.json({ empleados: result });
  } catch (err) {
    console.error('API hr/attendance error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
