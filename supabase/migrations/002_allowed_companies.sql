-- ═══════════════════════════════════════════════
-- Migración 002: allowed_companies para restricción de acceso
-- ═══════════════════════════════════════════════

-- Array de company aliases que el usuario puede ver.
-- Vacío = acceso a todas las empresas (para admins).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS allowed_companies TEXT[] NOT NULL DEFAULT '{}';

-- Policy para que admins puedan ver y editar todos los perfiles
-- (la policy existente "profiles_update" solo permite editar el propio)
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Policy para insertar perfiles (solo admins)
CREATE POLICY "profiles_admin_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Policy para eliminar perfiles (solo admins)
CREATE POLICY "profiles_admin_delete" ON public.profiles
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
