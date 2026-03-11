import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { execute, listCompanies, resolveCompany, round2 } from '@/lib/odoo';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { COMPANY_LABELS } from '@/lib/companies';
import { classifyPGC, type AccountInfo, type GroupEntry } from '@/lib/classify-pgc';
import { MAX_CHAT_MESSAGE_LENGTH, MAX_CHAT_HISTORY_LENGTH } from '@/lib/validation';
import type { ChatMessage } from '@/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// FIX #22: Rate limiting — per-user sliding window
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max 10 requests per minute per user

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) || [];
  // Remove expired entries
  const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (valid.length >= RATE_LIMIT_MAX) return false;
  valid.push(now);
  rateLimitMap.set(userId, valid);
  return true;
}

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

/** Tools that query company-specific data and require access validation */
const COMPANY_SCOPED_TOOLS = new Set(['getFinancialSummary', 'getCashflow', 'getEmployeeCount', 'getCrmSummary']);

/** Helper: build a domain with optional company filter */
function withCompanyFilter(baseDomain: unknown[], companyId: number | null): unknown[] {
  return companyId ? [...baseDomain, ['company_id', '=', companyId]] : baseDomain;
}

async function executeGetFinancialSummary(args: Record<string, unknown>) {
  const { companyId, label, error } = await resolveCompany(args.company as string | undefined);
  if (error) return JSON.stringify({ error });

  const PL_ACCOUNT_TYPES = ['income', 'income_other', 'expense', 'expense_depreciation', 'expense_direct_cost'];
  const accounts = (await execute('account.account', 'search_read', [
    [['account_type', 'in', PL_ACCOUNT_TYPES]],
  ], { fields: ['id', 'code', 'name', 'account_type'] })) as AccountInfo[];

  const accountIds = accounts.map(acc => acc.id);
  const domain = withCompanyFilter([
    ['account_id', 'in', accountIds],
    ['parent_state', '=', 'posted'],
    ['date', '>=', args.date_from],
    ['date', '<=', args.date_to],
  ], companyId);

  const groups = (await execute('account.move.line', 'read_group',
    [domain, ['balance'], ['account_id']], { lazy: false }
  )) as GroupEntry[];

  const { ingExpl, gasExpl, ingFin, gasFin } = classifyPGC(groups, accounts);

  return JSON.stringify({
    empresa: label,
    ingresos_explotacion: round2(ingExpl),
    gastos_explotacion: round2(-gasExpl),
    resultado_explotacion: round2(ingExpl - gasExpl),
    resultado_financiero: round2(ingFin - gasFin),
    resultado_antes_impuestos: round2(ingExpl - gasExpl + ingFin - gasFin),
  });
}

async function executeGetCashflow(args: Record<string, unknown>) {
  const { companyId, label } = await resolveCompany(args.company as string | undefined);
  const bankAccounts = (await execute('account.account', 'search_read', [
    [['account_type', '=', 'asset_cash']],
  ], { fields: ['id'] })) as Array<{ id: number }>;
  const bankIds = bankAccounts.map(acc => acc.id);

  const treasuryDomain = withCompanyFilter(
    [['account_id', 'in', bankIds], ['parent_state', '=', 'posted']],
    companyId,
  );

  const treasuryGroups = (await execute('account.move.line', 'read_group',
    [treasuryDomain, ['balance'], ['account_id']], { lazy: false }
  )) as Array<{ balance: number }>;

  const tesoreria = treasuryGroups.reduce((sum, group) => sum + (group.balance || 0), 0);
  return JSON.stringify({ empresa: label, tesoreria: round2(tesoreria) });
}

async function executeGetEmployeeCount(args: Record<string, unknown>) {
  const { companyId, label } = await resolveCompany(args.company as string | undefined);
  const domain = withCompanyFilter([['active', '=', true]], companyId);
  const count = await execute('hr.employee', 'search_count', [domain]);
  return JSON.stringify({ empresa: label, empleados_activos: count });
}

async function executeGetCrmSummary(args: Record<string, unknown>) {
  const { companyId, label } = await resolveCompany(args.company as string | undefined);
  const domain = withCompanyFilter(
    [['active', '=', true], ['type', '=', 'opportunity']],
    companyId,
  );

  const [count, pipelineGroups] = await Promise.all([
    execute('crm.lead', 'search_count', [domain]),
    execute('crm.lead', 'read_group',
      [domain, ['expected_revenue'], []], { lazy: false }
    ) as Promise<Array<{ expected_revenue: number }>>,
  ]);

  return JSON.stringify({
    empresa: label,
    oportunidades: count,
    pipeline_value: round2(pipelineGroups[0]?.expected_revenue || 0),
  });
}

