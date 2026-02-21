'use client';

import { useState, useMemo } from 'react';
import { KPICard } from '@/components/dashboard/KPICard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TreasuryChart } from '@/components/charts/TreasuryChart';
import { Badge } from '@/components/ui/badge';
import { ErrorMessage } from '@/components/ui/error-message';
import { useOdooQuery } from '@/lib/hooks/useOdooQuery';
import { useCompanyFilter } from '@/lib/context/CompanyContext';
import { fmtEur2, fmtDate } from '@/lib/utils';
import { RefreshCw, TrendingUp, UserPlus, UserMinus, Search, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

/** Mapeo de estado Odoo 17 a etiqueta y variante de Badge */
const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }> = {
  '3_progress': { label: 'Activa', variant: 'success' },
  '4_paused': { label: 'Pausada', variant: 'warning' },
  '5_close': { label: 'Cerrada', variant: 'default' },
  '6_churn': { label: 'Baja', variant: 'danger' },
  '1_draft': { label: 'Borrador', variant: 'default' },
  '2_renewal': { label: 'Renovación', variant: 'success' },
};

type SubSortField = 'partner' | 'mrr' | 'start_date' | 'status';
type SortDir = 'asc' | 'desc';

type Subscription = {
  name: string;
  partner: string;
  mrr: number;
  start_date: string;
  next_invoice: string;
  status: string;
  status_label: string;
};

