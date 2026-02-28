/**
 * Motor Odoo compartido — reutiliza la lógica de odoo.js del bot de WhatsApp.
 * Las API routes de Next.js llaman a estas funciones directamente.
 *
 * IMPORTANTE: Este archivo se importa SOLO en el servidor (API routes).
 * NUNCA importar desde componentes cliente.
 */

import xmlrpc from 'xmlrpc';

const url = new URL(process.env.ODOO_URL!);
const isSecure = url.protocol === 'https:';
const createClient = isSecure ? xmlrpc.createSecureClient : xmlrpc.createClient;
const port = url.port ? parseInt(url.port) : (isSecure ? 443 : 80);

const commonClient = createClient({
  host: url.hostname,
  port,
  path: '/xmlrpc/2/common',
});

const modelsClient = createClient({
  host: url.hostname,
  port,
  path: '/xmlrpc/2/object',
});

function call(client: xmlrpc.Client, method: string, params: unknown[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err: Error | null, result: unknown) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

let uid: number | null = null;

// Cache de resultados (30s) + deduplicación de llamadas in-flight
const resultCache = new Map<string, { value: unknown; expiry: number }>();
const inflight = new Map<string, Promise<unknown>>();
const CACHE_TTL = 30_000;

function isHtmlError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('Unknown XML-RPC tag');
}

async function authenticate(): Promise<number> {
  if (uid) return uid;
  uid = (await call(commonClient, 'authenticate', [
    process.env.ODOO_DB,
    process.env.ODOO_USER,
    process.env.ODOO_API_KEY,
    {},
  ])) as number;
  if (!uid) throw new Error('Autenticación con Odoo fallida.');
  return uid;
}

export async function execute(model: string, method: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}): Promise<unknown> {
  const cacheKey = JSON.stringify({ model, method, args, kwargs });

  // Resultado cacheado (instancia warm de Vercel)
  const cached = resultCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) return cached.value;

  // Si ya hay una llamada idéntica en vuelo, reutilizarla
  const existing = inflight.get(cacheKey);
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

  const promise = (async () => {
    try {
      const result = await doCall();
      resultCache.set(cacheKey, { value: result, expiry: Date.now() + CACHE_TTL });
      return result;
    } catch (err) {
      // Odoo devolvió HTML — resetear uid y reintentar con jitter para no saturar Odoo
      if (isHtmlError(err)) {
        uid = null;
        const jitter = 200 + Math.random() * 800; // 200–1000ms aleatorio
        await new Promise(r => setTimeout(r, jitter));
        const result = await doCall();
        resultCache.set(cacheKey, { value: result, expiry: Date.now() + CACHE_TTL });
        return result;
      }
      throw err;
    } finally {
      inflight.delete(cacheKey);
    }
  })();

  inflight.set(cacheKey, promise);
  return promise;
}

// ═══ CACHE EMPRESAS ═══
interface CompanyCache {
  id: number;
  name: string;
}

let companiesCache: CompanyCache[] | null = null;

export async function listCompanies(): Promise<CompanyCache[]> {
  if (companiesCache) return companiesCache;
  const companies = (await execute('res.company', 'search_read', [[]], {
    fields: ['id', 'name'],
    order: 'id asc',
  })) as CompanyCache[];
  companiesCache = companies;
  return companies;
}

// Alias de empresa — sincronizado con bot WhatsApp (odoo.js COMPANY_ALIASES)
const companyAliases: Record<string, string> = {
  'samarluan': 'samarluan',
  'mps': 'matches padel solutions',
  'matches padel': 'matches padel solutions',
  'matches': 'matches padel solutions',
  'pm': 'padelmatches',
  'padelmatches': 'padelmatches',
  'padel matches': 'padelmatches',
  'smd': 'smd consultores',
  'smd consultores': 'smd consultores',
  'smd asesores': 'smd consultores',
  'viper': 'viper web tech',
  'dpm': 'davila property management',
  'davila property': 'davila property management',
  'dsu': 'domotic systems unit',
  'gasmedia': 'gasmedia systems',
  'lucky losers': 'lucky losers clothes',
  'padelprix': 'padelprix worldwide',
  'menthor': 'menthor padel academy',
  'r2pro': 'r2pro nextgen',
  'alexan': 'alexan events',
  'dayful': 'dayful studio',
  '365': '365 receptión',
  'receptión': '365 receptión',
  'recepcion': '365 receptión',
  'padelplay': 'padelplay 2022',
  'padel play': 'padelplay 2022',
  'baycamp': 'padelbaycamp',
  'padelbaycamp': 'padelbaycamp',
  'yvr': 'padel yvr',
  'padel yvr': 'padel yvr',
  'arsgode': 'arsgode',
  'danomaclean': 'danomaclean',
  'padelmunity': 'padelmunity',
  'assistantbot': 'assistantbot',
  'grupo': 'grupo',
};

export async function getCompanyId(name?: string): Promise<number | null> {
  if (!name) return null;
  const companies = await listCompanies();
  const lower = name.toLowerCase().trim();

  // Buscar alias
  const alias = companyAliases[lower];
  const searchTerm = alias || lower;

  const match = companies.find(c => c.name.toLowerCase().includes(searchTerm));
  return match?.id || null;
}

export async function resolveCompany(company_name?: string) {
  const companyId = await getCompanyId(company_name);
  if (company_name && !companyId) {
    return { companyId: null, label: null as string | null, error: `No se encontró la empresa "${company_name}".` };
  }
  const label = companyId
    ? (companiesCache?.find(c => c.id === companyId)?.name || company_name || 'Todas')
    : 'Todas';
  return { companyId, label, error: null };
}

/**
 * Resolver múltiples empresas separadas por coma.
 * Retorna un array de IDs y un dominio Odoo para filtrar.
 */
export async function resolveCompanies(companyParam?: string) {
  if (!companyParam || companyParam.trim() === '') {
    return { companyIds: null, label: 'Todas', domain: [] as unknown[], error: null };
  }

  const names = companyParam.split(',').map(s => s.trim()).filter(Boolean);
  const ids: number[] = [];
  const labels: string[] = [];

  for (const name of names) {
    const id = await getCompanyId(name);
    if (id) {
      ids.push(id);
      const cached = companiesCache?.find(c => c.id === id);
      labels.push(cached?.name || name);
    }
  }

  if (ids.length === 0 && names.length > 0) {
    return { companyIds: null, label: null, domain: [] as unknown[], error: `No se encontraron las empresas: ${names.join(', ')}` };
  }

  const label = ids.length === 0 ? 'Todas' : labels.join(', ');
  // Si hay un solo ID usar =, si hay varios usar 'in'
  const domain: unknown[] = ids.length === 1
    ? [['company_id', '=', ids[0]]]
    : ids.length > 1
      ? [['company_id', 'in', ids]]
      : [];

  return { companyIds: ids.length > 0 ? ids : null, label, domain, error: null };
}

// ═══ HELPERS ═══
export const round2 = (n: number) => Math.round(n * 100) / 100;
