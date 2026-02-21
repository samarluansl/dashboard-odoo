import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formato español: 1.234,56€ */
export function fmtEur(n: number, decimals = 0): string {
  return (n || 0).toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + '€';
}

/** Formato español con 2 decimales */
export function fmtEur2(n: number): string {
  return fmtEur(n, 2);
}

/** Formato entero español: 1.234 */
export function fmtInt(n: number): string {
  return (n || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 });
}

/** Formato porcentaje: 12,5% */
export function fmtPct(n: number, decimals = 1): string {
  return (n || 0).toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + '%';
}

/** Fecha ISO → dd/mm/yyyy */
export function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split(' ')[0].split('-');
  return `${d}/${m}/${y}`;
}

/** Color del KPI según tendencia */
export function trendColor(value: number, positive: 'up' | 'down' = 'up'): string {
  if (value === 0) return 'text-gray-500';
  if (positive === 'up') return value > 0 ? 'text-emerald-600' : 'text-red-600';
  return value < 0 ? 'text-emerald-600' : 'text-red-600';
}

/** Períodos rápidos */
export function getDateRange(period: string): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based

  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

  // Rango personalizado: "custom:2026-01-01_2026-02-15"
  if (period.startsWith('custom:')) {
    const [, range] = period.split('custom:');
    const [from, to] = range.split('_');
    if (from && to) return { from, to };
  }

  switch (period) {
    case 'this_month':
      return { from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(lastDay(y, m))}` };
    case 'last_month': {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      return { from: `${ly}-${pad(lm + 1)}-01`, to: `${ly}-${pad(lm + 1)}-${pad(lastDay(ly, lm))}` };
    }
    case 'this_quarter': {
      const qStart = Math.floor(m / 3) * 3;
      const qEnd = qStart + 2;
      return { from: `${y}-${pad(qStart + 1)}-01`, to: `${y}-${pad(qEnd + 1)}-${pad(lastDay(y, qEnd))}` };
    }
    case 'this_year':
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'last_year':
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    default:
      return { from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(lastDay(y, m))}` };
  }
}
