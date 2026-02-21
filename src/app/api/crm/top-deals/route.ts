import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompanies, round2 } from '@/lib/odoo';

// IDs de etapas CRM hardcoded (orden pipeline)
const CRM_STAGES: Record<number, string> = {
  15: 'Forms',
  13: 'BBDD / Potenciales clientes',
  12: 'Negociando Oportunidad',
  14: 'Contrato en preparación',
  6: 'Contrato enviado',
  2: 'Firmados + Proceso Onboarding + MKT',
  4: 'Arrancado',
  19: 'Impagos',
  11: 'Posible baja',
  17: 'Standby',
  5: 'No interesados',
  18: 'Perdidos',
  16: 'Clubes sin respuesta',
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const company_name = searchParams.get('company') || undefined;
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');

    const { domain: companyDomain, error } = await resolveCompanies(company_name);
    if (error) return NextResponse.json({ error }, { status: 404 });

    // Traer TODAS las oportunidades activas con sus datos básicos
    const domain: unknown[] = [
      ['active', '=', true],
      ['type', '=', 'opportunity'],
      ...companyDomain,
    ];

    const leads = (await execute('crm.lead', 'search_read',
      [domain],
      {
        fields: ['name', 'partner_id', 'stage_id', 'x_studio_fecha_firma_alta'],
        order: 'stage_id asc',
      }
    )) as Array<{
      id: number;
      name: string;
      partner_id: [number, string] | false;
      stage_id: [number, string] | false;
      x_studio_fecha_firma_alta: string | false;
    }>;

    // Si hay fechas, calcular ingreso facturado por partner
    let revenueByPartner: Record<number, number> = {};

    if (date_from && date_to) {
      // Obtener partner_ids únicos de las oportunidades
      const partnerIds = [...new Set(
        leads
          .map(l => (Array.isArray(l.partner_id) ? l.partner_id[0] : null))
          .filter((id): id is number => id !== null)
      )];

      if (partnerIds.length > 0) {
        // Ingresos facturados por partner en el período
        const invoiceDomain: unknown[] = [
          ['partner_id', 'in', partnerIds],
          ['move_type', '=', 'out_invoice'],
          ['state', '=', 'posted'],
          ['invoice_date', '>=', date_from],
          ['invoice_date', '<=', date_to],
          ...companyDomain,
        ];

        const invoiceGroups = (await execute('account.move', 'read_group',
          [invoiceDomain, ['amount_untaxed'], ['partner_id']],
          { lazy: false }
        )) as Array<{
          partner_id: [number, string] | false;
          amount_untaxed: number;
          __count: number;
        }>;

        for (const g of invoiceGroups) {
          if (Array.isArray(g.partner_id)) {
            revenueByPartner[g.partner_id[0]] = g.amount_untaxed || 0;
          }
        }
      }
    }

    const clubs = leads.map(l => {
      const stageId = Array.isArray(l.stage_id) ? l.stage_id[0] : 0;
      const partnerId = Array.isArray(l.partner_id) ? l.partner_id[0] : 0;

      return {
        name: l.name || 'Sin nombre',
        partner: Array.isArray(l.partner_id) ? l.partner_id[1] : 'Sin cliente',
        stage: CRM_STAGES[stageId] || (Array.isArray(l.stage_id) ? l.stage_id[1] : 'Sin etapa'),
        stage_id: stageId,
        fecha_alta: l.x_studio_fecha_firma_alta || null,
        ingreso: round2(revenueByPartner[partnerId] || 0),
      };
    });

    // Ordenar por ingreso desc por defecto
    clubs.sort((a, b) => b.ingreso - a.ingreso);

    return NextResponse.json({ clubs });
  } catch (err) {
    console.error('API crm/top-deals error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
