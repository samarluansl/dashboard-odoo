'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { fmtEur } from '@/lib/utils';

interface TreasuryChartProps {
  data: { fecha: string; valor: number }[];
  color?: string;
  title?: string;
}

export function TreasuryChart({ data, color = '#3b82f6', title }: TreasuryChartProps) {
  // ID de gradiente SVG: quitar # y caracteres no válidos
  const gradId = `grad-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  const formatTick = (v: number) => {
    if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
    return String(v);
  };

  return (
    <div className="w-full">
      {title && <h4 className="text-sm font-medium text-gray-500 mb-3">{title}</h4>}
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.15} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <YAxis tickFormatter={formatTick} tick={{ fontSize: 11, fill: '#9ca3af' }} width={55} />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [fmtEur(Number(value)), 'Valor']}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
          />
          <Area
            type="monotone"
            dataKey="valor"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
