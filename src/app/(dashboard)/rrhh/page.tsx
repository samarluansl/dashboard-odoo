'use client';

import { useState, useMemo } from 'react';
import { KPICard } from '@/components/dashboard/KPICard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChartComponent } from '@/components/charts/BarChart';
import { Badge } from '@/components/ui/badge';
import { ErrorMessage } from '@/components/ui/error-message';
import { useOdooQuery } from '@/lib/hooks/useOdooQuery';
import { useCompanyFilter } from '@/lib/context/CompanyContext';
import { Users, Clock, Euro, UserPlus, ArrowUpDown, Search, ChevronLeft, ChevronRight } from 'lucide-react';

type AttSortField = 'nombre' | 'horas_trabajadas' | 'horas_extra' | 'departamento';
type SortDir = 'asc' | 'desc';

export default function RRHHPage() {
  const { companyParam, dateFrom, dateTo } = useCompanyFilter();

  // Filtros departamento
  const [deptFilter, setDeptFilter] = useState('');

  // Filtros asistencia
  const [attFilter, setAttFilter] = useState('');
  const [attSort, setAttSort] = useState<AttSortField>('horas_trabajadas');
  const [attSortDir, setAttSortDir] = useState<SortDir>('desc');
  const [attPage, setAttPage] = useState(1);
  const ATT_PAGE_SIZE = 15;

  const params = useMemo(() => {
    const p: Record<string, string> = { date_from: dateFrom, date_to: dateTo };
    if (companyParam) p.company = companyParam;
    return p;
  }, [dateFrom, dateTo, companyParam]);

  const summary = useOdooQuery<{ empleados_activos: number; nuevas_altas: number; horas_mes: number; coste_nomina: number }>({ url: '/api/hr/summary', params });
  const departments = useOdooQuery<{ data: Array<{ name: string; value: number; color?: string }> }>({ url: '/api/hr/departments', params: companyParam ? { company: companyParam } : {} });
  const attendance = useOdooQuery<{ empleados: Array<{ nombre: string; horas_trabajadas: number; horas_extra: number; departamento: string }> }>({ url: '/api/hr/attendance', params });

  // Filtrar departamentos
  const filteredDepts = useMemo(() => {
    if (!departments.data?.data) return [];
    if (!deptFilter.trim()) return departments.data.data;
    const q = deptFilter.toLowerCase();
    return departments.data.data.filter(d => d.name.toLowerCase().includes(q));
  }, [departments.data, deptFilter]);

  // Procesar asistencia: filtrar, ordenar, paginar
  const processedAttendance = useMemo(() => {
    let list = attendance.data?.empleados || [];

    // Filtro por nombre o departamento
    if (attFilter.trim()) {
      const q = attFilter.toLowerCase();
      list = list.filter(e => e.nombre.toLowerCase().includes(q) || e.departamento.toLowerCase().includes(q));
    }

    // Ordenar
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (attSort) {
        case 'nombre': cmp = a.nombre.localeCompare(b.nombre); break;
        case 'horas_trabajadas': cmp = a.horas_trabajadas - b.horas_trabajadas; break;
        case 'horas_extra': cmp = a.horas_extra - b.horas_extra; break;
        case 'departamento': cmp = a.departamento.localeCompare(b.departamento); break;
      }
      return attSortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [attendance.data, attFilter, attSort, attSortDir]);

  const attTotalPages = Math.max(1, Math.ceil(processedAttendance.length / ATT_PAGE_SIZE));
  const paginatedAttendance = processedAttendance.slice((attPage - 1) * ATT_PAGE_SIZE, attPage * ATT_PAGE_SIZE);

  const handleAttSort = (field: AttSortField) => {
    if (attSort === field) {
      setAttSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setAttSort(field);
      setAttSortDir('desc');
    }
    setAttPage(1);
  };

  const SortIcon = ({ field }: { field: AttSortField }) => (
    <ArrowUpDown className={`inline h-3 w-3 ml-1 ${attSort === field ? 'text-blue-600' : 'text-gray-300'}`} />
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Recursos Humanos</h1>
        <p className="text-sm text-gray-500">Plantilla, asistencia y costes de nomina</p>
      </div>

      {(summary.error || departments.error || attendance.error) && (
        <ErrorMessage message={summary.error || departments.error || attendance.error} onRetry={() => { summary.refetch(); departments.refetch(); attendance.refetch(); }} />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Empleados activos" value={summary.data?.empleados_activos ?? 0} format="integer" icon={<Users className="h-4 w-4" />} loading={summary.loading} />
        <KPICard title="Nuevas altas" value={summary.data?.nuevas_altas ?? 0} format="integer" icon={<UserPlus className="h-4 w-4" />} trendPositive="up" loading={summary.loading} />
        <KPICard title="Horas registradas" value={summary.data?.horas_mes ?? 0} format="integer" icon={<Clock className="h-4 w-4" />} loading={summary.loading} subtitle="este periodo" />
        <KPICard title="Coste nomina" value={summary.data?.coste_nomina ?? 0} format="currency" icon={<Euro className="h-4 w-4" />} trendPositive="down" loading={summary.loading} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Empleados por departamento con filtro */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
              <CardTitle>Empleados por departamento</CardTitle>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filtrar..."
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-40"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {departments.loading ? (
              <div className="h-[300px] flex items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" /></div>
            ) : filteredDepts.length ? (
              <BarChartComponent data={filteredDepts} layout="horizontal" height={Math.max(300, filteredDepts.length * 45)} color="#8b5cf6" />
            ) : departments.data?.data?.length && deptFilter ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">No hay departamentos que coincidan</div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-sm text-gray-400">Sin datos de departamentos</div>
            )}
          </CardContent>
        </Card>

        {/* Resumen de asistencia con filtros y paginación */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
              <CardTitle>Resumen de asistencia</CardTitle>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar empleado..."
                  value={attFilter}
                  onChange={e => { setAttFilter(e.target.value); setAttPage(1); }}
                  className="rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {attendance.loading ? (
              <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : processedAttendance.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500">
                        <th className="pb-2 font-medium cursor-pointer select-none hover:text-gray-900" onClick={() => handleAttSort('nombre')}>
                          Empleado <SortIcon field="nombre" />
                        </th>
                        <th className="pb-2 font-medium text-right cursor-pointer select-none hover:text-gray-900" onClick={() => handleAttSort('horas_trabajadas')}>
                          Horas <SortIcon field="horas_trabajadas" />
                        </th>
                        <th className="pb-2 font-medium text-right cursor-pointer select-none hover:text-gray-900" onClick={() => handleAttSort('horas_extra')}>
                          Extra <SortIcon field="horas_extra" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAttendance.map((emp, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2">
                            <div className="text-gray-700">{emp.nombre}</div>
                            <div className="text-xs text-gray-400">{emp.departamento}</div>
                          </td>
                          <td className="py-2 text-right font-medium text-gray-700 whitespace-nowrap">{emp.horas_trabajadas.toFixed(1)}h</td>
                          <td className="py-2 text-right whitespace-nowrap">
                            {emp.horas_extra > 0 ? <Badge variant="warning">+{emp.horas_extra.toFixed(1)}h</Badge> : <span className="text-gray-400">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginacion */}
                {attTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-2">
                    <p className="text-xs text-gray-500">
                      {processedAttendance.length} empleados{attFilter ? ` (filtrado)` : ''}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAttPage(p => Math.max(1, p - 1))}
                        disabled={attPage <= 1}
                        className="rounded-lg p-1 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="h-4 w-4 text-gray-600" />
                      </button>
                      <span className="text-xs text-gray-600">{attPage}/{attTotalPages}</span>
                      <button
                        onClick={() => setAttPage(p => Math.min(attTotalPages, p + 1))}
                        disabled={attPage >= attTotalPages}
                        className="rounded-lg p-1 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="h-4 w-4 text-gray-600" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : attendance.data?.empleados?.length && attFilter ? (
              <p className="text-sm text-gray-500">No se encontraron empleados</p>
            ) : (
              <p className="text-sm text-gray-400">Sin datos de asistencia</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
