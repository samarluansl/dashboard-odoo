-- ═══ Tabla de preferencias de notificaciones WhatsApp ═══
-- Cada usuario tiene un registro por tipo de alerta.
-- Si no tiene registro, se asume desactivado.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, alert_type)
);

-- Índice para consultas rápidas por usuario
CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON public.notification_preferences(user_id);

-- Índice para que el bot consulte rápidamente quién recibe cada alerta
CREATE INDEX IF NOT EXISTS idx_notif_prefs_type_enabled ON public.notification_preferences(alert_type, enabled);

-- RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver sus propias preferencias
CREATE POLICY "Users can read own preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

-- Los usuarios pueden actualizar sus propias preferencias
CREATE POLICY "Users can update own preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Los usuarios pueden insertar sus propias preferencias
CREATE POLICY "Users can insert own preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role puede hacer todo (para el bot y API admin)
CREATE POLICY "Service role full access"
  ON public.notification_preferences FOR ALL
  USING (true)
  WITH CHECK (true);
