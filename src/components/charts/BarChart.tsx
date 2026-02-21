'use client';

import {
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { fmtEur } from '@/lib/utils';

interface BarChartProps {
  data: { name: string; value: number; color?: string }[];
  color?: string;
  title?: string;
  height?: number;
  layout?: 'vertical' | 'horizontal';
}

export function BarChartComponent({ data, color = '#3b82f6', title, height = 300, layout = 'vertical' }: BarChartProps) {
  const formatTick = (v: number) => {
    if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(1)}M€`;
    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k€`;
    return `${v}€`;
  };

  if (layout === 'horizontal') {
    return (
      <div className="w-full">
        {title && <h4 className="text-sm font-medium text-gray-500 mb-3">{title}</h4>}
        <ResponsiveContainer width="100%" height={height}>
          <RechartsBarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tickFormatter={formatTick} tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} width={130} interval={0} />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [fmtEur(Number(value)), 'Importe']}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color || color} />
              ))}
            </Bar>
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="w-full">
      {title && <h4 className="text-sm font-medium text-gray-500 mb-3">{title}</h4>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <YAxis tickFormatter={formatTick} tick={{ fontSize: 11, fill: '#9ca3af' }} width={55} />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [fmtEur(Number(value)), 'Importe']}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color || color} />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
