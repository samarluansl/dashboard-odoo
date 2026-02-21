'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { KPICard } from '@/components/dashboard/KPICard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ErrorMessage } from '@/components/ui/error-message';
import { useOdooQuery } from '@/lib/hooks/useOdooQuery';
import { useCompanyFilter } from '@/lib/context/CompanyContext';
import { fmtEur2, cn } from '@/lib/utils';
import { Target, Trophy, TrendingUp, Users, ArrowUpDown, Search, ChevronLeft, ChevronRight, ChevronDown, Check, X, UserPlus, UserMinus, AlertTriangle } from 'lucide-react';

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

type DealSortField = 'expected_revenue' | 'partner' | 'stage' | 'probability';
type SortDir = 'asc' | 'desc';

export default function CRMPage() {
  const { companyParam, dateFrom, dateTo } = useCompanyFilter();

  // Filtros pipeline
  const [selectedStages, setSelectedStages] = useState<string[]>([]);

  // Filtros top deals
  const [dealFilter, setDealFilter] = useState('');
  const [dealStageFilter, setDealStageFilter] = useState<string[]>([]);
  const [dealSort, setDealSort] = useState<DealSortField>('expected_revenue');
  const [dealSortDir, setDealSortDir] = useState<SortDir>('desc');
  const [dealPage, setDealPage] = useState(1);
  const DEAL_PAGE_SIZE = 15;

  const params = useMemo(() => {
    const p: Record<string, string> = { date_from: dateFrom, date_to: dateTo };
    if (companyParam) p.company = companyParam;
    return p;
  }, [dateFrom, dateTo, companyParam]);

  const summary = useOdooQuery<{ oportunidades_activas: number; pipeline_value: number; ganadas: number; perdidas: number; tasa_conversion: number; altas: number; bajas: number; impagos: number; impagos_value: number }>({ url: '/api/crm/summary', params });
  const pipeline = useOdooQuery<{ stages: Array<{ name: string; value: number; count: number; color?: string }> }>({ url: '/api/crm/pipeline', params: companyParam ? { company: companyParam } : {} });
  const topDeals = useOdooQuery<{ deals: Array<{ name: string; partner: string; expected_revenue: number; stage: string; probability: number }> }>({ url: '/api/crm/top-deals', params: companyParam ? { company: companyParam } : {} });

  // Etapas únicas para filtros
  const allStages = useMemo(() => {
    const stages = new Set<string>();
    pipeline.data?.stages?.forEach(s => stages.add(s.name));
    topDeals.data?.deals?.forEach(d => stages.add(d.stage));
    return [...stages].sort();
  }, [pipeline.data, topDeals.data]);

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

  // Top deals: filtrar, ordenar, paginar
  const processedDeals = useMemo(() => {
    let list = topDeals.data?.deals || [];

    // Filtro por cliente
    if (dealFilter.trim()) {
      const q = dealFilter.toLowerCase();
      list = list.filter(d => d.partner.toLowerCase().includes(q) || d.name.toLowerCase().includes(q));
    }

    // Filtro por etapa(s)
    if (dealStageFilter.length > 0) {
      list = list.filter(d => dealStageFilter.includes(d.stage));
    }

    // Ordenar
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (dealSort) {
        case 'expected_revenue': cmp = a.expected_revenue - b.expected_revenue; break;
        case 'partner': cmp = a.partner.localeCompare(b.partner); break;
        case 'stage': cmp = a.stage.localeCompare(b.stage); break;
        case 'probability': cmp = a.probability - b.probability; break;
      }
      return dealSortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [topDeals.data, dealFilter, dealStageFilter, dealSort, dealSortDir]);

  const dealTotalPages = Math.max(1, Math.ceil(processedDeals.length / DEAL_PAGE_SIZE));
  const paginatedDeals = processedDeals.slice((dealPage - 1) * DEAL_PAGE_SIZE, dealPage * DEAL_PAGE_SIZE);

  const handleDealSort = (field: DealSortField) => {
    if (dealSort === field) {
      setDealSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setDealSort(field);
      setDealSortDir('desc');
    }
    setDealPage(1);
  };

  const SortIcon = ({ field }: { field: DealSortField }) => (
    <ArrowUpDown className={`inline h-3 w-3 ml-1 ${dealSort === field ? 'text-blue-600' : 'text-gray-300'}`} />
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CRM</h1>
        <p className="text-sm text-gray-500">Pipeline, conversiones y oportunidades</p>
      </div>

      {(summary.error || pipeline.error || topDeals.error) && (
        <ErrorMessage message={summary.error || pipeline.error || topDeals.error} onRetry={() => { summary.refetch(); pipeline.refetch(); topDeals.refetch(); }} />
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <KPICard title="Oportunidades" value={filteredOps.count} format="integer" icon={<Target className="h-4 w-4" />} loading={summary.loading} />
        <KPICard title="Valor pipeline" value={filteredOps.value} format="currency" icon={<TrendingUp className="h-4 w-4" />} loading={summary.loading} />
        <KPICard title="Altas" value={summary.data?.altas ?? 0} format="integer" icon={<UserPlus className="h-4 w-4" />} trendPositive="up" loading={summary.loading} subtitle="este periodo" />
        <KPICard title="Bajas" value={summary.data?.bajas ?? 0} format="integer" icon={<UserMinus className="h-4 w-4" />} trendPositive="down" loading={summary.loading} subtitle="este periodo" />
        <KPICard title="Ganadas" value={summary.data?.ganadas ?? 0} format="integer" icon={<Trophy className="h-4 w-4" />} trendPositive="up" loading={summary.loading} subtitle={`${summary.data?.perdidas ?? 0} perdidas`} />
        <KPICard title="Impagos" value={summary.data?.impagos ?? 0} format="integer" icon={<AlertTriangle className="h-4 w-4" />} trendPositive="down" loading={summary.loading} subtitle={summary.data?.impagos_value ? fmtEur2(summary.data.impagos_value) : undefined} />
        <KPICard title="Conversion" value={summary.data?.tasa_conversion ?? 0} format="percent" icon={<Users className="h-4 w-4" />} trendPositive="up" loading={summary.loading} />
      </div>

      {/* Pipeline por etapa — tabla con números */}
      <Card>
        <CardHeader><CardTitle>Pipeline por etapa</CardTitle></CardHeader>
        <CardContent>
          {pipeline.loading ? (
            <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : filteredPipeline.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-2 font-medium">Etapa</th>
                    <th className="pb-2 font-medium text-right">Oportunidades</th>
                    <th className="pb-2 font-medium text-right">Valor</th>
                    <th className="pb-2 font-medium" style={{ width: '40%' }}>Proporcion</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const maxVal = Math.max(...filteredPipeline.map(s => s.value), 1);
                    return filteredPipeline.map((stage, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 font-medium text-gray-900">{stage.name}</td>
                        <td className="py-2.5 text-right text-gray-600">{stage.count}</td>
                        <td className="py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap">{fmtEur2(stage.value)}</td>
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${(stage.value / maxVal) * 100}%`,
                                  backgroundColor: stage.color || '#f59e0b',
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-400 w-10 text-right">{((stage.value / (filteredPipeline.reduce((s, st) => s + st.value, 0) || 1)) * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td className="pt-2 font-semibold text-gray-900">Total</td>
                    <td className="pt-2 text-right font-semibold text-gray-900">{filteredPipeline.reduce((s, st) => s + st.count, 0)}</td>
                    <td className="pt-2 text-right font-bold text-gray-900 whitespace-nowrap">{fmtEur2(filteredPipeline.reduce((s, st) => s + st.value, 0))}</td>
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

      {/* Top oportunidades — con filtros y paginación */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full">
            <CardTitle>Top oportunidades</CardTitle>
            <div className="flex flex-wrap gap-2">
              {/* Filtro por cliente */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filtrar cliente..."
                  value={dealFilter}
                  onChange={e => { setDealFilter(e.target.value); setDealPage(1); }}
                  className="rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
                />
              </div>
              {/* Filtro por etapa */}
              <StageMultiSelect
                stages={allStages}
                selected={dealStageFilter}
                onChange={(stages) => { setDealStageFilter(stages); setDealPage(1); }}
                placeholder="Todas las etapas"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {topDeals.loading ? (
            <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : processedDeals.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="pb-2 font-medium">Oportunidad</th>
                      <th className="pb-2 font-medium cursor-pointer select-none hover:text-gray-900" onClick={() => handleDealSort('partner')}>
                        Cliente <SortIcon field="partner" />
                      </th>
                      <th className="pb-2 font-medium text-right cursor-pointer select-none hover:text-gray-900" onClick={() => handleDealSort('expected_revenue')}>
                        Importe <SortIcon field="expected_revenue" />
                      </th>
                      <th className="pb-2 font-medium cursor-pointer select-none hover:text-gray-900" onClick={() => handleDealSort('stage')}>
                        Etapa <SortIcon field="stage" />
                      </th>
                      <th className="pb-2 font-medium text-right cursor-pointer select-none hover:text-gray-900" onClick={() => handleDealSort('probability')}>
                        Prob. <SortIcon field="probability" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDeals.map((deal, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 text-gray-900 font-medium truncate max-w-[200px]">{deal.name}</td>
                        <td className="py-2 text-gray-600 truncate max-w-[150px]">{deal.partner}</td>
                        <td className="py-2 text-right font-semibold text-gray-900 whitespace-nowrap">{fmtEur2(deal.expected_revenue)}</td>
                        <td className="py-2"><Badge variant="info">{deal.stage}</Badge></td>
                        <td className="py-2 text-right text-gray-500">{deal.probability}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginacion */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-3">
                <p className="text-xs text-gray-500">
                  {processedDeals.length} oportunidades{dealFilter || dealStageFilter.length > 0 ? ` (filtrado de ${topDeals.data?.deals?.length || 0})` : ''}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDealPage(p => Math.max(1, p - 1))}
                    disabled={dealPage <= 1}
                    className="rounded-lg p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4 text-gray-600" />
                  </button>
                  <span className="text-sm text-gray-600">{dealPage} / {dealTotalPages}</span>
                  <button
                    onClick={() => setDealPage(p => Math.min(dealTotalPages, p + 1))}
                    disabled={dealPage >= dealTotalPages}
                    className="rounded-lg p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
              </div>
            </>
          ) : topDeals.data?.deals?.length && (dealFilter || dealStageFilter.length > 0) ? (
            <p className="text-sm text-gray-500">No se encontraron oportunidades con los filtros aplicados</p>
          ) : (
            <p className="text-sm text-gray-400">Sin oportunidades</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
