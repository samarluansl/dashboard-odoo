'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseOdooQueryOptions {
  /** URL del API route (sin params) */
  url: string;
  /** Parámetros de búsqueda */
  params?: Record<string, string>;
  /** Desactivar la query */
  enabled?: boolean;
}

interface UseOdooQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useOdooQuery<T>({ url, params, enabled = true }: UseOdooQueryOptions): UseOdooQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled); // true si habilitado para evitar flash de "Sin datos"
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const paramsKey = params ? JSON.stringify(params) : '';

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    // Cancelar petición anterior si existe
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams(params || {});
      const separator = url.includes('?') ? '&' : '?';
      const fullUrl = searchParams.toString() ? `${url}${separator}${searchParams}` : url;

      const res = await fetch(fullUrl, { signal: controller.signal });

      // Intentar parsear JSON; si falla, dar error legible
      let json;
      try {
        json = await res.json();
      } catch {
        throw new Error(`Error ${res.status}: respuesta no válida del servidor`);
      }

      if (!res.ok) {
        setError(json.error || `Error ${res.status}`);
        setData(null);
      } else {
        setData(json as T);
      }
    } catch (err) {
      // Ignorar errores de abort (cambio rápido de filtros)
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Error de conexión');
      setData(null);
    } finally {
      // Solo actualizar loading si no fue abortada
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, paramsKey, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    fetchData();

    // Cleanup: cancelar al desmontar o cambiar params
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchData, enabled]);

  return { data, loading, error, refetch: fetchData };
}
