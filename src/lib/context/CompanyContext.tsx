'use client';

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { getDateRange, getPreviousDateRange } from '@/lib/utils';

interface FilterContextType {
  /** Array de empresas seleccionadas (vacío = todas) */
  selectedCompanies: string[];
  /** Seleccionar/deseleccionar una empresa */
  toggleCompany: (company: string) => void;
  /** Seleccionar todas (limpiar selección) */
  selectAll: () => void;
  /** String para pasar como param a la API (comma-separated) */
  companyParam: string;
  /** Período seleccionado (ej: 'this_month', 'custom:2026-01-01_2026-02-15') */
  period: string;
  /** Cambiar el período */
  setPeriod: (period: string) => void;
  /** Fechas calculadas del período */
  dateFrom: string;
  dateTo: string;
  /** Fechas del período anterior (misma duración) */
  prevDateFrom: string;
  prevDateTo: string;
  /** Empresas permitidas para este usuario (vacío = todas, admin sin restricción) */
  allowedCompanies: string[];
}

const FilterContext = createContext<FilterContextType | null>(null);

interface CompanyProviderProps {
  children: ReactNode;
  /** Empresas que el usuario puede ver. Vacío = todas (admin). */
  allowedCompanies?: string[];
}

export function CompanyProvider({ children, allowedCompanies = [] }: CompanyProviderProps) {
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [period, setPeriod] = useState('this_month');

  const toggleCompany = useCallback((company: string) => {
    setSelectedCompanies(prev => {
      if (prev.includes(company)) {
        return prev.filter(c => c !== company);
      }
      return [...prev, company];
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedCompanies([]);
  }, []);

  const companyParam = useMemo(() => selectedCompanies.join(','), [selectedCompanies]);
  const { from: dateFrom, to: dateTo } = useMemo(() => getDateRange(period), [period]);
  const { from: prevDateFrom, to: prevDateTo } = useMemo(() => getPreviousDateRange(dateFrom, dateTo), [dateFrom, dateTo]);

  return (
    <FilterContext.Provider value={{ selectedCompanies, toggleCompany, selectAll, companyParam, period, setPeriod, dateFrom, dateTo, prevDateFrom, prevDateTo, allowedCompanies }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useCompanyFilter(): FilterContextType {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useCompanyFilter debe usarse dentro de CompanyProvider');
  return ctx;
}
