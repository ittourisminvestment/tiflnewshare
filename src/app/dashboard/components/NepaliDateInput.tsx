'use client';

import { useState, useEffect, useRef } from 'react';
import { adToBs, bsToAd } from '@/lib/utils/nepaliDate';
import NepaliDate from 'nepali-date-converter';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface NepaliDateInputProps {
  value: string; // AD date YYYY-MM-DD
  onChange: (ad: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
  align?: 'left' | 'right';
}

const monthsBS = [
  'Baishakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

export default function NepaliDateInput({ 
  value, 
  onChange, 
  required, 
  className = "input",
  placeholder = "YYYY-MM-DD (BS)",
  align = 'left'
}: NepaliDateInputProps) {
  const [bsDate, setBsDate] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Calendar state
  const [viewDate, setViewDate] = useState(new NepaliDate());
  
  useEffect(() => {
    if (value) {
      const bs = adToBs(value);
      setBsDate(bs);
      const [y, m, d] = bs.split('-').map(Number);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        setViewDate(new NepaliDate(y, m - 1, d));
      }
    } else {
      setBsDate('');
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value.replace(/\D/g, '');
    if (input.length > 8) input = input.slice(0, 8);
    
    let formatted = input;
    if (input.length > 4) formatted = input.slice(0, 4) + '-' + input.slice(4);
    if (input.length > 6) formatted = formatted.slice(0, 7) + '-' + formatted.slice(7);
    
    setBsDate(formatted);

    if (formatted.length === 10) {
      const ad = bsToAd(formatted);
      if (ad) {
        onChange(ad);
        const [y, m, d] = formatted.split('-').map(Number);
        setViewDate(new NepaliDate(y, m - 1, d));
      }
    }
  };

  const handleSelectDay = (day: number) => {
    const y = viewDate.getYear();
    const m = viewDate.getMonth() + 1;
    const formatted = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setBsDate(formatted);
    const ad = bsToAd(formatted);
    if (ad) onChange(ad);
    setShowCalendar(false);
  };

  const changeMonth = (delta: number) => {
    const nextDate = new NepaliDate(viewDate.getYear(), viewDate.getMonth() + delta, 1);
    setViewDate(nextDate);
  };

  const changeYear = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextDate = new NepaliDate(parseInt(e.target.value), viewDate.getMonth(), 1);
    setViewDate(nextDate);
  };

  // Improved Days in month calculation for NepaliDate
  const getDaysInMonth = (year: number, month: number) => {
    // month is 0-indexed
    // We try to create a date with day 32 and check if it overflows
    // or we can use the library's internal mapping if we could find it,
    // but a reliable way is to check the next month's first day.
    let days = 32;
    while (days > 27) {
      const d = new NepaliDate(year, month, days);
      if (d.getMonth() === month && d.getDate() === days) {
        return days;
      }
      days--;
    }
    return 28;
  };

  const daysInMonth = getDaysInMonth(viewDate.getYear(), viewDate.getMonth());
  const firstDay = new NepaliDate(viewDate.getYear(), viewDate.getMonth(), 1).getDay(); // 0-6 (Sun-Sat)
  
  const currentY = viewDate.getYear();
  const currentM = viewDate.getMonth();
  
  const years = [];
  for (let y = 2000; y <= 2100; y++) years.push(y);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          className={className}
          placeholder={placeholder}
          value={bsDate}
          onChange={handleBsChange}
          onFocus={() => setShowCalendar(true)}
          required={required}
          maxLength={10}
          style={{ paddingRight: '40px' }}
        />
        <button 
          type="button"
          onClick={() => setShowCalendar(!showCalendar)}
          style={{ 
            position: 'absolute', right: '0', top: '0', bottom: '0', width: '38px',
            background: 'transparent', border: 'none',
            cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <CalendarIcon size={16} />
        </button>
      </div>
      
      {showCalendar && (
        <div className={`nepali-datepicker-dropdown ${align === 'right' ? 'align-right' : ''}`}>
          <div className="calendar-header">
            <button type="button" onClick={() => changeMonth(-1)} className="cal-btn"><ChevronLeft size={16} /></button>
            <div className="cal-title">
              <span>{monthsBS[currentM]}</span>
              <select value={currentY} onChange={changeYear} className="cal-year-select">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => changeMonth(1)} className="cal-btn"><ChevronRight size={16} /></button>
          </div>
          
          <div className="cal-weekdays">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => <div key={i} className="cal-weekday">{d}</div>)}
          </div>
          
          <div className="cal-grid">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="cal-day empty" />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = bsDate === `${currentY}-${String(currentM + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = adToBs(new Date().toISOString().split('T')[0]) === `${currentY}-${String(currentM + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              
              return (
                <div 
                  key={day} 
                  className={`cal-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                  onClick={() => handleSelectDay(day)}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {value && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'flex', justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
          AD: {value}
        </div>
      )}
    </div>
  );
}
