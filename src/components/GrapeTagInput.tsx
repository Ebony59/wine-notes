"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  createGrapeTag,
  dedupeGrapeTags,
  formatGrapeDisplayName,
  normalizeGrapeName,
  type GrapeSuggestion,
  type GrapeTag,
} from "@/lib/grape-utils";

type Props = {
  value: GrapeTag[];
  onChange: (value: GrapeTag[]) => void;
  placeholder?: string;
  fetchSuggestions: (query: string) => Promise<GrapeSuggestion[]>;
};

function matchesSuggestionLabel(tag: GrapeTag, suggestion: GrapeSuggestion) {
  return (
    tag.grapeId === suggestion.grapeId &&
    normalizeGrapeName(tag.displayName).toLocaleLowerCase() ===
      normalizeGrapeName(suggestion.matchedName).toLocaleLowerCase()
  );
}

export default function GrapeTagInput({
  value,
  onChange,
  placeholder,
  fetchSuggestions,
}: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GrapeSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [resolverQuery, setResolverQuery] = useState("");
  const [resolverSuggestions, setResolverSuggestions] = useState<GrapeSuggestion[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolverDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editingTag = useMemo(
    () => value.find((tag) => tag.id === editingTagId) ?? null,
    [value, editingTagId]
  );

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setEditingTagId(null);
        setResolverQuery("");
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function commitTags(nextTags: GrapeTag[]) {
    onChange(dedupeGrapeTags(nextTags));
  }

  function addFreeformTag(rawValue: string) {
    const displayName = normalizeGrapeName(rawValue);
    if (!displayName) return;

    if (value.some((tag) => normalizeGrapeName(tag.displayName).toLocaleLowerCase() === displayName.toLocaleLowerCase())) {
      setQuery("");
      setSuggestions([]);
      setOpen(false);
      return;
    }

    commitTags([...value, createGrapeTag({ displayName })]);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
  }

  function addSuggestedTag(suggestion: GrapeSuggestion) {
    const nextTag = createGrapeTag({
      displayName: suggestion.matchedName,
      grapeId: suggestion.grapeId,
      canonicalName: suggestion.canonicalName,
      isResolved: true,
    });

    if (value.some((tag) => matchesSuggestionLabel(tag, suggestion))) {
      setQuery("");
      setSuggestions([]);
      setOpen(false);
      return;
    }

    commitTags([...value, nextTag]);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
  }

  function removeTag(tagId: string) {
    commitTags(value.filter((tag) => tag.id !== tagId));
    if (editingTagId === tagId) {
      setEditingTagId(null);
      setResolverQuery("");
      setResolverSuggestions([]);
    }
  }

  function updateTag(tagId: string, updater: (tag: GrapeTag) => GrapeTag) {
    commitTags(value.map((tag) => (tag.id === tagId ? updater(tag) : tag)));
  }

  function handleChange(nextValue: string) {
    setQuery(nextValue);
    setActiveIndex(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = normalizeGrapeName(nextValue);
    if (!trimmed) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const results = await fetchSuggestions(trimmed);
      setSuggestions(results);
      setActiveIndex(-1);
      setOpen(true);
    }, 180);
  }

  function handleResolverQueryChange(nextValue: string) {
    setResolverQuery(nextValue);

    if (resolverDebounceRef.current) clearTimeout(resolverDebounceRef.current);

    const trimmed = normalizeGrapeName(nextValue);
    if (!trimmed) {
      setResolverSuggestions([]);
      return;
    }

    resolverDebounceRef.current = setTimeout(async () => {
      const results = await fetchSuggestions(trimmed);
      setResolverSuggestions(results);
    }, 180);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if ((event.key === "Enter" || event.key === ",") && query.trim()) {
      event.preventDefault();
      if (open && activeIndex >= 0) {
        addSuggestedTag(suggestions[activeIndex]);
        return;
      }

      addFreeformTag(query);
      return;
    }

    if (event.key === "Backspace" && !query && value.length > 0) {
      event.preventDefault();
      removeTag(value[value.length - 1].id);
      return;
    }

    if (!open) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, -1));
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  function selectResolverSuggestion(suggestion: GrapeSuggestion) {
    if (!editingTag) return;

    updateTag(editingTag.id, (tag) => ({
      ...tag,
      grapeId: suggestion.grapeId,
      canonicalName: suggestion.canonicalName,
      isResolved: true,
    }));
    setResolverQuery(suggestion.canonicalName);
    setResolverSuggestions([]);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 shadow-sm transition focus-within:border-stone-500 focus-within:bg-white">
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => {
            const chipLabel = tag.canonicalName
              ? formatGrapeDisplayName(tag.displayName, tag.canonicalName)
              : tag.displayName;

            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => {
                  setEditingTagId((current) => (current === tag.id ? null : tag.id));
                  setResolverQuery(tag.canonicalName ?? "");
                  setResolverSuggestions([]);
                }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-sm transition",
                  editingTagId === tag.id
                    ? "border-stone-700 text-stone-900"
                    : tag.isResolved
                      ? "border-stone-200 text-stone-700 hover:border-stone-400"
                      : "border-amber-300 text-amber-800 hover:border-amber-400"
                )}
              >
                <span>{chipLabel}</span>
                {!tag.isResolved && <span className="text-[11px] uppercase tracking-wide text-amber-600">Link</span>}
                <span
                  role="button"
                  tabIndex={-1}
                  className="text-stone-500 hover:text-stone-700"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeTag(tag.id);
                  }}
                >
                  ×
                </span>
              </button>
            );
          })}

          <input
            className="min-w-[12rem] flex-1 border-0 bg-transparent p-0 text-sm text-stone-900 outline-none placeholder:text-stone-400"
            placeholder={value.length === 0 ? placeholder : undefined}
            value={query}
            onChange={(event) => handleChange(event.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            onBlur={() => {
              if (query.trim()) addFreeformTag(query);
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
        </div>
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute top-full z-20 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-stone-200 bg-white/95 p-1 shadow-[0_18px_40px_rgba(88,56,34,0.14)] backdrop-blur">
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.grapeId}-${suggestion.matchedName}-${suggestion.isAlias ? "alias" : "canonical"}`}>
              <button
                type="button"
                className={cn(
                  "w-full rounded-xl px-3 py-2 text-left transition",
                  index === activeIndex ? "bg-stone-100" : "hover:bg-stone-50"
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                  addSuggestedTag(suggestion);
                }}
              >
                <div className="text-sm font-medium text-stone-900">{suggestion.matchedName}</div>
                <div className="mt-0.5 text-xs text-stone-500">
                  {suggestion.isAlias ? `Alias of ${suggestion.canonicalName}` : "Canonical grape"}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {editingTag && (
        <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-stone-900">{editingTag.displayName}</div>
              <div className="mt-0.5 text-xs text-stone-500">
                {editingTag.canonicalName
                  ? `Linked to ${editingTag.canonicalName}`
                  : "Not linked yet. Choose an existing grape or leave it unlinked to create a new canonical grape."}
              </div>
            </div>
            <button
              type="button"
              className="text-xs text-stone-500 underline"
              onClick={() => {
                setEditingTagId(null);
                setResolverQuery("");
                setResolverSuggestions([]);
              }}
            >
              Close
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs text-stone-600">Link to existing grape</label>
              <input
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none placeholder:text-stone-500 focus:border-stone-500"
                value={resolverQuery}
                onChange={(event) => handleResolverQueryChange(event.target.value)}
                placeholder="Search canonical grapes or aliases"
              />
            </div>

            {resolverSuggestions.length > 0 && (
              <div className="max-h-40 overflow-auto rounded-2xl border border-stone-200 bg-white p-1">
                {resolverSuggestions.map((suggestion) => (
                  <button
                    key={`resolver-${suggestion.grapeId}-${suggestion.matchedName}-${suggestion.isAlias ? "alias" : "canonical"}`}
                    type="button"
                    className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-stone-50"
                    onClick={() => selectResolverSuggestion(suggestion)}
                  >
                    <div className="text-sm font-medium text-stone-900">{suggestion.canonicalName}</div>
                    <div className="mt-0.5 text-xs text-stone-500">
                      {suggestion.isAlias ? `Matched alias: ${suggestion.matchedName}` : "Canonical grape"}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                id={`set-main-name-${editingTag.id}`}
                type="checkbox"
                checked={editingTag.setMainName}
                disabled={!editingTag.grapeId || !editingTag.canonicalName || normalizeGrapeName(editingTag.displayName) === normalizeGrapeName(editingTag.canonicalName)}
                onChange={(event) =>
                  updateTag(editingTag.id, (tag) => ({
                    ...tag,
                    setMainName: event.target.checked,
                  }))
                }
              />
              <label
                htmlFor={`set-main-name-${editingTag.id}`}
                className="text-sm text-stone-700"
              >
                Set main name
              </label>
            </div>

            {editingTag.grapeId && (
              <button
                type="button"
                className="text-xs text-stone-600 underline"
                onClick={() =>
                  updateTag(editingTag.id, (tag) => ({
                    ...tag,
                    grapeId: undefined,
                    canonicalName: undefined,
                    isResolved: false,
                    setMainName: false,
                  }))
                }
              >
                Clear link
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
