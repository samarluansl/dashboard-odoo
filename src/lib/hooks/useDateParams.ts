import { useMemo } from 'react';
import { useCompanyFilter } from '@/lib/context/CompanyContext';

/**
 * Build date + company query params for current and previous period.
 * Eliminates the duplicated params/prevParams construction found in every dashboard page.
 */
export function useDateParams() {
  const { companyParam, dateFrom, dateTo, prevDateFrom, prevDateTo } = useCompanyFilter();

  const params = useMemo(() => {
    const p: Record<string, string> = { date_from: dateFrom, date_to: dateTo };
    if (companyParam) p.company = companyParam;
    return p;
  }, [dateFrom, dateTo, companyParam]);

  const prevParams = useMemo(() => {
    const p: Record<string, string> = { date_from: prevDateFrom, date_to: prevDateTo };
    if (companyParam) p.company = companyParam;
    return p;
  }, [prevDateFrom, prevDateTo, companyParam]);

  /** Params with only company filter (no date range). Used for cashflow, overdue, etc. */
  const companyOnlyParams = useMemo((): Record<string, string> => {
    return companyParam ? { company: companyParam } : {};
  }, [companyParam]);

  return { params, prevParams, companyOnlyParams, companyParam, dateFrom, dateTo };
}
