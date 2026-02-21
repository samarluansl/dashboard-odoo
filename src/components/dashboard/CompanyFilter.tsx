'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { useCompanyFilter } from '@/lib/context/CompanyContext';
import { COMPANIES } from '@/lib/companies';
import { cn } from '@/lib/utils';

export function CompanyFilter() {
  const { selectedCompanies, toggleCompany, selectAll, allowedCompanies } = useCompanyFilter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Si el usuario tiene empresas restringidas, filtrar la lista
  const visibleCompanies = allowedCompanies.length > 0
    ? COMPANIES.filter(c => allowedCompanies.includes(c.value))
    : COMPANIES;

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [open]);

  const count = selectedCompanies.length;
  const label =
    count === 0
      ? (allowedCompanies.length > 0 ? `${visibleCompanies.length} empresas` : 'Todas las empresas')
      : count === 1
        ? visibleCompanies.find(c => c.value === selectedCompanies[0])?.label || selectedCompanies[0]
        : `${count} empresas`;

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition-colors',
          'hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
          count > 0 ? 'border-blue-300 text-blue-700' : 'border-gray-300 text-gray-700',
        )}
      >
        <span className="truncate max-w-[180px]">{label}</span>
        {count > 0 && (
          <span
            role="button"
            tabIndex={0}
            onClick={e => {
              e.stopPropagation();
              selectAll();
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); selectAll(); }
            }}
            className="ml-1 rounded-full p-0.5 hover:bg-blue-100 cursor-pointer"
            title="Limpiar filtro"
            aria-label="Quitar filtro de empresas"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
        <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 z-50 mt-1 min-w-[320px] max-w-[400px] rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {/* Seleccionar todas */}
          <button
            type="button"
            onClick={selectAll}
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
            Todas las empresas
          </button>

          <div className="my-1 border-t border-gray-100" />

          {/* Lista de empresas */}
          <div className="max-h-72 overflow-y-auto">
            {visibleCompanies.map(company => {
              const selected = selectedCompanies.includes(company.value);
              return (
                <button
                  key={company.value}
                  type="button"
                  onClick={() => toggleCompany(company.value)}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-gray-50',
                    selected ? 'text-blue-700' : 'text-gray-700',
                  )}
                >
                  <div className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                    selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300',
                  )}>
                    {selected && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span>{company.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
