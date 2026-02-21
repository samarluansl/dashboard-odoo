-- ═══ Añadir campos de horario a notification_preferences ═══
-- Permite a cada usuario personalizar frecuencia, día y hora de cada alerta.

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS frequency TEXT DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS preferred_day INTEGER,
  ADD COLUMN IF NOT EXISTS preferred_time TEXT;

-- Índice para el dispatcher del bot (busca por enabled + preferred_time)
CREATE INDEX IF NOT EXISTS idx_notif_prefs_schedule
  ON public.notification_preferences(enabled, preferred_time);

-- Backfill: dar hora por defecto a registros existentes
UPDATE notification_preferences SET preferred_time = '08:00' WHERE alert_type = 'daily_summary' AND preferred_time IS NULL;
UPDATE notification_preferences SET preferred_time = '09:00' WHERE alert_type = 'overdue_receivables' AND preferred_time IS NULL;
UPDATE notification_preferences SET preferred_time = '09:30' WHERE alert_type = 'delinquency_alert' AND preferred_time IS NULL;
UPDATE notification_preferences SET preferred_time = '10:00' WHERE alert_type = 'low_treasury' AND preferred_time IS NULL;
UPDATE notification_preferences SET preferred_time = '11:00' WHERE alert_type = 'unbilled_timesheets' AND preferred_time IS NULL;
UPDATE notification_preferences SET preferred_time = '12:30' WHERE alert_type = 'subscription_failures' AND preferred_time IS NULL;
UPDATE notification_preferences SET preferred_time = '15:00' WHERE alert_type = 'attendance_check' AND preferred_time IS NULL;
UPDATE notification_preferences SET preferred_time = '08:05' WHERE alert_type = 'weekly_attendance' AND preferred_time IS NULL;
UPDATE notification_preferences SET preferred_time = '08:10' WHERE alert_type = 'weekly_financial' AND preferred_time IS NULL;
UPDATE notification_preferences SET preferred_time = '08:15' WHERE alert_type = 'monthly_summary' AND preferred_time IS NULL;
