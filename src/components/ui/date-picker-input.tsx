"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

interface DatePickerInputProps {
  value: string; // YYYY-MM-DD or ""
  onChange: (date: string) => void;
  highlightedDates?: string[]; // YYYY-MM-DD strings
  placeholder?: string;
}

function isoToDisplay(iso: string): string {
  if (!iso || iso.length !== 10) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? undefined : date;
}

function dateToISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function DatePickerInput({
  value,
  onChange,
  highlightedDates = [],
  placeholder = "DD/MM/YYYY",
}: DatePickerInputProps) {
  const [text, setText] = useState(isoToDisplay(value));
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(
    isoToDate(value) ?? new Date()
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(isoToDisplay(value));
    if (value) {
      const d = isoToDate(value);
      if (d) setMonth(d);
    }
  }, [value]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const highlightedSet = new Set(highlightedDates);
  const highlightedDateObjs = highlightedDates
    .map(isoToDate)
    .filter((d): d is Date => d !== undefined);
  const selected = isoToDate(value);

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    setText(formatted);

    if (digits.length === 8) {
      const iso = `${digits.slice(4)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
      if (highlightedSet.has(iso)) {
        onChange(iso);
        const d = isoToDate(iso);
        if (d) setMonth(d);
      }
    } else if (digits.length === 0) {
      onChange("");
    }
  }

  function handleSelect(date: Date | undefined) {
    if (!date) {
      onChange("");
    } else {
      onChange(dateToISO(date));
    }
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-1.5">
        <input
          type="text"
          value={text}
          onChange={handleTextChange}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          maxLength={10}
          className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-500 focus:bg-white"
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded-2xl border border-stone-300 bg-stone-50 px-3 py-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-700"
          aria-label="Open calendar"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="rdp-wine-theme absolute left-0 top-full z-50 mt-1 rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            month={month}
            onMonthChange={setMonth}
            disabled={(date) => {
              const iso = dateToISO(date);
              return !highlightedSet.has(iso) && iso !== value;
            }}
            modifiers={{ highlighted: highlightedDateObjs }}
            modifiersClassNames={{ highlighted: "rdp-day-has-tasting" }}
          />
        </div>
      )}
    </div>
  );
}