export default function SuscripcionesPage() {
  const { companyParam, dateFrom, dateTo } = useCompanyFilter();

  // Filtros y paginación para tabla
  const [subFilter, setSubFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState<SubSortField>('mrr');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const params = useMemo(() => {
    const p: Record<string, string> = { date_from: dateFrom, date_to: dateTo };
    if (companyParam) p.company = companyParam;
    return p;
  }, [dateFrom, dateTo, companyParam]);

  const summary = useOdooQuery<{ mrr: number; activas: number; nuevas: number; bajas: number; churn_rate: number }>({ url: '/api/subscriptions/summary', params });
  const mrrHistory = useOdooQuery<{ data: Array<{ fecha: string; valor: number }> }>({ url: '/api/subscriptions/mrr-history', params });
  const subscriptionsList = useOdooQuery<{ subscriptions: Subscription[] }>({ url: '/api/subscriptions/list', params: companyParam ? { company: companyParam } : {} });

  // Procesar suscripciones: filtrar, ordenar, paginar
  const processedSubs = useMemo(() => {
    let list = subscriptionsList.data?.subscriptions || [];

    // Filtro por estado
    if (statusFilter) {
      list = list.filter(s => s.status === statusFilter);
    }

    // Filtro por texto (cliente o nombre)
    if (subFilter.trim()) {
      const q = subFilter.toLowerCase();
      list = list.filter(s =>
        s.partner.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q)
      );
    }

    // Ordenar
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'partner': cmp = a.partner.localeCompare(b.partner); break;
        case 'mrr': cmp = a.mrr - b.mrr; break;
        case 'start_date': cmp = a.start_date.localeCompare(b.start_date); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [subscriptionsList.data, subFilter, statusFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processedSubs.length / PAGE_SIZE));
  const paginatedSubs = processedSubs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Estados disponibles en los datos
  const availableStatuses = useMemo(() => {
    const subs = subscriptionsList.data?.subscriptions || [];
    const statuses = [...new Set(subs.map(s => s.status))];
    return statuses.sort();
  }, [subscriptionsList.data]);

  const handleSort = (field: SubSortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  const SortIcon = ({ field }: { field: SubSortField }) => (
    <ArrowUpDown className={`inline h-3 w-3 ml-1 ${sortField === field ? 'text-blue-600' : 'text-gray-300'}`} />
  );

  const getStatusConfig = (status: string) =>
    STATUS_CONFIG[status] || { label: status, variant: 'default' as const };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Suscripciones</h1>
        <p className="text-sm text-gray-500">MRR, churn y métricas SaaS</p>
      </div>

      {(summary.error || mrrHistory.error || subscriptionsList.error) && (
        <ErrorMessage message={summary.error || mrrHistory.error || subscriptionsList.error} onRetry={() => { summary.refetch(); mrrHistory.refetch(); subscriptionsList.refetch(); }} />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard title="MRR" value={summary.data?.mrr ?? 0} format="currency" icon={<RefreshCw className="h-4 w-4" />} trendPositive="up" loading={summary.loading} subtitle={`${summary.data?.activas ?? 0} activas`} />
        <KPICard title="Altas" value={summary.data?.nuevas ?? 0} format="integer" icon={<UserPlus className="h-4 w-4" />} trendPositive="up" loading={summary.loading} subtitle="este período" />
        <KPICard title="Bajas" value={summary.data?.bajas ?? 0} format="integer" icon={<UserMinus className="h-4 w-4" />} trendPositive="down" loading={summary.loading} subtitle="este período" />
        <KPICard title="Churn rate" value={summary.data?.churn_rate ?? 0} format="percent" icon={<TrendingUp className="h-4 w-4" />} trendPositive="down" loading={summary.loading} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Evolución MRR</CardTitle></CardHeader>
          <CardContent>
            {mrrHistory.loading ? (
              <div className="h-[260px] flex items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" /></div>
            ) : mrrHistory.data?.data?.length ? (
              <TreasuryChart data={mrrHistory.data.data} color="#10b981" />
            ) : (
              <div className="h-[260px] flex items-center justify-center text-sm text-gray-400">Sin datos de MRR</div>
            )}
          </CardContent>
        </Card>

        {/* Suscripciones activas — con filtros, ordenación y paginación */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
              <CardTitle>Suscripciones activas</CardTitle>
              <div className="flex items-center gap-2">
                {/* Filtro de estado */}
                <select
                  value={statusFilter}
                  onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Todos</option>
                  {availableStatuses.map(s => (
                    <option key={s} value={s}>{getStatusConfig(s).label}</option>
                  ))}
                </select>
                {/* Buscador */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={subFilter}
                    onChange={e => { setSubFilter(e.target.value); setPage(1); }}
                    className="rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-40"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {subscriptionsList.loading ? (
              <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : processedSubs.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500">
                        <th className="pb-2 font-medium cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort('partner')}>
                          Suscripción <SortIcon field="partner" />
                        </th>
                        <th className="pb-2 font-medium text-right cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort('mrr')}>
                          MRR <SortIcon field="mrr" />
                        </th>
                        <th className="pb-2 font-medium text-right cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort('start_date')}>
                          Inicio <SortIcon field="start_date" />
                        </th>
                        <th className="pb-2 font-medium text-right cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort('status')}>
                          Estado <SortIcon field="status" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedSubs.map((sub, i) => {
                        const cfg = getStatusConfig(sub.status);
                        return (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2">
                              <div className="text-gray-700">{sub.partner}</div>
                              <div className="text-xs text-gray-400">{sub.name}</div>
                            </td>
                            <td className="py-2 text-right font-medium text-gray-900 whitespace-nowrap">{fmtEur2(sub.mrr)}</td>
                            <td className="py-2 text-right text-gray-500 whitespace-nowrap">{fmtDate(sub.start_date)}</td>
                            <td className="py-2 text-right whitespace-nowrap">
                              <Badge variant={cfg.variant}>{cfg.label}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginación — siempre visible */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-2">
                  <p className="text-xs text-gray-500">
                    {processedSubs.length} suscripciones{(subFilter || statusFilter) ? ` (filtrado de ${subscriptionsList.data?.subscriptions?.length || 0})` : ''}
                  </p>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="rounded-lg p-1 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="h-4 w-4 text-gray-600" />
                      </button>
                      <span className="text-xs text-gray-600">{page}/{totalPages}</span>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="rounded-lg p-1 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="h-4 w-4 text-gray-600" />
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : subscriptionsList.data?.subscriptions?.length && (subFilter || statusFilter) ? (
              <p className="text-sm text-gray-500">No se encontraron suscripciones</p>
            ) : (
              <p className="text-sm text-gray-400">Sin suscripciones</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
