'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Building2, Check, ChevronDown, X } from 'lucide-react';
import { COMPANIES } from '@/lib/companies';

export function CompanyMultiSelect({ selected, onChange }: { selected: string[]; onChange: (c: string[]) => void }) {
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

  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };

  const count = selected.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm w-full',
          'hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
          count > 0 ? 'border-blue-300 text-blue-700' : 'border-gray-300 text-gray-600',
        )}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate text-left flex-1">
          {count === 0 ? 'Todas las empresas' : `${count} empresas`}
        </span>
        {count > 0 && (
          <span
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); onChange([]); }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onChange([]); } }}
            className="rounded-full p-0.5 hover:bg-blue-100 cursor-pointer"
          >
            <X className="h-3 w-3" />
          </span>
        )}
        <ChevronDown className={cn('h-3.5 w-3.5 text-gray-400 transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-72 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => onChange([])}
            className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50', count === 0 ? 'text-blue-700 font-medium' : 'text-gray-600')}
          >
            <div className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', count === 0 ? 'border-blue-500 bg-blue-500' : 'border-gray-300')}>
              {count === 0 && <Check className="h-3 w-3 text-white" />}
            </div>
            Todas
          </button>
          <div className="my-1 border-t border-gray-100" />
          <div className="max-h-52 overflow-y-auto">
            {COMPANIES.map(c => {
              const active = selected.includes(c.value);
              return (
                <button key={c.value} type="button" onClick={() => toggle(c.value)}
                  className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50', active ? 'text-blue-700' : 'text-gray-700')}
                >
                  <div className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', active ? 'border-blue-500 bg-blue-500' : 'border-gray-300')}>
                    {active && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className="truncate">{c.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
