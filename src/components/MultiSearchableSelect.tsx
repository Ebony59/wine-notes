"use client";

import Fuse from "fuse.js";
import { useEffect, useMemo, useRef, useState } from "react";

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

  useEffect(() => {
    setActiveIndex(-1);
  }, [filteredOptions]);

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
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
            >
              {value}
              <button
                type="button"
                className="text-gray-500 hover:text-gray-700"
                onClick={() => removeValue(value)}
                aria-label={`Remove ${value}`}
              >
                ×
              </button>
            </span>
          ))}

          <input
            className="min-w-[8rem] flex-1 border-0 bg-transparent p-0 text-sm outline-none"
            value={query}
            placeholder={values.length === 0 ? placeholder : undefined}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />

          <button
            type="button"
            className="flex h-4 w-4 items-center justify-center text-gray-400"
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
        <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-lg border bg-white shadow-lg">
          <li>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
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
                className={`w-full px-3 py-2 text-left text-sm ${
                  index === activeIndex ? "bg-gray-100" : "hover:bg-gray-50"
                }`}
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
