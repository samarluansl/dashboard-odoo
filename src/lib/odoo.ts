/**
 * Motor Odoo compartido — reutiliza la lógica de odoo.js del bot de WhatsApp.
 * Las API routes de Next.js llaman a estas funciones directamente.
 *
 * IMPORTANTE: Este archivo se importa SOLO en el servidor (API routes).
 * NUNCA importar desde componentes cliente.
 *
 * Architecture: delegates to odoo-client.ts, odoo-cache.ts, odoo-companies.ts
 */

import { modelsClient, call, authenticate, resetUid, isHtmlError } from './odoo-client';
import { getCached, setCached, getInflight, setInflight, deleteInflight, getStaticCached, setStaticCached } from './odoo-cache';

// Re-export everything from sub-modules for backward compatibility
export { listCompanies, getCompanyId, resolveCompany, resolveCompanies } from './odoo-companies';

/**
 * Execute an Odoo RPC call with caching, in-flight deduplication, and automatic retry on HTML errors.
 * This is the primary entry point for all Odoo data access from API routes.
 *
 * @param model  - Odoo model name (e.g. 'account.move', 'crm.lead')
 * @param method - Odoo method (e.g. 'search_read', 'read_group', 'search_count')
 * @param args   - Positional arguments (domain, fields, groupby, etc.)
 * @param kwargs - Keyword arguments (limit, order, lazy, etc.)
 */
export async function execute(model: string, method: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}): Promise<unknown> {
  const cacheKey = JSON.stringify({ model, method, args, kwargs });

  // Resultado cacheado (instancia warm de Vercel)
  const cached = getCached(cacheKey);
  if (cached !== undefined) return cached;

  // Si ya hay una llamada idéntica en vuelo, reutilizarla
  const existing = getInflight(cacheKey);
  if (existing) return existing;

  const doCall = async () => {
    const currentUid = await authenticate();
    return call(modelsClient, 'execute_kw', [
      process.env.ODOO_DB,
      currentUid,
      process.env.ODOO_API_KEY,
      model,
      method,
      args,
      kwargs,
    ]);
  };

  // FIX #9: Register promise in inflight map BEFORE starting async execution
  const promise = (async () => {
    try {
      const result = await doCall();
      setCached(cacheKey, result);
      return result;
    } catch (err) {
      // Odoo devolvió HTML — resetear uid y reintentar con jitter para no saturar Odoo
      if (isHtmlError(err)) {
        resetUid();
        const jitter = 200 + Math.random() * 800; // 200–1000ms aleatorio
        await new Promise(resolve => setTimeout(resolve, jitter));
        const result = await doCall();
        setCached(cacheKey, result);
        return result;
      }
      throw err;
    } finally {
      deleteInflight(cacheKey);
    }
  })();

  // Set inflight BEFORE awaiting — fixes race condition (#9)
  setInflight(cacheKey, promise);
  return promise;
}

// ═══ HELPERS ═══
/** Round a number to 2 decimal places. Used for financial amounts in API responses. */
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Execute an Odoo RPC call with LONG-LIVED static cache (10 min).
 * Use for data that changes very rarely: account type lists, company lists, etc.
 * NOT suitable for transactional data (invoices, leads, balances).
 */
export async function executeStatic(model: string, method: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}): Promise<unknown> {
  const cacheKey = `static::${JSON.stringify({ model, method, args, kwargs })}`;

  const cached = getStaticCached(cacheKey);
  if (cached !== undefined) return cached;

  const result = await execute(model, method, args, kwargs);
  setStaticCached(cacheKey, result);
  return result;
}
