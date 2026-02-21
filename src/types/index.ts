// ═══ TIPOS COMPARTIDOS ═══

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';
  phone?: string;
  odoo_user_id?: number;
}

export interface Company {
  id: number;
  name: string;
}

export interface KPIData {
  label: string;
  value: number;
  previousValue?: number;
  format: 'currency' | 'integer' | 'percent' | 'days';
  trend?: 'up' | 'down' | 'neutral';
  trendPositive?: 'up' | 'down'; // Is "up" good or bad?
}

export interface FinancialSummary {
  empresa: string;
  periodo: string;
  explotacion: {
    ingresos: number;
    gastos: number;
    resultado: number;
  };
  financiero: {
    ingresos: number;
    gastos: number;
    resultado: number;
  };
  resultado_antes_impuestos: number;
}

export interface CashFlowData {
  empresa: string;
  tesoreria: number;
  cobros_pendientes: number;
  cobros_count: number;
  pagos_pendientes: number;
  pagos_count: number;
  posicion_neta: number;
}

export interface SubscriptionData {
  empresa: string;
  mrr: number;
  activas: number;
  nuevas: number;
  nuevas_revenue: number;
  bajas: number;
  bajas_revenue: number;
  churn_rate: number;
}

export interface DSOData {
  empresa: string;
  dso: number;
  ventas_periodo: number;
  cuentas_cobrar: number;
}

export interface Alert {
  id: number;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body?: string;
  company?: string;
  data?: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export interface ChartDataPoint {
  fecha: string;
  valor: number;
  label?: string;
}

export interface DashboardPreferences {
  default_company: string | null;
  dashboard_widgets: string[];
  theme: 'light' | 'dark';
  notifications_enabled: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
