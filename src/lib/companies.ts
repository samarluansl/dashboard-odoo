/**
 * Lista centralizada de empresas del Grupo Samarluan.
 * Sincronizada con el bot de WhatsApp (odoo.js COMPANY_ALIASES).
 * Orden: alfabético por label.
 *
 * value = alias que usa resolveCompany() en el backend.
 * label = nombre completo legal (con forma jurídica).
 * shortLabel = nombre corto para UIs compactas (tarjetas, badges…).
 */

export interface Company {
  value: string;
  label: string;
  shortLabel: string;
}

export const COMPANIES: Company[] = [
  { value: '365',            label: '365 Receptión, S.L.',            shortLabel: '365 Receptión' },
  { value: 'Alexan',         label: 'Alexan Events, S.L.',            shortLabel: 'Alexan Events' },
  { value: 'Arsgode',        label: 'Arsgode, S.L.',                  shortLabel: 'Arsgode' },
  { value: 'AssistantBot',   label: 'AssistantBot S.L.',              shortLabel: 'AssistantBot' },
  { value: 'Danomaclean',    label: 'Danomaclean SL',                 shortLabel: 'Danomaclean' },
  { value: 'Davila Property',label: 'Davila Property Management S.L.',shortLabel: 'Davila Property' },
  { value: 'Dayful',         label: 'Dayful Studio S.L.',             shortLabel: 'Dayful Studio' },
  { value: 'DSU',            label: 'Domotic Systems Unit S.L.',      shortLabel: 'Domotic Systems' },
  { value: 'Gasmedia',       label: 'Gasmedia Systems, S.L.',         shortLabel: 'Gasmedia Systems' },
  { value: 'Lucky Losers',   label: 'Lucky Losers Clothes, S.L.',     shortLabel: 'Lucky Losers' },
  { value: 'Matches Padel',  label: 'Matches Padel Solutions S.L.',   shortLabel: 'Matches Padel' },
  { value: 'Menthor',        label: 'Menthor Padel Academy SL',       shortLabel: 'Menthor Padel' },
  { value: 'Padelbaycamp',   label: 'Padelbaycamp, S.L.',             shortLabel: 'Padelbaycamp' },
  { value: 'Padelmatches',   label: 'Padelmatches S.L.',              shortLabel: 'Padelmatches' },
  { value: 'Padelmunity',    label: 'Padelmunity, S.L.',              shortLabel: 'Padelmunity' },
  { value: 'Padelplay',      label: 'Padelplay 2022 S.L.',            shortLabel: 'Padelplay 2022' },
  { value: 'Padelprix',      label: 'Padelprix Worldwide, S.L.',      shortLabel: 'Padelprix' },
  { value: 'Padel YVR',      label: 'Padel YVR S.L.',                 shortLabel: 'Padel YVR' },
  { value: 'R2PRO',          label: 'R2PRO Nextgen, S.L.',            shortLabel: 'R2PRO Nextgen' },
  { value: 'Samarluan',      label: 'Samarluan S.L.',                 shortLabel: 'Samarluan' },
  { value: 'SMD',            label: 'SMD Consultores, S.L.',          shortLabel: 'SMD Consultores' },
  { value: 'Viper',          label: 'Viper Web Tech, S.L.',           shortLabel: 'Viper Web Tech' },
];

/**
 * Mapa rápido: alias → nombre completo legal.
 * Usado por el chat para restricción de empresas.
 */
export const COMPANY_LABELS: Record<string, string> = Object.fromEntries(
  COMPANIES.map(c => [c.value, c.label])
);

/**
 * Busca una empresa por alias.
 */
export function getCompanyByAlias(alias: string): Company | undefined {
  return COMPANIES.find(c => c.value === alias);
}
