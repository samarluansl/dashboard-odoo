'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Cache cliente compartido ─────────────────────────────────────────────────
// Módulo cliente → compartido entre todos los useOdooQuery de la misma pestaña.
// TTL por defecto: 5 minutos. Si los datos son recientes, se devuelven sin llamar a Odoo.
const DEFAULT_STALE_MS = 5 * 60 * 1000;
const MAX_CLIENT_CACHE = 200;
const clientCache = new Map<string, { data: unknown; fetchedAt: number }>();

// ─── In-flight dedup: si múltiples hooks piden la misma URL, reutilizar la promise ──
const inflightRequests = new Map<string, Promise<unknown>>();
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

      // PERF: In-flight dedup — if another hook is fetching the same URL, reuse its promise
      let json: unknown;
      const existing = inflightRequests.get(fullUrl);
      if (existing && !force) {
        json = await existing;
      } else {
        const fetchPromise = (async () => {
          const response = await fetch(fullUrl, { signal: controller.signal });
          let responseBody;
          try {
            responseBody = await response.json();
          } catch {
            throw new Error(`Error ${response.status}: respuesta no válida del servidor`);
          }
          if (!response.ok) {
            throw Object.assign(new Error(responseBody.error || `Error ${response.status}`), { isApiError: true });
          }
          return responseBody;
        })();

        inflightRequests.set(fullUrl, fetchPromise);
        try {
          json = await fetchPromise;
        } finally {
          inflightRequests.delete(fullUrl);
        }
      }

      // Guardar en cache (evict oldest if too large)
      if (clientCache.size >= MAX_CLIENT_CACHE) {
        const firstKey = clientCache.keys().next().value;
        if (firstKey !== undefined) clientCache.delete(firstKey);
      }
      clientCache.set(cacheKey, { data: json, fetchedAt: Date.now() });
      setData(json as T);
    } catch (err) {
      // Ignorar errores de abort (cambio rápido de filtros)
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // API errors from our own response
      if (err instanceof Error && (err as Error & { isApiError?: boolean }).isApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Error de conexión');
      }
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
