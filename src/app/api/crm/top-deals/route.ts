import { NextRequest, NextResponse } from 'next/server';
import { execute, resolveCompanies, round2 } from '@/lib/odoo';
import { requireAuth } from '@/lib/auth';
import { CRM_STAGE_NAMES } from '@/lib/crm-stages';

// FIX #15: Limit for top deals
const TOP_DEALS_LIMIT = 500;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = req.nextUrl;
    const company_name = searchParams.get('company') || undefined;
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');

    const { domain: companyDomain, error } = await resolveCompanies(company_name);
    if (error) return NextResponse.json({ error }, { status: 404 });

    // Traer oportunidades activas con límite (#15)
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
        limit: TOP_DEALS_LIMIT,
      }
    )) as Array<{
      id: number;
      name: string;
      partner_id: [number, string] | false;
      stage_id: [number, string] | false;
      x_studio_fecha_firma_alta: string | false;
    }>;

    // Si hay fechas, calcular ingreso facturado por partner
    const revenueByPartner: Record<number, number> = {};

    if (date_from && date_to) {
      // Obtener partner_ids únicos de las oportunidades
      const partnerIds = [...new Set(
        leads
          .map(lead => (Array.isArray(lead.partner_id) ? lead.partner_id[0] : null))
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

        for (const invoiceGroup of invoiceGroups) {
          if (Array.isArray(invoiceGroup.partner_id)) {
            revenueByPartner[invoiceGroup.partner_id[0]] = invoiceGroup.amount_untaxed || 0;
          }
        }
      }
    }

    const clubs = leads.map(lead => {
      const stageId = Array.isArray(lead.stage_id) ? lead.stage_id[0] : 0;
      const partnerId = Array.isArray(lead.partner_id) ? lead.partner_id[0] : 0;

      return {
        name: lead.name || 'Sin nombre',
        partner: Array.isArray(lead.partner_id) ? lead.partner_id[1] : 'Sin cliente',
        stage: CRM_STAGE_NAMES[stageId] || (Array.isArray(lead.stage_id) ? lead.stage_id[1] : 'Sin etapa'),
        stage_id: stageId,
        fecha_alta: lead.x_studio_fecha_firma_alta || null,
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
