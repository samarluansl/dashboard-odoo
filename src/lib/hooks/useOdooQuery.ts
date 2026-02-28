'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Cache cliente compartido ─────────────────────────────────────────────────
// Módulo cliente → compartido entre todos los useOdooQuery de la misma pestaña.
// TTL por defecto: 5 minutos. Si los datos son recientes, se devuelven sin llamar a Odoo.
const DEFAULT_STALE_MS = 5 * 60 * 1000;
const clientCache = new Map<string, { data: unknown; fetchedAt: number }>();
// ─────────────────────────────────────────────────────────────────────────────

// ─── Limitador de concurrencia global (browser) ───────────────────────────────
// Máximo 4 peticiones simultáneas al servidor → Odoo nunca recibe más de 4 a la vez.
const MAX_CONCURRENT = 4;
let activeCount = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeCount < MAX_CONCURRENT) {
    activeCount++;
    return Promise.resolve();
  }
  return new Promise(resolve => {
    waitQueue.push(() => { activeCount++; resolve(); });
  });
}

function releaseSlot(): void {
  activeCount--;
  if (waitQueue.length > 0) waitQueue.shift()!();
}
// ─────────────────────────────────────────────────────────────────────────────

interface UseOdooQueryOptions {
  /** URL del API route (sin params) */
  url: string;
  /** Parámetros de búsqueda */
  params?: Record<string, string>;
  /** Desactivar la query */
  enabled?: boolean;
  /** Tiempo en ms que los datos se consideran frescos (default: 5 min) */
  staleMs?: number;
}

interface UseOdooQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useOdooQuery<T>({ url, params, enabled = true, staleMs = DEFAULT_STALE_MS }: UseOdooQueryOptions): UseOdooQueryResult<T> {
  const paramsKey = params ? JSON.stringify(params) : '';
  const cacheKey = `${url}::${paramsKey}`;

  // Inicializar desde cache si hay datos frescos
  const cached = clientCache.get(cacheKey);
  const isFresh = !!cached && (Date.now() - cached.fetchedAt) < staleMs;

  const [data, setData] = useState<T | null>(() => isFresh ? (cached!.data as T) : null);
  const [loading, setLoading] = useState(enabled && !isFresh);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (force = false) => {
    if (!enabled) return;

    // Si los datos son frescos y no es un refetch manual, no llamar a Odoo
    const entry = clientCache.get(cacheKey);
    if (!force && entry && (Date.now() - entry.fetchedAt) < staleMs) {
      setData(entry.data as T);
      setLoading(false);
      return;
    }

    // Cancelar petición anterior si existe
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    // Esperar slot de concurrencia (máx. MAX_CONCURRENT peticiones simultáneas)
    await acquireSlot();

    // Si fue abortada mientras esperaba el slot, liberar y salir
    if (controller.signal.aborted) {
      releaseSlot();
      return;
    }

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
        // Guardar en cache
        clientCache.set(cacheKey, { data: json, fetchedAt: Date.now() });
        setData(json as T);
      }
    } catch (err) {
      // Ignorar errores de abort (cambio rápido de filtros)
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Error de conexión');
      setData(null);
    } finally {
      releaseSlot();
      // Solo actualizar loading si no fue abortada
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, paramsKey, enabled, staleMs]);

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

  return { data, loading, error, refetch: () => fetchData(true) };
}
