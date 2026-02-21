'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { KPICard } from '@/components/dashboard/KPICard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ErrorMessage } from '@/components/ui/error-message';
import { useOdooQuery } from '@/lib/hooks/useOdooQuery';
import { useCompanyFilter } from '@/lib/context/CompanyContext';
import { fmtEur2, cn } from '@/lib/utils';
import { Target, Trophy, TrendingUp, Users, ArrowUpDown, Search, ChevronLeft, ChevronRight, ChevronDown, Check, X, UserPlus, UserMinus, AlertTriangle, CheckCircle } from 'lucide-react';

/* ── Multi-select dropdown para etapas CRM ── */
function StageMultiSelect({
  stages,
  selected,
  onChange,
  placeholder = 'Todas las etapas',
}: {
  stages: string[];
  selected: string[];
  onChange: (stages: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [open]);

  const toggle = (stage: string) => {
    onChange(selected.includes(stage) ? selected.filter(s => s !== stage) : [...selected, stage]);
  };

  const count = selected.length;
  const label = count === 0 ? placeholder : count === 1 ? selected[0] : `${count} etapas`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-sm shadow-sm transition-colors',
          'hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
          count > 0 ? 'border-blue-300 text-blue-700' : 'border-gray-300 text-gray-700',
        )}
      >
        <span className="truncate max-w-[180px]">{label}</span>
        {count > 0 && (
          <span
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); onChange([]); }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onChange([]); } }}
            className="ml-0.5 rounded-full p-0.5 hover:bg-blue-100 cursor-pointer"
            title="Limpiar filtro"
          >
            <X className="h-3 w-3" />
          </span>
        )}
        <ChevronDown className={cn('h-3.5 w-3.5 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 min-w-[240px] max-w-[320px] rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {/* Seleccionar todas */}
          <button
            type="button"
            onClick={() => onChange([])}
            className={cn(
              'flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-gray-50',
              count === 0 ? 'text-blue-700 font-medium' : 'text-gray-600',
            )}
          >
            <div className={cn(
              'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
              count === 0 ? 'border-blue-500 bg-blue-500' : 'border-gray-300',
            )}>
              {count === 0 && <Check className="h-3 w-3 text-white" />}
            </div>
            {placeholder}
          </button>

          <div className="my-1 border-t border-gray-100" />

          <div className="max-h-64 overflow-y-auto">
            {stages.map(stage => {
              const active = selected.includes(stage);
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => toggle(stage)}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-gray-50',
                    active ? 'text-blue-700' : 'text-gray-700',
                  )}
                >
                  <div className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                    active ? 'border-blue-500 bg-blue-500' : 'border-gray-300',
                  )}>
                    {active && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span>{stage}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

type CRMSummary = { oportunidades_activas: number; pipeline_value: number; ganadas: number; perdidas: number; tasa_conversion: number; altas: number; bajas: number; impagos: number; posibles_bajas: number; clubs_activos: number };
type Club = { name: string; partner: string; stage: string; stage_id: number; fecha_alta: string | null; ingreso: number };
type ClubSortField = 'name' | 'partner' | 'stage' | 'ingreso';
type SortDir = 'asc' | 'desc';

// Etapas CRM en orden del pipeline (hardcoded por ID)
const CRM_STAGE_ORDER = [
  'Forms',
  'BBDD / Potenciales clientes',
  'Negociando Oportunidad',
  'Contrato en preparación',
  'Contrato enviado',
  'Firmados + Proceso Onboarding + MKT',
  'Arrancado',
  'Impagos',
  'Posible baja',
  'Standby',
  'No interesados',
  'Perdidos',
  'Clubes sin respuesta',
];

export default function CRMPage() {
  const { companyParam, dateFrom, dateTo, prevDateFrom, prevDateTo } = useCompanyFilter();

  // Filtros pipeline
  const [selectedStages, setSelectedStages] = useState<string[]>([]);

  // Filtros tabla clubs
  const [clubFilter, setClubFilter] = useState('');
  const [clubStageFilter, setClubStageFilter] = useState<string[]>([]);
  const [clubSort, setClubSort] = useState<ClubSortField>('ingreso');
  const [clubSortDir, setClubSortDir] = useState<SortDir>('desc');
  const [clubPage, setClubPage] = useState(1);
  const CLUB_PAGE_SIZE = 15;

  const params = useMemo(() => {
    const p: Record<string, string> = { date_from: dateFrom, date_to: dateTo };
    if (companyParam) p.company = companyParam;
    return p;
  }, [dateFrom, dateTo, companyParam]);

  const prevParams = useMemo(() => {
    const p: Record<string, string> = { date_from: prevDateFrom, date_to: prevDateTo };
    if (companyParam) p.company = companyParam;
    return p;
  }, [prevDateFrom, prevDateTo, companyParam]);

  const summary = useOdooQuery<CRMSummary>({ url: '/api/crm/summary', params });
  const prevSummary = useOdooQuery<CRMSummary>({ url: '/api/crm/summary', params: prevParams });
  const pipeline = useOdooQuery<{ stages: Array<{ name: string; value: number; count: number; color?: string }> }>({ url: '/api/crm/pipeline', params: companyParam ? { company: companyParam } : {} });
  const clubsList = useOdooQuery<{ clubs: Club[] }>({ url: '/api/crm/top-deals', params });

  // Etapas para filtros — siempre las 13 en orden del pipeline
  const allStages = CRM_STAGE_ORDER;

  // Pipeline filtrado por etapas seleccionadas
  const filteredPipeline = useMemo(() => {
    if (!pipeline.data?.stages) return [];
    if (selectedStages.length === 0) return pipeline.data.stages;
    return pipeline.data.stages.filter(s => selectedStages.includes(s.name));
  }, [pipeline.data, selectedStages]);

  // KPIs filtrados
  const filteredOps = useMemo(() => {
    if (selectedStages.length === 0) return { count: summary.data?.oportunidades_activas ?? 0, value: summary.data?.pipeline_value ?? 0 };
    const count = filteredPipeline.reduce((s, st) => s + st.count, 0);
    const value = filteredPipeline.reduce((s, st) => s + st.value, 0);
    return { count, value };
  }, [filteredPipeline, selectedStages, summary.data]);

  // Clubs: filtrar, ordenar, paginar
  const processedClubs = useMemo(() => {
    let list = clubsList.data?.clubs || [];

    // Filtro global de etapas (el de arriba)
    if (selectedStages.length > 0) {
      list = list.filter(c => selectedStages.includes(c.stage));
    }

    if (clubFilter.trim()) {
      const q = clubFilter.toLowerCase();
      list = list.filter(c => c.partner.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
    }

    // Filtro adicional de etapas dentro de la tabla
    if (clubStageFilter.length > 0) {
      list = list.filter(c => clubStageFilter.includes(c.stage));
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (clubSort) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'partner': cmp = a.partner.localeCompare(b.partner); break;
        case 'stage': cmp = a.stage.localeCompare(b.stage); break;
        case 'ingreso': cmp = a.ingreso - b.ingreso; break;
      }
      return clubSortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [clubsList.data, selectedStages, clubFilter, clubStageFilter, clubSort, clubSortDir]);

  const clubTotalPages = Math.max(1, Math.ceil(processedClubs.length / CLUB_PAGE_SIZE));
  const paginatedClubs = processedClubs.slice((clubPage - 1) * CLUB_PAGE_SIZE, clubPage * CLUB_PAGE_SIZE);

  const handleClubSort = (field: ClubSortField) => {
    if (clubSort === field) {
      setClubSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setClubSort(field);
      setClubSortDir('desc');
    }
    setClubPage(1);
  };

  const SortIcon = ({ field }: { field: ClubSortField }) => (
    <ArrowUpDown className={`inline h-3 w-3 ml-1 ${clubSort === field ? 'text-blue-600' : 'text-gray-300'}`} />
  );

  const d = summary.data;
  const p = prevSummary.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CRM</h1>
        <p className="text-sm text-gray-500">Pipeline, conversiones y oportunidades</p>
      </div>

      {(summary.error || pipeline.error || clubsList.error) && (
        <ErrorMessage message={summary.error || pipeline.error || clubsList.error} onRetry={() => { summary.refetch(); pipeline.refetch(); clubsList.refetch(); }} />
      )}

      {/* Filtro por etapas */}
      {allStages.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Etapas:</span>
          <StageMultiSelect
            stages={allStages}
            selected={selectedStages}
            onChange={setSelectedStages}
            placeholder="Todas las etapas"
          />
        </div>
      )}

      {/* KPIs — fila 1: 4 principales */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Clubs activos" value={d?.clubs_activos ?? 0} previousValue={p?.clubs_activos} format="integer" icon={<CheckCircle className="h-4 w-4" />} trendPositive="up" loading={summary.loading} />
        <KPICard title="Oportunidades" value={filteredOps.count} previousValue={p?.oportunidades_activas} format="integer" icon={<Target className="h-4 w-4" />} loading={summary.loading} />
        <KPICard title="Altas" value={d?.altas ?? 0} previousValue={p?.altas} format="integer" icon={<UserPlus className="h-4 w-4" />} trendPositive="up" loading={summary.loading} subtitle="este periodo" />
        <KPICard title="Bajas" value={d?.bajas ?? 0} previousValue={p?.bajas} format="integer" icon={<UserMinus className="h-4 w-4" />} trendPositive="down" loading={summary.loading} subtitle="este periodo" />
      </div>
      {/* KPIs — fila 2: 3 secundarios */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
        <KPICard title="Posibles bajas" value={d?.posibles_bajas ?? 0} previousValue={p?.posibles_bajas} format="integer" icon={<AlertTriangle className="h-4 w-4" />} trendPositive="down" loading={summary.loading} />
        <KPICard title="Impagos" value={d?.impagos ?? 0} previousValue={p?.impagos} format="integer" icon={<AlertTriangle className="h-4 w-4" />} trendPositive="down" loading={summary.loading} />
        <KPICard title="Conversión" value={d?.tasa_conversion ?? 0} previousValue={p?.tasa_conversion} format="percent" icon={<Users className="h-4 w-4" />} trendPositive="up" loading={summary.loading} />
      </div>

      {/* Pipeline por etapa — tabla con números */}
      <Card>
        <CardHeader><CardTitle>Pipeline por etapa</CardTitle></CardHeader>
        <CardContent>
          {pipeline.loading ? (
            <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : filteredPipeline.length ? (
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-2 pr-4 font-medium" style={{ width: '35%' }}>Etapa</th>
                    <th className="pb-2 pr-4 font-medium text-right" style={{ width: '80px' }}>Clubs</th>
                    <th className="pb-2 font-medium" style={{ width: '50%' }}>Proporción</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const maxCount = Math.max(...filteredPipeline.map(s => s.count), 1);
                    const totalCount = filteredPipeline.reduce((s, st) => s + st.count, 0) || 1;
                    return filteredPipeline.map((stage, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 pr-4 font-medium text-gray-900 whitespace-nowrap">{stage.name}</td>
                        <td className="py-2.5 pr-4 text-right text-gray-700 font-medium tabular-nums">{stage.count}</td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${(stage.count / maxCount) * 100}%`,
                                  backgroundColor: stage.color || '#f59e0b',
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-400 tabular-nums w-8 text-right shrink-0">{((stage.count / totalCount) * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td className="pt-3 pr-4 font-semibold text-gray-900">Total</td>
                    <td className="pt-3 pr-4 text-right font-semibold text-gray-900 tabular-nums">{filteredPipeline.reduce((s, st) => s + st.count, 0)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">Sin datos de pipeline</div>
          )}
        </CardContent>
      </Card>

      {/* Clubs — tabla con ingreso facturado, filtros y paginación */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full">
            <div className="flex items-center gap-3">
              <CardTitle>Clubs</CardTitle>
              {clubsList.data && (
                <Badge variant="default">{processedClubs.length} clubs</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar club..."
                  value={clubFilter}
                  onChange={e => { setClubFilter(e.target.value); setClubPage(1); }}
                  className="rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-44"
                />
              </div>
              <StageMultiSelect
                stages={allStages}
                selected={clubStageFilter}
                onChange={(stages) => { setClubStageFilter(stages); setClubPage(1); }}
                placeholder="Todas las etapas"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {clubsList.loading ? (
            <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : processedClubs.length > 0 ? (
            <>
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="pb-2 pr-3 font-medium cursor-pointer select-none hover:text-gray-900" onClick={() => handleClubSort('name')}>
                        Club <SortIcon field="name" />
                      </th>
                      <th className="pb-2 pr-3 font-medium cursor-pointer select-none hover:text-gray-900 hidden sm:table-cell" onClick={() => handleClubSort('partner')}>
                        Cliente <SortIcon field="partner" />
                      </th>
                      <th className="pb-2 pr-3 font-medium text-right cursor-pointer select-none hover:text-gray-900 whitespace-nowrap" onClick={() => handleClubSort('ingreso')}>
                        Ingreso <SortIcon field="ingreso" />
                      </th>
                      <th className="pb-2 font-medium cursor-pointer select-none hover:text-gray-900 whitespace-nowrap" onClick={() => handleClubSort('stage')}>
                        Etapa <SortIcon field="stage" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedClubs.map((club, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 pr-3">
                          <div className="text-gray-900 font-medium truncate max-w-[200px]">{club.name}</div>
                          <div className="text-xs text-gray-400 truncate max-w-[200px] sm:hidden">{club.partner}</div>
                        </td>
                        <td className="py-2 pr-3 text-gray-600 hidden sm:table-cell"><div className="truncate max-w-[150px]">{club.partner}</div></td>
                        <td className="py-2 pr-3 text-right font-semibold text-gray-900 whitespace-nowrap tabular-nums">{club.ingreso > 0 ? fmtEur2(club.ingreso) : <span className="text-gray-300">—</span>}</td>
                        <td className="py-2"><Badge variant="info"><span className="truncate max-w-[140px] sm:max-w-[200px] inline-block">{club.stage}</span></Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginacion — siempre visible */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-3">
                <p className="text-xs text-gray-500">
                  {processedClubs.length} clubs{clubFilter || clubStageFilter.length > 0 || selectedStages.length > 0 ? ` (filtrado de ${clubsList.data?.clubs?.length || 0})` : ''}
                </p>
                {clubTotalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setClubPage(p => Math.max(1, p - 1))}
                      disabled={clubPage <= 1}
                      className="rounded-lg p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-4 w-4 text-gray-600" />
                    </button>
                    <span className="text-sm text-gray-600">{clubPage} / {clubTotalPages}</span>
                    <button
                      onClick={() => setClubPage(p => Math.min(clubTotalPages, p + 1))}
                      disabled={clubPage >= clubTotalPages}
                      className="rounded-lg p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-4 w-4 text-gray-600" />
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : clubsList.data?.clubs?.length && (clubFilter || clubStageFilter.length > 0 || selectedStages.length > 0) ? (
            <p className="text-sm text-gray-500">No se encontraron clubs con los filtros aplicados</p>
          ) : (
            <p className="text-sm text-gray-400">Sin clubs</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
