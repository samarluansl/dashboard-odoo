import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { execute, listCompanies, resolveCompany, round2 } from '@/lib/odoo';
import { createServerClient } from '@/lib/supabase';
import { COMPANY_LABELS } from '@/lib/companies';
import type { ChatMessage } from '@/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ═══ TOOLS PARA OPENAI ═══
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'getFinancialSummary',
      description: 'Obtiene P&L (ingresos, gastos, resultado) de una empresa para un período',
      parameters: {
        type: 'object',
        properties: {
          company: { type: 'string', description: 'Nombre de la empresa (ej: "SMD", "Samarluan")' },
          date_from: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
          date_to: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
        },
        required: ['date_from', 'date_to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getCashflow',
      description: 'Obtiene tesorería, cobros pendientes, pagos pendientes y posición neta',
      parameters: {
        type: 'object',
        properties: {
          company: { type: 'string', description: 'Nombre de la empresa' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getEmployeeCount',
      description: 'Cuenta empleados activos de una empresa',
      parameters: {
        type: 'object',
        properties: {
          company: { type: 'string', description: 'Nombre de la empresa' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getCrmSummary',
      description: 'Obtiene resumen CRM: oportunidades activas, valor pipeline, ganadas',
      parameters: {
        type: 'object',
        properties: {
          company: { type: 'string', description: 'Nombre de la empresa' },
          date_from: { type: 'string', description: 'Fecha inicio' },
          date_to: { type: 'string', description: 'Fecha fin' },
        },
        required: ['date_from', 'date_to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listEmpresas',
      description: 'Lista todas las empresas del grupo con sus IDs',
      parameters: { type: 'object', properties: {} },
    },
  },
];

// ═══ VERIFICACIÓN DE ACCESO A EMPRESA ═══
function isCompanyAllowed(companyName: string | undefined, allowedCompanies: string[]): boolean {
  if (allowedCompanies.length === 0) return true;
  if (!companyName) return false;

  const name = companyName.toLowerCase().trim();
  return allowedCompanies.some(alias => {
    const aliasLower = alias.toLowerCase();
    const labelLower = (COMPANY_LABELS[alias] || '').toLowerCase();
    return name === aliasLower || name.includes(aliasLower) || aliasLower.includes(name) || labelLower.includes(name);
  });
}

// ═══ IMPLEMENTACIÓN DE TOOLS ═══
async function callTool(name: string, args: Record<string, unknown>, allowedCompanies: string[]): Promise<string> {
  try {
    // Verificar acceso para herramientas que consultan datos de empresa
    if (['getFinancialSummary', 'getCashflow', 'getEmployeeCount', 'getCrmSummary'].includes(name)) {
      const companyArg = args.company as string | undefined;

      // Si el usuario tiene restricción y no especifica empresa, forzar error
      if (allowedCompanies.length > 0 && !companyArg) {
        return JSON.stringify({
          error: `Debes especificar una empresa. Solo tienes acceso a: ${allowedCompanies.map(a => COMPANY_LABELS[a] || a).join(', ')}.`,
        });
      }

      // Si el usuario tiene restricción y la empresa no está permitida
      if (companyArg && !isCompanyAllowed(companyArg, allowedCompanies)) {
        return JSON.stringify({
          error: `No tienes acceso a la empresa "${companyArg}". Solo puedes consultar: ${allowedCompanies.map(a => COMPANY_LABELS[a] || a).join(', ')}.`,
        });
      }
    }

    switch (name) {
      case 'getFinancialSummary': {
        const { companyId, label, error } = await resolveCompany(args.company as string | undefined);
        if (error) return JSON.stringify({ error });

        const plTypes = ['income', 'income_other', 'expense', 'expense_depreciation', 'expense_direct_cost'];
        const accounts = (await execute('account.account', 'search_read', [
          [['account_type', 'in', plTypes]],
        ], { fields: ['id', 'code', 'name', 'account_type'] })) as Array<{ id: number; code: string; account_type: string }>;

        const accountIds = accounts.map(a => a.id);
        const domain: unknown[] = [
          ['account_id', 'in', accountIds],
          ['parent_state', '=', 'posted'],
          ['date', '>=', args.date_from],
          ['date', '<=', args.date_to],
        ];
        if (companyId) domain.push(['company_id', '=', companyId]);

        const groups = (await execute('account.move.line', 'read_group',
          [domain, ['balance'], ['account_id']], { lazy: false }
        )) as Array<{ account_id: [number, string]; balance: number }>;

        let ingExpl = 0, gasExpl = 0, ingFin = 0, gasFin = 0;
        for (const g of groups) {
          const acc = accounts.find(a => a.id === g.account_id?.[0]);
          if (!acc) continue;
          const c1 = acc.code.charAt(0);
          const c2 = acc.code.substring(0, 2);
          const bal = g.balance || 0;

          if (c1 === '7') {
            if (['76', '77'].includes(c2)) { bal < 0 ? ingFin += Math.abs(bal) : gasFin += bal; }
            else { bal < 0 ? ingExpl += Math.abs(bal) : gasExpl += bal; }
          } else if (c1 === '6') {
            if (['66', '67'].includes(c2)) { bal > 0 ? gasFin += bal : ingFin += Math.abs(bal); }
            else { bal > 0 ? gasExpl += bal : ingExpl += Math.abs(bal); }
          }
        }

        return JSON.stringify({
          empresa: label,
          ingresos_explotacion: round2(ingExpl),
          gastos_explotacion: round2(-gasExpl),
          resultado_explotacion: round2(ingExpl - gasExpl),
          resultado_financiero: round2(ingFin - gasFin),
          resultado_antes_impuestos: round2(ingExpl - gasExpl + ingFin - gasFin),
        });
      }

      case 'getCashflow': {
        const { companyId, label } = await resolveCompany(args.company as string | undefined);
        const bankAccounts = (await execute('account.account', 'search_read', [
          [['account_type', '=', 'asset_cash']],
        ], { fields: ['id'] })) as Array<{ id: number }>;
        const bankIds = bankAccounts.map(a => a.id);

        const tDomain: unknown[] = [['account_id', 'in', bankIds], ['parent_state', '=', 'posted']];
        if (companyId) tDomain.push(['company_id', '=', companyId]);

        const tGroups = (await execute('account.move.line', 'read_group',
          [tDomain, ['balance'], ['account_id']], { lazy: false }
        )) as Array<{ balance: number }>;

        const tesoreria = tGroups.reduce((s, g) => s + (g.balance || 0), 0);

        return JSON.stringify({ empresa: label, tesoreria: round2(tesoreria) });
      }

      case 'getEmployeeCount': {
        const { companyId, label } = await resolveCompany(args.company as string | undefined);
        const domain: unknown[] = [['active', '=', true]];
        if (companyId) domain.push(['company_id', '=', companyId]);
        const count = await execute('hr.employee', 'search_count', [domain]);
        return JSON.stringify({ empresa: label, empleados_activos: count });
      }

      case 'getCrmSummary': {
        const { companyId, label } = await resolveCompany(args.company as string | undefined);
        const domain: unknown[] = [['active', '=', true], ['type', '=', 'opportunity']];
        if (companyId) domain.push(['company_id', '=', companyId]);

        const count = await execute('crm.lead', 'search_count', [domain]);
        const pipelineGroups = (await execute('crm.lead', 'read_group',
          [domain, ['expected_revenue'], []], { lazy: false }
        )) as Array<{ expected_revenue: number }>;

        return JSON.stringify({
          empresa: label,
          oportunidades: count,
          pipeline_value: round2(pipelineGroups[0]?.expected_revenue || 0),
        });
      }

      case 'listEmpresas': {
        // Si el usuario tiene restricción, solo listar sus empresas
        if (allowedCompanies.length > 0) {
          const filteredCompanies = allowedCompanies.map(alias => ({
            alias,
            nombre: COMPANY_LABELS[alias] || alias,
          }));
          return JSON.stringify({ empresas: filteredCompanies });
        }
        const companies = await listCompanies();
        return JSON.stringify({ empresas: companies.map(c => ({ id: c.id, nombre: c.name })) });
      }

      default:
        return JSON.stringify({ error: 'Función no reconocida' });
    }
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Se requiere un mensaje' }, { status: 400 });
    }

    // ═══ CARGAR PERFIL DEL USUARIO PARA RESTRICCIÓN DE EMPRESAS ═══
    let allowedCompanies: string[] = [];
    const authHeader = req.headers.get('authorization');

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const sb = createServerClient();
        const { data: { user } } = await sb.auth.getUser(token);
        if (user) {
          const { data: profile } = await sb
            .from('profiles')
            .select('allowed_companies')
            .eq('id', user.id)
            .single();
          allowedCompanies = profile?.allowed_companies || [];
        }
      } catch (err) {
        console.error('Chat: error loading profile:', err);
      }
    }

    const today = new Date().toISOString().split('T')[0];

    // System prompt base
    let systemPrompt = `Eres un asistente financiero del Grupo Samarluan. Hoy es ${today}.
Tienes acceso a datos reales de Odoo mediante herramientas.
Responde en español, de forma clara y concisa.
Usa las herramientas para obtener datos antes de responder.
Si no tienes datos, dilo claramente. NUNCA inventes cifras.
Formato de moneda: español (1.234,56€).`;

    // Si el usuario tiene restricción de empresas, añadir al prompt
    if (allowedCompanies.length > 0) {
      const empresasStr = allowedCompanies.map(a => COMPANY_LABELS[a] || a).join(', ');
      systemPrompt += `\n\nIMPORTANTE: El usuario actual SOLO tiene acceso a las siguientes empresas: ${empresasStr}.
NO debes proporcionar información sobre ninguna otra empresa del grupo.
Si te preguntan por una empresa a la que no tiene acceso, responde amablemente que no tienes permiso para consultar esa empresa.
Cuando consultes datos sin especificar empresa, usa SOLO las empresas permitidas del usuario.`;
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...(history || []).map((m: ChatMessage) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    // Llamada con tools
    let response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 1500,
    });

    // Manejar tool calls (hasta 3 rondas)
    let rounds = 0;
    while (response.choices[0]?.message?.tool_calls && rounds < 3) {
      const toolCalls = response.choices[0].message.tool_calls;
      messages.push(response.choices[0].message);

      for (const tc of toolCalls) {
        if (tc.type !== 'function') continue;
        const fn = tc.function;
        const args = JSON.parse(fn.arguments || '{}');
        const result = await callTool(fn.name, args, allowedCompanies);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result,
        });
      }

      response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 1500,
      });

      rounds++;
    }

    const reply = response.choices[0]?.message?.content || 'No pude generar una respuesta.';

    return NextResponse.json({ reply });
  } catch (err) {
    console.error('API chat error:', err);
    return NextResponse.json({ error: 'Error interno del chat' }, { status: 500 });
  }
}
