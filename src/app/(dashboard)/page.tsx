'use client';

import { useMemo } from 'react';
import { KPICard } from '@/components/dashboard/KPICard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TreasuryChart } from '@/components/charts/TreasuryChart';
import { BarChartComponent } from '@/components/charts/BarChart';
import { Badge } from '@/components/ui/badge';
import { ErrorMessage } from '@/components/ui/error-message';
import { useOdooQuery } from '@/lib/hooks/useOdooQuery';
import { useCompanyFilter } from '@/lib/context/CompanyContext';
import type { FinancialSummary, CashFlowData } from '@/types';
import {
  Euro, TrendingUp, CreditCard, Clock,
  Users, Target, RefreshCw, AlertTriangle,
} from 'lucide-react';

export default function DashboardPage() {
  const { companyParam, dateFrom, dateTo } = useCompanyFilter();

  // Parámetros base
  const params = useMemo(() => {
    const p: Record<string, string> = { date_from: dateFrom, date_to: dateTo };
    if (companyParam) p.company = companyParam;
    return p;
  }, [dateFrom, dateTo, companyParam]);

  // Período anterior para comparar (para KPIs con tendencia)
  const prevRange = useMemo(() => {
    const diffMs = new Date(dateTo).getTime() - new Date(dateFrom).getTime();
    const prevTo = new Date(new Date(dateFrom).getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - diffMs);
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return { from: fmt(prevFrom), to: fmt(prevTo) };
  }, [dateFrom, dateTo]);

  const prevParams = useMemo(() => {
    const p: Record<string, string> = { date_from: prevRange.from, date_to: prevRange.to };
    if (companyParam) p.company = companyParam;
    return p;
  }, [prevRange, companyParam]);

  // ═══ QUERIES ═══
  const financial = useOdooQuery<FinancialSummary>({
    url: '/api/financial/summary',
    params,
  });

  const prevFinancial = useOdooQuery<FinancialSummary>({
    url: '/api/financial/summary',
    params: prevParams,
  });

  const cashflow = useOdooQuery<CashFlowData>({
    url: '/api/financial/cashflow',
    params: companyParam ? { company: companyParam } : {},
  });

  const treasury = useOdooQuery<{ data: { fecha: string; valor: number }[] }>({
    url: '/api/financial/treasury',
    params,
  });

  const hrSummary = useOdooQuery<{
    empleados_activos: number;
    nuevas_altas: number;
    horas_mes: number;
    coste_nomina: number;
  }>({
    url: '/api/hr/summary',
    params,
  });

  const crmSummary = useOdooQuery<{
    oportunidades_activas: number;
    pipeline_value: number;
    ganadas: number;
    tasa_conversion: number;
  }>({
    url: '/api/crm/summary',
    params,
  });

  const subscriptions = useOdooQuery<{
    mrr: number;
    activas: number;
    nuevas: number;
    churn_rate: number;
  }>({
    url: '/api/subscriptions/summary',
    params,
  });

  const alerts = useOdooQuery<{ count: number; critical: number }>({
    url: '/api/alerts/count',
    params: companyParam ? { company: companyParam } : {},
  });

  // Datos para gráfico de barras de empresas
  const topCompanies = useOdooQuery<{ data: { name: string; value: number; color?: string }[] }>({
    url: '/api/financial/top-companies',
    params,
  });

  return (
    <div className="space-y-6">
      {/* Header con filtros */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Visión general del grupo empresarial
        </p>
      </div>

      {/* Errores */}
      {(financial.error || cashflow.error || treasury.error) && (
        <ErrorMessage
          message={financial.error || cashflow.error || treasury.error}
          onRetry={() => {
            if (financial.error) financial.refetch();
            if (cashflow.error) cashflow.refetch();
            if (treasury.error) treasury.refetch();
          }}
        />
      )}

      {/* KPIs principales — fila 1 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Ingresos"
          value={financial.data?.explotacion.ingresos ?? 0}
          previousValue={prevFinancial.data?.explotacion.ingresos}
          format="currency"
          icon={<Euro className="h-4 w-4" />}
          trendPositive="up"
          loading={financial.loading}
          subtitle="vs período anterior"
        />
        <KPICard
          title="Resultado neto"
          value={financial.data?.resultado_antes_impuestos ?? 0}
          previousValue={prevFinancial.data?.resultado_antes_impuestos}
          format="currency"
          icon={<TrendingUp className="h-4 w-4" />}
          trendPositive="up"
          loading={financial.loading}
          subtitle="antes de impuestos"
        />
        <KPICard
          title="Tesorería"
          value={cashflow.data?.tesoreria ?? 0}
          format="currency"
          icon={<CreditCard className="h-4 w-4" />}
          loading={cashflow.loading}
          subtitle="saldo actual"
        />
        <KPICard
          title="Posición neta"
          value={cashflow.data?.posicion_neta ?? 0}
          format="currency"
          icon={<CreditCard className="h-4 w-4" />}
          trendPositive="up"
          loading={cashflow.loading}
          subtitle="tesorería + cobros − pagos"
        />
      </div>

      {/* KPIs secundarios — fila 2 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Empleados activos"
          value={hrSummary.data?.empleados_activos ?? 0}
          format="integer"
          icon={<Users className="h-4 w-4" />}
          loading={hrSummary.loading}
        />
        <KPICard
          title="Pipeline CRM"
          value={crmSummary.data?.pipeline_value ?? 0}
          format="currency"
          icon={<Target className="h-4 w-4" />}
          loading={crmSummary.loading}
          subtitle={`${crmSummary.data?.oportunidades_activas ?? 0} oportunidades`}
        />
        <KPICard
          title="MRR Suscripciones"
          value={subscriptions.data?.mrr ?? 0}
          format="currency"
          icon={<RefreshCw className="h-4 w-4" />}
          loading={subscriptions.loading}
          subtitle={`${subscriptions.data?.activas ?? 0} activas`}
        />
        <KPICard
          title="Alertas activas"
          value={alerts.data?.count ?? 0}
          format="integer"
          icon={<AlertTriangle className="h-4 w-4" />}
          trendPositive="down"
          loading={alerts.loading}
          subtitle={alerts.data?.critical ? `${alerts.data.critical} críticas` : undefined}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tesorería evolución */}
        <Card>
          <CardHeader>
            <CardTitle>Evolución de tesorería</CardTitle>
          </CardHeader>
          <CardContent>
            {treasury.loading ? (
              <div className="h-[260px] flex items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
              </div>
            ) : treasury.data?.data?.length ? (
              <TreasuryChart data={treasury.data.data} />
            ) : (
              <div className="h-[260px] flex items-center justify-center text-sm text-gray-400">
                Sin datos para el período seleccionado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top empresas por ingresos */}
        <Card>
          <CardHeader>
            <CardTitle>Ingresos por empresa</CardTitle>
          </CardHeader>
          <CardContent>
            {topCompanies.loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
              </div>
            ) : topCompanies.data?.data?.length ? (
              <BarChartComponent data={topCompanies.data.data} layout="horizontal" height={Math.max(300, topCompanies.data.data.length * 45)} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-sm text-gray-400">
                Sin datos para el período seleccionado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumen P&L + Cobros/Pagos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* P&L resumido */}
        <Card>
          <CardHeader>
            <CardTitle>Cuenta de resultados</CardTitle>
            {financial.data && (
              <Badge variant="info">{financial.data.periodo}</Badge>
            )}
          </CardHeader>
          <CardContent>
            {financial.loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-5 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : financial.data ? (
              <div className="space-y-3">
                <PLRow label="Ingresos explotación" value={financial.data.explotacion.ingresos} positive />
                <PLRow label="Gastos explotación" value={financial.data.explotacion.gastos} />
                <PLRow label="Rdo. explotación" value={financial.data.explotacion.resultado} bold />
                <div className="border-t border-gray-100 pt-2">
                  <PLRow label="Ingresos financieros" value={financial.data.financiero.ingresos} positive />
                  <PLRow label="Gastos financieros" value={financial.data.financiero.gastos} />
                  <PLRow label="Rdo. financiero" value={financial.data.financiero.resultado} bold />
                </div>
                <div className="border-t border-gray-200 pt-2">
                  <PLRow label="Resultado antes de impuestos" value={financial.data.resultado_antes_impuestos} bold big />
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Sin datos disponibles</p>
            )}
          </CardContent>
        </Card>

        {/* Cash flow */}
        <Card>
          <CardHeader>
            <CardTitle>Posición de caja</CardTitle>
          </CardHeader>
          <CardContent>
            {cashflow.loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-5 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : cashflow.data ? (
              <div className="space-y-4">
                <CashRow
                  label="Tesorería"
                  value={cashflow.data.tesoreria}
                  color="text-blue-600"
                />
                <CashRow
                  label={`Cobros pendientes (${cashflow.data.cobros_count})`}
                  value={cashflow.data.cobros_pendientes}
                  color="text-emerald-600"
                />
                <CashRow
                  label={`Pagos pendientes (${cashflow.data.pagos_count})`}
                  value={-cashflow.data.pagos_pendientes}
                  color="text-red-600"
                />
                <div className="border-t border-gray-200 pt-3">
                  <CashRow
                    label="Posición neta"
                    value={cashflow.data.posicion_neta}
                    color={cashflow.data.posicion_neta >= 0 ? 'text-emerald-700' : 'text-red-700'}
                    bold
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Sin datos disponibles</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══ Componentes auxiliares ═══

function PLRow({ label, value, positive, bold, big }: {
  label: string;
  value: number;
  positive?: boolean;
  bold?: boolean;
  big?: boolean;
}) {
  const formatted = (Math.abs(value) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const color = value > 0 ? 'text-emerald-600' : value < 0 ? 'text-red-600' : 'text-gray-500';

  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={`text-sm ${bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
        {label}
      </span>
      <span className={`${big ? 'text-lg' : 'text-sm'} ${bold ? 'font-bold' : 'font-medium'} ${color}`}>
        {value < 0 ? '-' : ''}{formatted}
      </span>
    </div>
  );
}

function CashRow({ label, value, color, bold }: {
  label: string;
  value: number;
  color: string;
  bold?: boolean;
}) {
  const formatted = Math.abs(value).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
        {label}
      </span>
      <span className={`text-sm font-semibold ${color}`}>
        {value < 0 ? '-' : ''}{formatted}
      </span>
    </div>
  );
}
