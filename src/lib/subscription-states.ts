/**
 * Odoo 17 subscription state labels and configuration.
 * Single source of truth — used by both API routes and UI components.
 */

/** Subscription states considered "active" in Odoo 17 */
export const ACTIVE_SUBSCRIPTION_STATES = ['3_progress', '4_paused'];

/** Subscription states considered "churned" in Odoo 17 */
export const CHURN_SUBSCRIPTION_STATES = ['5_close', '6_churn'];

/** Human-readable labels for subscription states (Spanish) */
export const SUBSCRIPTION_STATE_LABELS: Record<string, string> = {
  '1_draft': 'Borrador',
  '2_renewal': 'Renovación',
  '3_progress': 'Activa',
  '4_paused': 'Pausada',
  '5_close': 'Cerrada',
  '6_churn': 'Baja',
};

/** Badge variant per subscription state (for UI rendering) */
export const SUBSCRIPTION_STATE_VARIANTS: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  '3_progress': 'success',
  '4_paused': 'warning',
  '5_close': 'default',
  '6_churn': 'danger',
  '1_draft': 'default',
  '2_renewal': 'success',
};
