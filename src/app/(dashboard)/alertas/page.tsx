'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOdooQuery } from '@/lib/hooks/useOdooQuery';
import { useCompanyFilter } from '@/lib/context/CompanyContext';
import { ErrorMessage } from '@/components/ui/error-message';
import { fmtEur2, fmtDate } from '@/lib/utils';
import { AlertTriangle, AlertCircle, Info, Clock, EyeOff, Eye } from 'lucide-react';

const STORAGE_KEY = 'dashboard_ignored_alerts';

function getIgnoredAlerts(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function setIgnoredAlerts(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

type AlertItem = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  body: string;
  date: string;
};

export default function AlertasPage() {
  const { companyParam, dateFrom, dateTo } = useCompanyFilter();
  const [tab, setTab] = useState<'active' | 'ignored'>('active');
  const [ignoredIds, setIgnoredIds] = useState<string[]>([]);

  // Cargar ignoradas desde localStorage
  useEffect(() => {
    setIgnoredIds(getIgnoredAlerts());
  }, []);

  const params = useMemo(() => {
    const p: Record<string, string> = { date_from: dateFrom, date_to: dateTo };
    if (companyParam) p.company = companyParam;
    return p;
  }, [dateFrom, dateTo, companyParam]);

  const overdueInvoices = useOdooQuery<{
    total: number; count: number;
    facturas: Array<{ partner: string; amount: number; due_date: string; days_overdue: number; invoice: string }>;
  }>({ url: '/api/financial/overdue', params: companyParam ? { company: companyParam } : {} });

  // Construir alertas y filtrar por rango de fechas
  const allAlerts: AlertItem[] = useMemo(() => {
    const list: AlertItem[] = [];
    if (overdueInvoices.data?.facturas) {
      for (const f of overdueInvoices.data.facturas) {
        // Filtrar por rango de fechas si se ha seleccionado
        if (f.due_date) {
          if (f.due_date < dateFrom || f.due_date > dateTo) continue;
        }
        const id = `${f.invoice}_${f.partner}_${f.due_date}`;
        if (f.days_overdue > 60) {
          list.push({ id, severity: 'critical', title: `Factura ${f.invoice} muy vencida`, body: `${f.partner} — ${fmtEur2(f.amount)} con ${f.days_overdue} dias de retraso`, date: f.due_date });
        } else if (f.days_overdue > 30) {
          list.push({ id, severity: 'warning', title: `Factura ${f.invoice} vencida`, body: `${f.partner} — ${fmtEur2(f.amount)} con ${f.days_overdue} dias de retraso`, date: f.due_date });
        }
      }
    }
    return list;
  }, [overdueInvoices.data, dateFrom, dateTo]);

  const activeAlerts = useMemo(() => allAlerts.filter(a => !ignoredIds.includes(a.id)), [allAlerts, ignoredIds]);
  const ignoredAlerts = useMemo(() => allAlerts.filter(a => ignoredIds.includes(a.id)), [allAlerts, ignoredIds]);

  const criticalCount = activeAlerts.filter(a => a.severity === 'critical').length;
  const warningCount = activeAlerts.filter(a => a.severity === 'warning').length;

  const handleIgnore = useCallback((alertId: string) => {
    const next = [...ignoredIds, alertId];
    setIgnoredIds(next);
    setIgnoredAlerts(next);
  }, [ignoredIds]);

  const handleRestore = useCallback((alertId: string) => {
    const next = ignoredIds.filter(id => id !== alertId);
    setIgnoredIds(next);
    setIgnoredAlerts(next);
  }, [ignoredIds]);

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'warning': return <AlertCircle className="h-5 w-5 text-amber-500" />;
      default: return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const displayAlerts = tab === 'active' ? activeAlerts : ignoredAlerts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Alertas</h1>
        <p className="text-sm text-gray-500">
          {activeAlerts.length > 0 ? `${criticalCount} criticas, ${warningCount} advertencias` : 'Sin alertas pendientes'}
        </p>
      </div>

      {overdueInvoices.error && <ErrorMessage message={overdueInvoices.error} onRetry={overdueInvoices.refetch} />}

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className={criticalCount > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`h-8 w-8 ${criticalCount > 0 ? 'text-red-500' : 'text-gray-300'}`} />
              <div><p className="text-2xl font-bold text-gray-900">{criticalCount}</p><p className="text-sm text-gray-500">Criticas</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className={warningCount > 0 ? 'border-amber-200 bg-amber-50' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className={`h-8 w-8 ${warningCount > 0 ? 'text-amber-500' : 'text-gray-300'}`} />
              <div><p className="text-2xl font-bold text-gray-900">{warningCount}</p><p className="text-sm text-gray-500">Advertencias</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-gray-300" />
              <div><p className="text-2xl font-bold text-gray-900">{overdueInvoices.data ? fmtEur2(overdueInvoices.data.total) : '—'}</p><p className="text-sm text-gray-500">Importe vencido</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs activas / ignoradas */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('active')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'active'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Eye className="h-4 w-4" />
          Activas
          {activeAlerts.length > 0 && (
            <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-semibold">{activeAlerts.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab('ignored')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'ignored'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <EyeOff className="h-4 w-4" />
          Ignoradas
          {ignoredAlerts.length > 0 && (
            <span className="rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-xs font-semibold">{ignoredAlerts.length}</span>
          )}
        </button>
      </div>

      {/* Lista de alertas */}
      {overdueInvoices.loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : displayAlerts.length > 0 ? (
        <div className="space-y-3">
          {displayAlerts.map((alert) => (
            <Card key={alert.id} className={`hover:shadow-md transition-shadow ${tab === 'ignored' ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {severityIcon(alert.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{alert.title}</span>
                      <Badge variant={alert.severity === 'critical' ? 'danger' : 'warning'}>
                        {alert.severity === 'critical' ? 'Critica' : 'Advertencia'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{alert.body}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(alert.date)}</span>
                    {tab === 'active' ? (
                      <button
                        onClick={() => handleIgnore(alert.id)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                        title="Ignorar alerta"
                        aria-label="Ignorar alerta"
                      >
                        <EyeOff className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRestore(alert.id)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        title="Restaurar alerta"
                        aria-label="Restaurar alerta"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              {tab === 'active' ? <Info className="h-6 w-6 text-emerald-600" /> : <EyeOff className="h-6 w-6 text-gray-400" />}
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              {tab === 'active' ? 'Todo en orden' : 'Sin alertas ignoradas'}
            </h3>
            <p className="text-sm text-gray-500">
              {tab === 'active'
                ? 'No hay alertas pendientes para el periodo seleccionado.'
                : 'No has ignorado ninguna alerta.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
