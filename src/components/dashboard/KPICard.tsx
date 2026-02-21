'use client';

import { Card } from '@/components/ui/card';
import { fmtEur, fmtEur2, fmtInt, fmtPct, cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Download } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: number;
  previousValue?: number;
  format?: 'currency' | 'currency2' | 'integer' | 'percent' | 'days';
  icon?: React.ReactNode;
  trendPositive?: 'up' | 'down'; // Is "up" trend good?
  subtitle?: string;
  loading?: boolean;
  onExport?: () => void;
}

export function KPICard({
  title,
  value,
  previousValue,
  format = 'currency',
  icon,
  trendPositive = 'up',
  subtitle,
  loading = false,
  onExport,
}: KPICardProps) {
  const formatValue = (v: number) => {
    switch (format) {
      case 'currency': return fmtEur(v);
      case 'currency2': return fmtEur2(v);
      case 'integer': return fmtInt(v);
      case 'percent': return fmtPct(v);
      case 'days': return `${Math.round(v)}d`;
      default: return String(v);
    }
  };

  const change = previousValue && previousValue !== 0
    ? ((value - previousValue) / Math.abs(previousValue)) * 100
    : null;

  const isPositive = change !== null && (
    trendPositive === 'up' ? change > 0 : change < 0
  );
  const isNegative = change !== null && !isPositive && change !== 0;

  return (
    <Card className="relative group">
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-500">{title}</span>
          <div className="flex items-center gap-1">
            {onExport && (
              <button
                onClick={onExport}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100"
                title="Exportar"
              >
                <Download className="h-3.5 w-3.5 text-gray-400" />
              </button>
            )}
            {icon && <div className="text-gray-400">{icon}</div>}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
          </div>
        ) : (
          <>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight truncate">
              {formatValue(value)}
            </p>

            <div className="flex items-center gap-2 mt-1.5">
              {change !== null && (
                <span className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-medium',
                  isPositive ? 'text-emerald-600' : isNegative ? 'text-red-600' : 'text-gray-500'
                )}>
                  {change > 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : change < 0 ? (
                    <TrendingDown className="h-3.5 w-3.5" />
                  ) : (
                    <Minus className="h-3.5 w-3.5" />
                  )}
                  {change > 0 ? '+' : ''}{fmtPct(change)}
                </span>
              )}
              {subtitle && (
                <span className="text-xs text-gray-400">{subtitle}</span>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
