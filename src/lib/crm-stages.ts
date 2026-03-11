/**
 * Etapas CRM centralizadas — unica fuente de verdad.
 * IDs fijos de crm.stage en Odoo, ordenados por sequence.
 */

export interface CrmStage {
  id: number;
  name: string;
  seq: number;
}

export const CRM_STAGES: CrmStage[] = [
  { id: 15, name: 'Forms',                                   seq: 0  },
  { id: 13, name: 'BBDD / Potenciales clientes',             seq: 1  },
  { id: 12, name: 'Negociando Oportunidad',                  seq: 2  },
  { id: 14, name: 'Contrato en preparación',                 seq: 3  },
  { id: 6,  name: 'Contrato enviado',                        seq: 4  },
  { id: 2,  name: 'Firmados + Proceso Onboarding + MKT',     seq: 5  },
  { id: 4,  name: 'Arrancado',                               seq: 6  },
  { id: 19, name: 'Impagos',                                 seq: 7  },
  { id: 11, name: 'Posible baja',                            seq: 8  },
  { id: 17, name: 'Standby',                                 seq: 9  },
  { id: 5,  name: 'No interesados',                          seq: 10 },
  { id: 18, name: 'Perdidos',                                seq: 11 },
  { id: 16, name: 'Clubes sin respuesta',                    seq: 12 },
];

export const ALL_STAGE_IDS = CRM_STAGES.map(stage => stage.id);

/** Map id -> name for quick lookup */
export const CRM_STAGE_NAMES: Record<number, string> = Object.fromEntries(
  CRM_STAGES.map(stage => [stage.id, stage.name])
);

/** Ordered stage names for UI filters */
export const CRM_STAGE_ORDER = CRM_STAGES.map(stage => stage.name);
