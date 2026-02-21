// ═══ Tipos de alerta WhatsApp ═══
// Sincronizados con los crons del bot de WhatsApp (crons.js)

export interface AlertType {
  value: string;
  label: string;
  description: string;
  frequency: 'Diario' | 'Semanal' | 'Mensual';
  defaultTime: string; // HH:MM en Madrid
}

export const ALERT_TYPES: AlertType[] = [
  // — Diarios —
  {
    value: 'daily_summary',
    label: 'Resumen diario',
    description: 'Actividades pendientes, vencidas y para hoy + tareas',
    frequency: 'Diario',
    defaultTime: '08:00',
  },
  {
    value: 'overdue_receivables',
    label: 'Facturas vencidas',
    description: 'Facturas emitidas impagadas >15 días, agrupadas por cliente',
    frequency: 'Diario',
    defaultTime: '09:00',
  },
  {
    value: 'delinquency_alert',
    label: 'Morosidad',
    description: 'Clientes con deuda >30 días sin movimiento',
    frequency: 'Diario',
    defaultTime: '09:30',
  },
  {
    value: 'low_treasury',
    label: 'Tesorería baja',
    description: 'Aviso cuando el saldo bancario baja del umbral',
    frequency: 'Diario',
    defaultTime: '10:00',
  },
  {
    value: 'unbilled_timesheets',
    label: 'Horas sin facturar',
    description: 'Timesheets con >10h acumuladas sin facturar',
    frequency: 'Diario',
    defaultTime: '11:00',
  },
  {
    value: 'subscription_failures',
    label: 'Fallos de suscripciones',
    description: 'Pagos Stripe fallidos y cancelaciones',
    frequency: 'Diario',
    defaultTime: '12:30',
  },
  {
    value: 'attendance_check',
    label: 'Asistencia fuera de horario',
    description: 'Fichajes de entrada/salida fuera del horario programado',
    frequency: 'Diario',
    defaultTime: '15:00',
  },
  // — Semanales —
  {
    value: 'weekly_attendance',
    label: 'Resumen semanal fichajes',
    description: 'Horas trabajadas, puntualidad y retrasos por empleado',
    frequency: 'Semanal',
    defaultTime: '08:05',
  },
  {
    value: 'weekly_financial',
    label: 'Resumen financiero semanal',
    description: 'P&L + tesorería de las empresas principales',
    frequency: 'Semanal',
    defaultTime: '08:10',
  },
  // — Mensuales —
  {
    value: 'monthly_summary',
    label: 'Resumen mensual',
    description: 'P&L, tesorería, morosidad, DSO, suscripciones y previsión',
    frequency: 'Mensual',
    defaultTime: '08:15',
  },
];

// Mapa rápido valor → label
export const ALERT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ALERT_TYPES.map(a => [a.value, a.label])
);
