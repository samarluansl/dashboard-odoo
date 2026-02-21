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
import type { FinancialSummary, CashFlowData } from '@/types';
import { TrendingUp, CreditCard, ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight, ArrowUpDown, Search, AlertTriangle } from 'lucide-react';

type SortField = 'partner' | 'amount' | 'due_date' | 'days_overdue';
type SortDir = 'asc' | 'desc';

export default function FinancieroPage() {
  const { companyParam, dateFrom, dateTo } = useCompanyFilter();

  // Facturas vencidas: paginación, filtro, ordenación
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceFilter, setInvoiceFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('days_overdue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const PAGE_SIZE = 20;

  const params = useMemo(() => {
    const p: Record<string, string> = { date_from: dateFrom, date_to: dateTo };
    if (companyParam) p.company = companyParam;
    return p;
  }, [dateFrom, dateTo, companyParam]);

  const financial = useOdooQuery<FinancialSummary>({ url: '/api/financial/summary', params });
  const cashflow = useOdooQuery<CashFlowData>({ url: '/api/financial/cashflow', params: companyParam ? { company: companyParam } : {} });
  const treasury = useOdooQuery<{ data: { fecha: string; valor: number }[] }>({ url: '/api/financial/treasury', params });

  const dso = useOdooQuery<{ dso: number; ventas_periodo: number; cuentas_cobrar: number }>({
    url: '/api/financial/dso', params,
  });

  const overdueInvoices = useOdooQuery<{
    total: number; count: number;
    facturas: Array<{ partner: string; amount: number; due_date: string; days_overdue: number }>;
  }>({ url: '/api/financial/overdue', params: companyParam ? { company: companyParam } : {} });

  // Procesar facturas: filtrar, ordenar, paginar
  const processedInvoices = useMemo(() => {
    let list = overdueInvoices.data?.facturas || [];

    // Filtro por cliente
    if (invoiceFilter.trim()) {
      const q = invoiceFilter.toLowerCase();
      list = list.filter(f => f.partner.toLowerCase().includes(q));
    }

    // Ordenar
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'partner': cmp = a.partner.localeCompare(b.partner); break;
        case 'amount': cmp = a.amount - b.amount; break;
        case 'due_date': cmp = a.due_date.localeCompare(b.due_date); break;
        case 'days_overdue': cmp = a.days_overdue - b.days_overdue; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [overdueInvoices.data, invoiceFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processedInvoices.length / PAGE_SIZE));
  const paginatedInvoices = processedInvoices.slice((invoicePage - 1) * PAGE_SIZE, invoicePage * PAGE_SIZE);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setInvoicePage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown className={`inline h-3 w-3 ml-1 ${sortField === field ? 'text-blue-600' : 'text-gray-300'}`} />
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Financiero</h1>
        <p className="text-sm text-gray-500">Cuenta de resultados, tesorería y cobros</p>
      </div>

      {/* Errores */}
      {(financial.error || cashflow.error || dso.error || overdueInvoices.error) && (
        <ErrorMessage
          message={financial.error || cashflow.error || dso.error || overdueInvoices.error}
          onRetry={() => { financial.refetch(); cashflow.refetch(); dso.refetch(); overdueInvoices.refetch(); }}
        />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard title="Ingresos" value={financial.data?.explotacion.ingresos ?? 0} format="currency" icon={<ArrowDownCircle className="h-4 w-4" />} loading={financial.loading} />
        <KPICard title="Gastos" value={Math.abs(financial.data?.explotacion.gastos ?? 0)} format="currency" icon={<ArrowUpCircle className="h-4 w-4" />} trendPositive="down" loading={financial.loading} />
        <KPICard title="Resultado" value={financial.data?.resultado_antes_impuestos ?? 0} format="currency" icon={<TrendingUp className="h-4 w-4" />} loading={financial.loading} />
        <KPICard title="Impagos" value={overdueInvoices.data?.total ?? 0} format="currency" icon={<AlertTriangle className="h-4 w-4" />} trendPositive="down" loading={overdueInvoices.loading} subtitle={`${overdueInvoices.data?.count ?? 0} facturas vencidas`} />
        <KPICard title="DSO" value={dso.data?.dso ?? 0} format="days" icon={<CreditCard className="h-4 w-4" />} trendPositive="down" loading={dso.loading} subtitle="dias de cobro" />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Evolucion de tesoreria</CardTitle></CardHeader>
          <CardContent>
            {treasury.loading ? <LoadingChart /> : treasury.data?.data?.length ? <TreasuryChart data={treasury.data.data} /> : <EmptyChart />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cuenta de resultados</CardTitle></CardHeader>
          <CardContent>
            {financial.loading ? (
              <div className="space-y-3">{[1,2,3,4,5,6,7].map(i => <div key={i} className="h-5 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : financial.data ? (
              <div className="space-y-2">
                <Row label="Ingresos explotacion" value={financial.data.explotacion.ingresos} />
                <Row label="Gastos explotacion" value={financial.data.explotacion.gastos} />
                <Row label="Rdo. explotacion" value={financial.data.explotacion.resultado} bold />
                <div className="border-t my-2" />
                <Row label="Ingresos financieros" value={financial.data.financiero.ingresos} />
                <Row label="Gastos financieros" value={financial.data.financiero.gastos} />
                <Row label="Rdo. financiero" value={financial.data.financiero.resultado} bold />
                <div className="border-t my-2 border-gray-300" />
                <Row label="Resultado antes impuestos" value={financial.data.resultado_antes_impuestos} bold big />
              </div>
            ) : <p className="text-sm text-gray-400">Sin datos</p>}
          </CardContent>
        </Card>
      </div>

      {/* Facturas vencidas — con filtro, ordenación y paginación */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full">
            <div className="flex items-center gap-3">
              <CardTitle>Facturas vencidas</CardTitle>
              {overdueInvoices.data && (
                <Badge variant={overdueInvoices.data.count > 0 ? 'danger' : 'success'}>
                  {overdueInvoices.data.count} pendientes &middot; {fmtEur2(overdueInvoices.data.total)}
                </Badge>
              )}
            </div>
            {/* Buscador de cliente */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Filtrar por cliente..."
                value={invoiceFilter}
                onChange={e => { setInvoiceFilter(e.target.value); setInvoicePage(1); }}
                className="rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-56"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {overdueInvoices.loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : processedInvoices.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="pb-2 font-medium cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort('partner')}>
                        Cliente <SortIcon field="partner" />
                      </th>
                      <th className="pb-2 font-medium text-right cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort('amount')}>
                        Importe <SortIcon field="amount" />
                      </th>
                      <th className="pb-2 font-medium text-right cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort('due_date')}>
                        Vencimiento <SortIcon field="due_date" />
                      </th>
                      <th className="pb-2 font-medium text-right cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort('days_overdue')}>
                        Dias <SortIcon field="days_overdue" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedInvoices.map((f, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 text-gray-700">{f.partner}</td>
                        <td className="py-2 text-right font-medium text-red-600 whitespace-nowrap">{fmtEur2(f.amount)}</td>
                        <td className="py-2 text-right text-gray-500 whitespace-nowrap">{fmtDate(f.due_date)}</td>
                        <td className="py-2 text-right whitespace-nowrap">
                          <Badge variant={f.days_overdue > 60 ? 'danger' : f.days_overdue > 30 ? 'warning' : 'default'}>{f.days_overdue}d</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-3">
                <p className="text-xs text-gray-500">
                  {processedInvoices.length} facturas{invoiceFilter ? ` (filtrado de ${overdueInvoices.data?.facturas?.length || 0})` : ''}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setInvoicePage(p => Math.max(1, p - 1))}
                    disabled={invoicePage <= 1}
                    className="rounded-lg p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Pagina anterior"
                  >
                    <ChevronLeft className="h-4 w-4 text-gray-600" />
                  </button>
                  <span className="text-sm text-gray-600">
                    {invoicePage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setInvoicePage(p => Math.min(totalPages, p + 1))}
                    disabled={invoicePage >= totalPages}
                    className="rounded-lg p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Pagina siguiente"
                  >
                    <ChevronRight className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
              </div>
            </>
          ) : overdueInvoices.data?.facturas?.length && invoiceFilter ? (
            <p className="text-sm text-gray-500">No se encontraron facturas para &quot;{invoiceFilter}&quot;</p>
          ) : (
            <p className="text-sm text-emerald-600">Sin facturas vencidas</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, bold, big }: { label: string; value: number; bold?: boolean; big?: boolean }) {
  const color = value > 0 ? 'text-emerald-600' : value < 0 ? 'text-red-600' : 'text-gray-500';
  return (
    <div className="flex justify-between py-0.5">
      <span className={`text-sm ${bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{label}</span>
      <span className={`${big ? 'text-lg' : 'text-sm'} ${bold ? 'font-bold' : 'font-medium'} ${color}`}>{fmtEur2(value)}</span>
    </div>
  );
}

function LoadingChart() {
  return <div className="h-[260px] flex items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" /></div>;
}

function EmptyChart() {
  return <div className="h-[260px] flex items-center justify-center text-sm text-gray-400">Sin datos para el periodo seleccionado</div>;
}
