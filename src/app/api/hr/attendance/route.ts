import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompanies, round2 } from '@/lib/odoo';
import { requireAuth } from '@/lib/auth';

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

    const { domain: companyDomain, error } = await resolveCompanies(company_name);
    if (error) return NextResponse.json({ error }, { status: 404 });

    // hr.attendance no tiene company_id directo; remap a employee_id.company_id
    const attendanceCompanyDomain = (companyDomain as unknown[][]).map(domainClause =>
      Array.isArray(domainClause) && domainClause[0] === 'company_id'
        ? ['employee_id.company_id', domainClause[1], domainClause[2]]
        : domainClause
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
    const employeeIds = groups.map(group => group.employee_id?.[0]).filter(Boolean);
    const empleados = employeeIds.length > 0
      ? (await execute('hr.employee', 'search_read',
        [[['id', 'in', employeeIds]]], { fields: ['id', 'name', 'department_id'] }
      )) as Array<{ id: number; name: string; department_id: [number, string] | false }>
      : [];

    const employeeMap = new Map(empleados.map(emp => [emp.id, emp]));

    const attendanceRecords = groups
      .map(group => {
        const employee = employeeMap.get(group.employee_id?.[0]);
        return {
          nombre: group.employee_id?.[1] || 'Desconocido',
          horas_trabajadas: round2(group.worked_hours || 0),
          horas_extra: round2(group.overtime_hours || 0),
          departamento: employee?.department_id ? (Array.isArray(employee.department_id) ? employee.department_id[1] : '') : 'Sin departamento',
        };
      })
      .sort((a, b) => b.horas_trabajadas - a.horas_trabajadas);

    return NextResponse.json({ empleados: attendanceRecords });
  } catch (err) {
    console.error('API hr/attendance error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
