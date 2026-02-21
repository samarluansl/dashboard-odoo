-- ═══════════════════════════════════════════════
-- GrupoDashboard — Schema inicial
-- ═══════════════════════════════════════════════

-- Tabla de perfiles de usuario (se vincula con auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'manager', 'viewer')),
  default_company TEXT,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Función para crear perfil automáticamente al registrar usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear perfil al registrar
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Tabla de alertas
CREATE TABLE IF NOT EXISTS public.alerts (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL, -- 'overdue_invoice', 'low_treasury', 'churn', etc.
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  body TEXT,
  company TEXT,
  data JSONB,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de snapshots diarios (para cachear datos y comparar tendencias)
CREATE TABLE IF NOT EXISTS public.daily_snapshots (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  company TEXT,
  metric TEXT NOT NULL, -- 'treasury', 'revenue', 'employees', 'mrr', etc.
  value NUMERIC NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(date, company, metric)
);

-- Tabla de sesiones de chat
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══ INDICES ═══
CREATE INDEX IF NOT EXISTS idx_alerts_created ON public.alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON public.alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_read ON public.alerts(read);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON public.daily_snapshots(date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_metric ON public.daily_snapshots(metric);
CREATE INDEX IF NOT EXISTS idx_chat_user ON public.chat_sessions(user_id);

-- ═══ RLS (Row Level Security) ═══
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- Policies: Todos los usuarios autenticados pueden ver todo (sin restricciones de rol)
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "alerts_select" ON public.alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "alerts_update" ON public.alerts FOR UPDATE TO authenticated USING (true);

CREATE POLICY "snapshots_select" ON public.daily_snapshots FOR SELECT TO authenticated USING (true);

CREATE POLICY "chat_select" ON public.chat_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "chat_insert" ON public.chat_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "chat_update" ON public.chat_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid());
