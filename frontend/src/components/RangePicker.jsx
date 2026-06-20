import { useState, useRef, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { ptBR } from 'date-fns/locale';
import { format } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

function strToDate(s) {
  if (!s) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dateToStr(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export default function RangePicker({ de, ate, onChange }) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState({ from: strToDate(de), to: strToDate(ate) });
  const ref = useRef(null);

  useEffect(() => {
    setRange({ from: strToDate(de), to: strToDate(ate) });
  }, [de, ate]);

  useEffect(() => {
    if (!open) return;
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  function handleSelect(r) {
    setRange(r || { from: undefined, to: undefined });
    if (r?.from && r?.to) {
      onChange({ de: dateToStr(r.from), ate: dateToStr(r.to) });
      setOpen(false);
    }
  }

  const btnLabel =
    de && ate
      ? `${format(strToDate(de), 'dd/MM/yyyy')} – ${format(strToDate(ate), 'dd/MM/yyyy')}`
      : 'Selecionar período';

  const meses = typeof window !== 'undefined' && window.innerWidth < 640 ? 1 : 2;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-12 px-4 inline-flex items-center gap-2 bg-gray-700 border border-gray-600 rounded-lg text-sm hover:border-orange-500 transition-colors whitespace-nowrap"
      >
        <CalendarDays size={16} className="text-gray-400 shrink-0" />
        {btnLabel}
      </button>

      {open && (
        <div className="absolute z-50 top-14 left-0 rp-cal bg-gray-800 border border-gray-600 rounded-2xl shadow-2xl p-4" style={{ minWidth: meses === 2 ? 560 : 280 }}>
          <DayPicker
            mode="range"
            numberOfMonths={meses}
            selected={range}
            onSelect={handleSelect}
            locale={ptBR}
            components={{
              IconLeft: () => <ChevronLeft size={15} />,
              IconRight: () => <ChevronRight size={15} />,
            }}
            classNames={{
              months: 'flex gap-6',
              month: 'space-y-2',
              caption: 'rp-caption flex justify-center items-center relative px-8 py-1 mb-1',
              caption_label: 'text-sm font-semibold text-gray-100',
              nav: 'flex',
              nav_button: 'rp-navbtn',
              nav_button_previous: 'absolute left-0',
              nav_button_next: 'absolute right-0',
              table: 'w-full border-collapse',
              head_row: 'flex',
              head_cell: 'rp-head',
              row: 'flex mt-1',
              cell: 'relative p-0',
              day: 'rp-day',
              day_selected: 'rp-day rp-sel',
              day_today: 'rp-day rp-today',
              day_outside: 'rp-day opacity-30',
              day_disabled: 'rp-day opacity-30 cursor-not-allowed',
              day_range_middle: 'rp-day rp-mid',
              day_range_start: 'rp-day rp-sel',
              day_range_end: 'rp-day rp-sel',
              day_hidden: 'invisible',
            }}
          />
        </div>
      )}
    </div>
  );
}
