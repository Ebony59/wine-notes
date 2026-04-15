"use client";

import { useState, useRef, useEffect } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  fetchSuggestions: (query: string) => Promise<string[]>;
};

export default function AutocompleteInput({
  value,
  onChange,
  placeholder,
  fetchSuggestions,
}: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Reset active index whenever suggestions list changes
  useEffect(() => setActiveIndex(-1), [suggestions]);

  function handleChange(v: string) {
    onChange(v);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = v.trim();
    if (!trimmed || trimmed.toUpperCase() === "NA" || trimmed.toUpperCase() === "NV") {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const results = await fetchSuggestions(trimmed);
      setSuggestions(results);
      setOpen(results.length > 0);
    }, 200);
  }

  function select(s: string) {
    onChange(s);
    setSuggestions([]);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      select(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        className="border rounded px-3 py-2 w-full"
        placeholder={placeholder}
        value={value}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-20 top-full mt-1 w-full bg-white border rounded-lg shadow-lg max-h-52 overflow-auto">
          {suggestions.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                className={`w-full text-left px-3 py-2 text-sm ${
                  i === activeIndex ? "bg-gray-100" : "hover:bg-gray-50"
                }`}
                // mousedown fires before blur, so we prevent default to keep focus in the input
                onMouseDown={e => { e.preventDefault(); select(s); }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
