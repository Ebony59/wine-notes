"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (v: string) => void;
  placeholder?: string;
  fetchSuggestions: (query: string) => Promise<string[]>;
};

export default function AutocompleteInput({
  value,
  onChange,
  onSelect,
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

  function handleChange(v: string) {
    onChange(v);
    setActiveIndex(-1);

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
      setActiveIndex(-1);
      setOpen(results.length > 0);
    }, 200);
  }

  function select(s: string) {
    onChange(s);
    onSelect?.(s);
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
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {open && (
        <ul className="absolute top-full z-20 mt-2 max-h-52 w-full overflow-auto rounded-2xl border border-stone-200 bg-white/95 p-1 shadow-[0_18px_40px_rgba(88,56,34,0.14)] backdrop-blur">
          {suggestions.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                className={cn(
                  "w-full rounded-xl px-3 py-2 text-left text-sm text-stone-700 transition",
                  i === activeIndex ? "bg-stone-100 text-stone-900" : "hover:bg-stone-50"
                )}
                // mousedown fires before blur, so we prevent default to keep focus in the input
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(s);
                }}
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
