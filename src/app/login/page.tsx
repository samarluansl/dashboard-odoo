'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Eye, EyeOff } from 'lucide-react';

const SAVED_CREDENTIALS_KEY = 'dashboard_saved_credentials';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  // Cargar credenciales guardadas al montar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_CREDENTIALS_KEY);
      if (saved) {
        const { email: savedEmail, password: savedPassword } = JSON.parse(atob(saved));
        if (savedEmail) setEmail(savedEmail);
        if (savedPassword) setPassword(savedPassword);
        setRememberMe(true);
      }
    } catch {
      // Si hay datos corruptos, limpiar
      localStorage.removeItem(SAVED_CREDENTIALS_KEY);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Guardar o borrar credenciales según checkbox
      if (rememberMe) {
        const data = btoa(JSON.stringify({ email, password }));
        localStorage.setItem(SAVED_CREDENTIALS_KEY, data);
      } else {
        localStorage.removeItem(SAVED_CREDENTIALS_KEY);
      }

      setStatus('Conectando con Supabase...');

      // Timeout de 15 segundos
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: Supabase no responde (15s)')), 15000)
      );

      const loginPromise = supabase.auth.signInWithPassword({ email, password });
      const { error: authError } = await Promise.race([loginPromise, timeout]);

      if (authError) {
        const msg = authError.message?.toLowerCase() || '';
        if (msg.includes('invalid login') || msg.includes('invalid_credentials')) {
          setError('Email o contraseña incorrectos.');
        } else if (msg.includes('email not confirmed')) {
          setError('Tu email no ha sido confirmado.');
        } else if (msg.includes('too many requests') || msg.includes('rate limit')) {
          setError('Demasiados intentos. Espera unos minutos.');
        } else {
          setError(`Error: ${authError.message}`);
        }
        setLoading(false);
        setStatus('');
        return;
      }

      setStatus('Login OK, redirigiendo...');
      // Login OK — redirigir al dashboard
      window.location.href = '/';
    } catch (err) {
      setError(`Error de conexión: ${err instanceof Error ? err.message : 'Inténtalo de nuevo'}`);
      setLoading(false);
      setStatus('');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <img src="/logo-samarluan.svg" alt="Samarluan" className="h-12 w-12 mx-auto mb-3 object-contain" />
          <h1 className="text-2xl font-bold text-gray-900">Grupo Samarluan</h1>
          <p className="mt-2 text-sm text-gray-500">Panel de control empresarial</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Recordar sesión */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Recordar mis datos</span>
            </label>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Spinner className="h-4 w-4" /> : 'Iniciar sesión'}
            </Button>

            {status && (
              <p className="text-xs text-blue-600 text-center">{status}</p>
            )}
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          Grupo Samarluan &middot; 25 empresas &middot; Odoo v17
        </p>
      </div>
    </div>
  );
}
