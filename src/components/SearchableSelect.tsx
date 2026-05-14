"use client";

import Fuse from "fuse.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  allLabel?: string;
  disabled?: boolean;
};

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  allLabel = "All",
  disabled = false,
}: Props) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [value]);

  const filteredOptions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return options;

    const fuse = new Fuse(options, {
      threshold: 0.35,
      ignoreLocation: true,
    });

    return fuse.search(trimmed).map((result) => result.item);
  }, [options, query]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [filteredOptions]);

  function select(nextValue: string) {
    onChange(nextValue);
    setQuery(nextValue);
    setOpen(false);
  }

  function clear() {
    onChange("");
    setQuery("");
    setOpen(false);
  }

  function toggleOpen() {
    if (disabled) return;
    setOpen((current) => !current);
    if (open) setQuery(value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !open) {
      e.preventDefault();
      setOpen(true);
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
      if (activeIndex >= 0) select(filteredOptions[activeIndex]);
      else if (query.trim() === "") clear();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery(value);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          "rounded-2xl border border-stone-300 bg-stone-50 shadow-sm transition focus-within:border-stone-500 focus-within:bg-white",
          disabled && "opacity-50"
        )}
      >
        <div className="flex items-center gap-2 px-4 py-3">
          <input
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-stone-900 outline-none placeholder:text-stone-500"
            value={query}
            placeholder={placeholder ?? allLabel}
            disabled={disabled}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => !disabled && setOpen(true)}
            onBlur={() => setQuery(value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
          <button
            type="button"
            className="flex h-4 w-4 items-center justify-center text-stone-400"
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggleOpen}
            aria-label={open ? "Close dropdown" : "Open dropdown"}
            disabled={disabled}
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

      {open && !disabled && (
        <ul className="absolute z-50 mt-2 max-h-52 w-full overflow-auto rounded-2xl border border-stone-200 bg-white/95 p-1 shadow-[0_18px_40px_rgba(88,56,34,0.14)] backdrop-blur">
          <li>
            <button
              type="button"
              className={cn(
                "w-full rounded-xl px-3 py-2 text-left text-sm text-stone-700 transition",
                activeIndex === -1 && query.trim() === ""
                  ? "bg-stone-100 text-stone-900"
                  : "hover:bg-stone-50"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                clear();
              }}
            >
              {allLabel}
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
                  select(option);
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
