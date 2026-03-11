/**
 * Company resolution for Odoo.
 * Caches company list with 1-hour TTL.
 */

import { execute } from './odoo';

interface CompanyCache {
  id: number;
  name: string;
}

let companiesCache: CompanyCache[] | null = null;
let companiesCacheExpiry: number = 0;
const COMPANIES_TTL = 3600_000; // 1 hour

/** Fetch all companies from Odoo. Results are cached for 1 hour. */
export async function listCompanies(): Promise<CompanyCache[]> {
  if (companiesCache && companiesCacheExpiry > Date.now()) return companiesCache;
  const companies = (await execute('res.company', 'search_read', [[]], {
    fields: ['id', 'name'],
    order: 'id asc',
  })) as CompanyCache[];
  companiesCache = companies;
  companiesCacheExpiry = Date.now() + COMPANIES_TTL;
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

/** Resolve a company name/alias to its Odoo ID. Returns null if not found. */
export async function getCompanyId(name?: string): Promise<number | null> {
  if (!name) return null;
  const companies = await listCompanies();
  const lower = name.toLowerCase().trim();

  // Buscar alias
  const alias = companyAliases[lower];
  const searchTerm = alias || lower;

  const match = companies.find(company => company.name.toLowerCase().includes(searchTerm));
  return match?.id ?? null;
}

/** Resolve a single company name to { companyId, label, error }. */
export async function resolveCompany(company_name?: string) {
  const companyId = await getCompanyId(company_name);
  if (company_name && !companyId) {
    return { companyId: null, label: null as string | null, error: `No se encontró la empresa "${company_name}".` };
  }
  const companies = await listCompanies();
  const label = companyId
    ? (companies.find(company => company.id === companyId)?.name || company_name || 'Todas')
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

  // Fetch once before the loop instead of per-iteration
  const companies = await listCompanies();

  // PERF: Resolve all names against the already-fetched list without repeated awaits
  for (const name of names) {
    const lower = name.toLowerCase().trim();
    const alias = companyAliases[lower];
    const searchTerm = alias || lower;
    const match = companies.find(company => company.name.toLowerCase().includes(searchTerm));
    if (match) {
      ids.push(match.id);
      labels.push(match.name);
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
