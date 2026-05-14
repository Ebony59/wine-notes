"use client";

import Fuse from "fuse.js";
import { useEffect, useMemo, useRef, useState } from "react";

export type EntityOption = {
  id: number;
  name: string;
  hint?: string;
};

type Props = {
  options: EntityOption[];
  value: string;
  onChange: (text: string) => void;
  onSelect: (option: EntityOption) => void;
  onCreateNew?: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function EntitySearchInput({
  options,
  value,
  onChange,
  onSelect,
  onCreateNew,
  placeholder,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const filtered = useMemo(() => {
    const q = value.trim();
    if (!q) return options;
    const fuse = new Fuse(options, { keys: ["name"], threshold: 0.4, ignoreLocation: true });
    return fuse.search(q).map((r) => r.item);
  }, [options, value]);

  const exactMatch = options.some(
    (o) => o.name.toLowerCase() === value.trim().toLowerCase()
  );
  const canCreate = !!onCreateNew && value.trim().length > 0 && !exactMatch;
  const showDropdown = open && !disabled && (filtered.length > 0 || canCreate);

  return (
    <div ref={containerRef} className="relative">
      <input
        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-stone-500 disabled:opacity-50"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {showDropdown && (
        <ul className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-stone-200 bg-white shadow-lg">
          {filtered.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(option);
                  onChange(option.name);
                  setOpen(false);
                }}
              >
                <span>{option.name}</span>
                {option.hint && (
                  <span className="ml-2 shrink-0 text-xs text-stone-400">{option.hint}</span>
                )}
              </button>
            </li>
          ))}
          {canCreate && (
            <li>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm font-medium text-stone-900 hover:bg-stone-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onCreateNew!(value.trim());
                  setOpen(false);
                }}
              >
                + Create &ldquo;{value.trim()}&rdquo;
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
