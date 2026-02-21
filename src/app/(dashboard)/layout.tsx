'use client';

import { AppShell } from '@/components/layout/AppShell';
import { CompanyProvider } from '@/lib/context/CompanyContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState('');
  const [allowedCompanies, setAllowedCompanies] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push('/login');
        return;
      }

      // Nombre del usuario
      setUserName(session.user.user_metadata?.name || session.user.email || 'Usuario');

      // Cargar perfil para obtener allowed_companies
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('allowed_companies, name')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          if (profile.name) setUserName(profile.name);
          setAllowedCompanies(profile.allowed_companies || []);
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      }

      setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 mx-auto" />
          <p className="mt-3 text-sm text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <CompanyProvider allowedCompanies={allowedCompanies}>
      <AppShell userName={userName}>{children}</AppShell>
    </CompanyProvider>
  );
}
