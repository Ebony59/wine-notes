"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  fetchSuggestions: (query: string) => Promise<string[]>;
};

function normalizeTag(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export default function TagAutocompleteInput({
  values,
  onChange,
  placeholder,
  fetchSuggestions,
}: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function addTag(rawValue: string) {
    const tag = normalizeTag(rawValue);
    if (!tag) return;
    if (values.some((value) => value.toLowerCase() === tag.toLowerCase())) {
      setQuery("");
      setSuggestions([]);
      setOpen(false);
      return;
    }

    onChange([...values, tag]);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
  }

  function removeTag(tag: string) {
    onChange(values.filter((value) => value !== tag));
  }

  function handleChange(nextValue: string) {
    setQuery(nextValue);
    setActiveIndex(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = normalizeTag(nextValue);
    if (!trimmed) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const results = await fetchSuggestions(trimmed);
      const filtered = results.filter(
        (result) => !values.some((value) => value.toLowerCase() === result.toLowerCase())
      );
      setSuggestions(filtered);
      setActiveIndex(-1);
      setOpen(filtered.length > 0);
    }, 200);
  }

  function commitQuery() {
    if (query.trim()) addTag(query);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && query.trim()) {
      e.preventDefault();
      if (open && activeIndex >= 0) {
        addTag(suggestions[activeIndex]);
        return;
      }
      commitQuery();
      return;
    }

    if (e.key === "Backspace" && !query && values.length > 0) {
      e.preventDefault();
      onChange(values.slice(0, -1));
      return;
    }

    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 shadow-sm transition focus-within:border-stone-500 focus-within:bg-white">
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-sm text-stone-700"
            >
              {value}
              <button
                type="button"
                className="text-stone-500 hover:text-stone-700"
                onClick={() => removeTag(value)}
                aria-label={`Remove ${value}`}
              >
                ×
              </button>
            </span>
          ))}

          <input
            className="min-w-[12rem] flex-1 border-0 bg-transparent p-0 text-sm text-stone-900 outline-none placeholder:text-stone-400"
            placeholder={values.length === 0 ? placeholder : undefined}
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            onBlur={() => commitQuery()}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
        </div>
      </div>

      {open && (
        <ul className="absolute top-full z-20 mt-2 w-full overflow-auto rounded-2xl border border-stone-200 bg-white/95 p-1 shadow-[0_18px_40px_rgba(88,56,34,0.14)] backdrop-blur">
          {suggestions.map((suggestion, index) => (
            <li key={suggestion}>
              <button
                type="button"
                className={cn(
                  "w-full rounded-xl px-3 py-2 text-left text-sm text-stone-700 transition",
                  index === activeIndex ? "bg-stone-100 text-stone-900" : "hover:bg-stone-50"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(suggestion);
                }}
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
