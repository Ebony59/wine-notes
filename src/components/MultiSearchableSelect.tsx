"use client";

import Fuse from "fuse.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  values: string[];
  onChange: (values: string[]) => void;
  options: string[];
  placeholder?: string;
};

export default function MultiSearchableSelect({
  values,
  onChange,
  options,
  placeholder,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredOptions = useMemo(() => {
    const selected = new Set(values.map((value) => value.toLowerCase()));
    const remainingOptions = options.filter((option) => !selected.has(option.toLowerCase()));
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) return remainingOptions;

    const fuse = new Fuse(remainingOptions, {
      threshold: 0.35,
      ignoreLocation: true,
    });

    return fuse.search(trimmed).map((result) => result.item);
  }, [options, query, values]);

  function addValue(nextValue: string) {
    if (values.includes(nextValue)) return;
    onChange([...values, nextValue]);
    setQuery("");
    setOpen(false);
  }

  function removeValue(value: string) {
    onChange(values.filter((entry) => entry !== value));
  }

  function clearAll() {
    onChange([]);
    setQuery("");
    setOpen(false);
  }

  function toggleOpen() {
    setOpen((current) => !current);
    if (open) setQuery("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !open) {
      e.preventDefault();
      setOpen(true);
      return;
    }

    if (e.key === "Backspace" && query === "" && values.length > 0) {
      e.preventDefault();
      onChange(values.slice(0, -1));
      return;
    }

    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filteredOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) addValue(filteredOptions[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="rounded-2xl border border-stone-300 bg-stone-50 shadow-sm transition focus-within:border-stone-500 focus-within:bg-white">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-700"
            >
              {value}
              <button
                type="button"
                className="text-stone-500 hover:text-stone-700"
                onClick={() => removeValue(value)}
                aria-label={`Remove ${value}`}
              >
                ×
              </button>
            </span>
          ))}

          <input
            className="min-w-[8rem] flex-1 border-0 bg-transparent p-0 text-sm text-stone-900 outline-none placeholder:text-stone-500"
            value={query}
            placeholder={values.length === 0 ? placeholder : undefined}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(-1);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />

          <button
            type="button"
            className="flex h-4 w-4 items-center justify-center text-stone-400"
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggleOpen}
            aria-label={open ? "Close dropdown" : "Open dropdown"}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            >
              <path
                d="M5.5 7.5 10 12l4.5-4.5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <ul className="absolute z-20 mt-2 max-h-52 w-full overflow-auto rounded-2xl border border-stone-200 bg-white/95 p-1 shadow-[0_18px_40px_rgba(88,56,34,0.14)] backdrop-blur">
          <li>
            <button
              type="button"
              className="w-full rounded-xl px-3 py-2 text-left text-sm text-stone-700 transition hover:bg-stone-50"
              onMouseDown={(e) => {
                e.preventDefault();
                clearAll();
              }}
            >
              Clear all
            </button>
          </li>

          {filteredOptions.map((option, index) => (
            <li key={option}>
              <button
                type="button"
                className={cn(
                  "w-full rounded-xl px-3 py-2 text-left text-sm text-stone-700 transition",
                  index === activeIndex ? "bg-stone-100 text-stone-900" : "hover:bg-stone-50"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  addValue(option);
                }}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
