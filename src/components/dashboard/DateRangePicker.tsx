'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const PERIODS = [
  { value: 'this_month', label: 'Este mes' },
  { value: 'last_month', label: 'Mes pasado' },
  { value: 'this_quarter', label: 'Este trimestre' },
  { value: 'this_year', label: 'Este año' },
  { value: 'last_year', label: 'Año pasado' },
];

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DAY_NAMES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

interface DateRangePickerProps {
  value: string;
  onChange: (period: string) => void;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtShort(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [selStart, setSelStart] = useState<string | null>(null);
  const [selEnd, setSelEnd] = useState<string | null>(null);
  const [hovering, setHovering] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cerrar con Escape
  useEffect(() => {
    if (!open && !calendarOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setCalendarOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, calendarOpen]);

  const isCustom = value.startsWith('custom:');
  const displayLabel = isCustom
    ? (() => {
        const [, range] = value.split('custom:');
        const [f, t] = range.split('_');
        return `${fmtShort(f)} — ${fmtShort(t)}`;
      })()
    : PERIODS.find(p => p.value === value)?.label || value;

  const handlePeriodSelect = useCallback((period: string) => {
    onChange(period);
    setOpen(false);
    setCalendarOpen(false);
  }, [onChange]);

  const handleDayClick = useCallback((dateStr: string) => {
    if (!selStart || (selStart && selEnd)) {
      // Empezar nueva selección
      setSelStart(dateStr);
      setSelEnd(null);
      setHovering(null);
    } else {
      // Completar selección
      const start = dateStr < selStart ? dateStr : selStart;
      const end = dateStr < selStart ? selStart : dateStr;
      setSelStart(start);
      setSelEnd(end);
      onChange(`custom:${start}_${end}`);
      setOpen(false);
      setCalendarOpen(false);
    }
  }, [selStart, selEnd, onChange]);

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfWeek(calYear, calMonth);

  const isInRange = (dateStr: string) => {
    if (selStart && selEnd) {
      return dateStr >= selStart && dateStr <= selEnd;
    }
    if (selStart && hovering) {
      const lo = hovering < selStart ? hovering : selStart;
      const hi = hovering < selStart ? selStart : hovering;
      return dateStr >= lo && dateStr <= hi;
    }
    return false;
  };

  const isStart = (dateStr: string) => dateStr === selStart;
  const isEnd = (dateStr: string) => dateStr === selEnd || (!selEnd && dateStr === hovering);

  return (
    <div className="relative" ref={ref}>
      {/* Botón principal */}
      <button
        onClick={() => { setOpen(!open); if (calendarOpen) setCalendarOpen(false); }}
        className={cn(
          'flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition-colors hover:bg-gray-50',
          open || calendarOpen ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-300'
        )}
      >
        <Calendar className="h-4 w-4 text-gray-400" />
        <span className="text-gray-700 whitespace-nowrap">{displayLabel}</span>
        {isCustom && (
          <button
            onClick={e => { e.stopPropagation(); onChange('this_month'); }}
            className="ml-1 rounded-full p-0.5 hover:bg-gray-200"
            aria-label="Limpiar rango personalizado"
          >
            <X className="h-3 w-3 text-gray-400" />
          </button>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[320px] rounded-xl border border-gray-200 bg-white shadow-lg">
          {/* Periodos rápidos */}
          <div className="border-b border-gray-100 p-2">
            <p className="px-2 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wider">Período</p>
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => handlePeriodSelect(p.value)}
                className={cn(
                  'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  value === p.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Botón calendario personalizado */}
          <div className="p-2">
            <button
              onClick={() => setCalendarOpen(!calendarOpen)}
              className={cn(
                'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                calendarOpen || isCustom ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              <Calendar className="h-4 w-4" />
              Rango personalizado
            </button>
          </div>

          {/* Calendario */}
          {calendarOpen && (
            <div className="border-t border-gray-100 p-3">
              {/* Indicador de selección */}
              <div className="mb-2 text-xs text-gray-500 text-center">
                {selStart && !selEnd
                  ? `Desde ${fmtShort(selStart)} — selecciona fin`
                  : selStart && selEnd
                  ? `${fmtShort(selStart)} — ${fmtShort(selEnd)}`
                  : 'Selecciona fecha de inicio'}
              </div>

              {/* Cabecera mes */}
              <div className="flex items-center justify-between mb-2">
                <button onClick={prevMonth} className="rounded-lg p-1.5 hover:bg-gray-100" aria-label="Mes anterior">
                  <ChevronLeft className="h-4 w-4 text-gray-500" />
                </button>
                <span className="text-sm font-semibold text-gray-900">
                  {MONTH_NAMES[calMonth]} {calYear}
                </span>
                <button onClick={nextMonth} className="rounded-lg p-1.5 hover:bg-gray-100" aria-label="Mes siguiente">
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                </button>
              </div>

              {/* Días de la semana */}
              <div className="grid grid-cols-7 gap-0 mb-1">
                {DAY_NAMES.map(d => (
                  <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
                ))}
              </div>

              {/* Días del mes */}
              <div className="grid grid-cols-7 gap-0">
                {/* Espacios vacíos */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-8" />
                ))}
                {/* Días */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${calYear}-${pad(calMonth + 1)}-${pad(day)}`;
                  const today = toISO(new Date());
                  const inRange = isInRange(dateStr);
                  const isStartDay = isStart(dateStr);
                  const isEndDay = isEnd(dateStr);
                  const isToday = dateStr === today;

                  return (
                    <button
                      key={day}
                      onClick={() => handleDayClick(dateStr)}
                      onMouseEnter={() => { if (selStart && !selEnd) setHovering(dateStr); }}
                      className={cn(
                        'h-8 text-xs rounded-md transition-colors relative',
                        inRange && !isStartDay && !isEndDay && 'bg-blue-50',
                        isStartDay && 'bg-blue-600 text-white rounded-r-none',
                        isEndDay && 'bg-blue-600 text-white rounded-l-none',
                        isStartDay && isEndDay && 'rounded-md',
                        !inRange && !isStartDay && !isEndDay && 'hover:bg-gray-100 text-gray-700',
                        isToday && !isStartDay && !isEndDay && 'font-bold text-blue-600',
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
