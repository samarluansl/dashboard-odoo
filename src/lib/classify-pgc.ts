/**
 * Clasificacion PGC (Plan General Contable) centralizada.
 * Clasifica cuentas contables en ingresos/gastos de explotacion y financieros.
 * Usada por financial/summary y chat.
 */

export interface PGCResult {
  ingExpl: number;
  gasExpl: number;
  ingFin: number;
  gasFin: number;
}

export interface AccountInfo {
  id: number;
  code: string;
  account_type: string;
}

export interface GroupEntry {
  account_id: [number, string];
  balance: number;
}

/**
 * Clasifica grupos contables agrupados por cuenta segun PGC.
 * Las cuentas 7x son ingresos (76/77 = financieros, resto = explotacion).
 * Las cuentas 6x son gastos (66/67 = financieros, resto = explotacion).
 */
export function classifyPGC(groups: GroupEntry[], accounts: AccountInfo[]): PGCResult {
  let ingExpl = 0, gasExpl = 0, ingFin = 0, gasFin = 0;

  // PERF: Build lookup map once — O(n) instead of O(n*m) with Array.find per group
  const accountMap = new Map<number, AccountInfo>();
  for (const account of accounts) accountMap.set(account.id, account);

  /** PGC subgroups that are financial (not operating) */
  const FINANCIAL_INCOME_SUBGROUPS = new Set(['76', '77']);
  const FINANCIAL_EXPENSE_SUBGROUPS = new Set(['66', '67']);

  for (const group of groups) {
    const accountId = group.account_id?.[0];
    const account = accountMap.get(accountId);
    if (!account) continue;

    const groupDigit = account.code.charAt(0);
    const subgroup = account.code.substring(0, 2); // Primeros 2 digitos: subgrupo PGC
    const balance = group.balance ?? 0;

    // Cuentas grupo 7 = ingresos, grupo 6 = gastos.
    // Subgrupos 76/77 y 66/67 son financieros, el resto de explotacion.
    // En Odoo read_group, balance negativo en 7x = ingreso; positivo en 6x = gasto.
    if (groupDigit === '7') {
      const isFinancial = FINANCIAL_INCOME_SUBGROUPS.has(subgroup);
      if (isFinancial) {
        if (balance < 0) ingFin += Math.abs(balance);
        else gasFin += balance;
      } else {
        if (balance < 0) ingExpl += Math.abs(balance);
        else gasExpl += balance;
      }
    } else if (groupDigit === '6') {
      const isFinancial = FINANCIAL_EXPENSE_SUBGROUPS.has(subgroup);
      if (isFinancial) {
        if (balance > 0) gasFin += balance;
        else ingFin += Math.abs(balance);
      } else {
        if (balance > 0) gasExpl += balance;
        else ingExpl += Math.abs(balance);
      }
    }
  }

  return { ingExpl, gasExpl, ingFin, gasFin };
}