async function executeListEmpresas(allowedCompanies: string[]) {
  if (allowedCompanies.length > 0) {
    const filteredCompanies = allowedCompanies.map(alias => ({
      alias,
      nombre: COMPANY_LABELS[alias] || alias,
    }));
    return JSON.stringify({ empresas: filteredCompanies });
  }
  const companies = await listCompanies();
  return JSON.stringify({ empresas: companies.map(company => ({ id: company.id, nombre: company.name })) });
}

/** Dispatch table for tool execution — eliminates the switch statement */
const TOOL_HANDLERS: Record<string, (args: Record<string, unknown>, allowedCompanies: string[]) => Promise<string>> = {
  getFinancialSummary: (args) => executeGetFinancialSummary(args),
  getCashflow: (args) => executeGetCashflow(args),
  getEmployeeCount: (args) => executeGetEmployeeCount(args),
  getCrmSummary: (args) => executeGetCrmSummary(args),
  listEmpresas: (_args, allowed) => executeListEmpresas(allowed),
};

async function callTool(name: string, args: Record<string, unknown>, allowedCompanies: string[]): Promise<string> {
  try {
    // Validate company access for company-scoped tools
    if (COMPANY_SCOPED_TOOLS.has(name)) {
      const companyArg = args.company as string | undefined;
      const allowedLabel = allowedCompanies.map(alias => COMPANY_LABELS[alias] || alias).join(', ');

      if (allowedCompanies.length > 0 && !companyArg) {
        return JSON.stringify({ error: `Debes especificar una empresa. Solo tienes acceso a: ${allowedLabel}.` });
      }
      if (companyArg && !isCompanyAllowed(companyArg, allowedCompanies)) {
        return JSON.stringify({ error: `No tienes acceso a la empresa "${companyArg}". Solo puedes consultar: ${allowedLabel}.` });
      }
    }

    const handler = TOOL_HANDLERS[name];
    if (!handler) return JSON.stringify({ error: 'Función no reconocida' });

    return await handler(args, allowedCompanies);
  } catch (err) {
    console.error(`Chat tool "${name}" error:`, err);
    return JSON.stringify({ error: 'Error al ejecutar la consulta. Inténtalo de nuevo.' });
  }
}

export async function POST(req: NextRequest) {
  // FIX #2: Require auth for chat endpoint
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  try {
    // FIX #22: Rate limit check
    if (!checkRateLimit(auth.user.id)) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Espera un momento.' }, { status: 429 });
    }

    const body = await req.json();
    const message = typeof body.message === 'string' ? body.message : '';
    const history = Array.isArray(body.history) ? body.history : [];

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Se requiere un mensaje' }, { status: 400 });
    }

    // FIX: Limit message length to prevent cost abuse / DoS
    if (message.length > MAX_CHAT_MESSAGE_LENGTH) {
      return NextResponse.json({ error: `El mensaje no puede superar ${MAX_CHAT_MESSAGE_LENGTH} caracteres` }, { status: 400 });
    }

    // FIX: Limit history size
    if (history.length > MAX_CHAT_HISTORY_LENGTH) {
      return NextResponse.json({ error: 'Historial demasiado largo' }, { status: 400 });
    }

    // ═══ CARGAR PERFIL DEL USUARIO PARA RESTRICCIÓN DE EMPRESAS ═══
    let allowedCompanies: string[] = [];
    try {
      const sb = createServerClient();
      const { data: profile } = await sb
        .from('profiles')
        .select('allowed_companies')
        .eq('id', auth.user.id)
        .single();
      allowedCompanies = profile?.allowed_companies || [];
    } catch (err) {
      console.error('Chat: error loading profile:', err);
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

    // FIX: Validate history roles — only allow 'user' and 'assistant' to prevent system prompt injection
    const ALLOWED_HISTORY_ROLES = new Set(['user', 'assistant']);
    const sanitizedHistory = history
      .filter((historyMsg: ChatMessage) =>
        historyMsg &&
        typeof historyMsg.content === 'string' &&
        typeof historyMsg.role === 'string' &&
        ALLOWED_HISTORY_ROLES.has(historyMsg.role) &&
        historyMsg.content.length <= MAX_CHAT_MESSAGE_LENGTH
      )
      .map((historyMsg: ChatMessage) => ({
        role: historyMsg.role as 'user' | 'assistant',
        content: historyMsg.content,
      }));

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...sanitizedHistory,
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

      for (const toolCall of toolCalls) {
        if (toolCall.type !== 'function') continue;
        const toolFunction = toolCall.function;
        const toolArgs = JSON.parse(toolFunction.arguments || '{}');
        const toolResult = await callTool(toolFunction.name, toolArgs, allowedCompanies);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
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
