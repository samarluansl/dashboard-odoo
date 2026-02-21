import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompanies, round2 } from '@/lib/odoo';

const COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899',
                '#14b8a6', '#f97316', '#6366f1', '#a855f7', '#e11d48', '#84cc16'];

// Etapas CRM fijas por ID (crm.stage) — orden por sequence
const CRM_STAGES = [
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

const ALL_STAGE_IDS = CRM_STAGES.map(s => s.id);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const company_name = searchParams.get('company') || undefined;

    const { domain: companyDomain, error } = await resolveCompanies(company_name);
    if (error) return NextResponse.json({ error }, { status: 404 });

    const domain: unknown[] = [
      ['active', '=', true],
      ['type', '=', 'opportunity'],
      ['stage_id', 'in', ALL_STAGE_IDS],
      ...companyDomain,
    ];

    // Agrupar oportunidades activas por stage_id
    const groups = (await execute('crm.lead', 'read_group',
      [domain, ['expected_revenue'], ['stage_id']], { lazy: false }
    )) as Array<Record<string, unknown>>;

    const groupMap = new Map<number, { count: number; revenue: number }>();
    for (const g of groups) {
      const stageId = Array.isArray(g.stage_id) ? (g.stage_id as [number, string])[0] : 0;
      const count = (g.__count ?? g.stage_id_count ?? 0) as number;
      groupMap.set(stageId, {
        count,
        revenue: (g.expected_revenue as number) || 0,
      });
    }

    // Construir todas las etapas (incluso las vacías)
    const stages = CRM_STAGES.map((s, i) => {
      const data = groupMap.get(s.id);
      return {
        name: s.name,
        value: round2(data?.revenue ?? 0),
        count: data?.count ?? 0,
        color: COLORS[i % COLORS.length],
      };
    });

    return NextResponse.json({ stages });
  } catch (err) {
    console.error('API crm/pipeline error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
