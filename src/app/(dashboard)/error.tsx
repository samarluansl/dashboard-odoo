'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-6">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Algo ha ido mal</h2>
      <p className="text-sm text-gray-500 mb-6 max-w-md">
        Ha ocurrido un error inesperado. Puedes intentar recargar la página o volver al dashboard.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Reintentar</Button>
        <Button
          onClick={() => window.location.href = '/'}
          className="bg-gray-100 text-gray-700 hover:bg-gray-200"
        >
          Ir al Dashboard
        </Button>
      </div>
    </div>
  );
}
