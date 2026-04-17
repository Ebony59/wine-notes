"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { NotesEditBar } from "@/components/NotesEditBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type VintageNoteItem = {
  region_id: number;
  year: number;
  notes: string | null;
};

type VintageNotesListProps = {
  regionId: number;
  regionName: string;
  vintages: VintageNoteItem[];
  emptyText: string;
  onCreate?: (year: number, notes: string) => Promise<void>;
  onUpdate: (year: number, notes: string) => Promise<void>;
  onDelete: (year: number) => Promise<void>;
  compact?: boolean;
  linkHref?: string;
};

function parseVintageYear(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const year = Number(trimmed);
  if (!Number.isInteger(year) || year < 1800 || year > 2100) return Number.NaN;
  return year;
}

export function VintageNotesList({
  regionId,
  regionName,
  vintages,
  emptyText,
  onCreate,
  onUpdate,
  onDelete,
  compact = false,
  linkHref,
}: VintageNotesListProps) {
  const [adding, setAdding] = useState(false);
  const [addYear, setAddYear] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [editingYear, setEditingYear] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const sortedVintages = useMemo(
    () => vintages.slice().sort((a, b) => b.year - a.year),
    [vintages]
  );

  const addYearValue = parseVintageYear(addYear);
  const addYearInvalid = addYear.trim() !== "" && Number.isNaN(addYearValue);
  const canCreate =
    Boolean(onCreate) &&
    addYearValue !== null &&
    !Number.isNaN(addYearValue) &&
    addNotes.trim().length > 0;

  async function commitCreate() {
    if (!onCreate || addYearValue === null || Number.isNaN(addYearValue) || !addNotes.trim()) return;
    setBusyKey(`create-${regionId}-${addYearValue}`);
    await onCreate(addYearValue, addNotes.trim());
    setBusyKey(null);
    setAddYear("");
    setAddNotes("");
    setAdding(false);
  }

  function beginEdit(item: VintageNoteItem) {
    setEditingYear(item.year);
    setEditingNotes(item.notes ?? "");
  }

  async function commitEdit(year: number) {
    if (!editingNotes.trim()) return;
    setBusyKey(`edit-${regionId}-${year}`);
    await onUpdate(year, editingNotes.trim());
    setBusyKey(null);
    setEditingYear(null);
    setEditingNotes("");
  }

  async function commitDelete(year: number) {
    if (!confirm(`Delete the ${year} vintage note for ${regionName}?`)) return;
    setBusyKey(`delete-${regionId}-${year}`);
    await onDelete(year);
    setBusyKey(null);
    if (editingYear === year) {
      setEditingYear(null);
      setEditingNotes("");
    }
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {onCreate && !adding && (
        <div className="flex justify-end">
          <Button variant="secondary" className="rounded-full px-3 py-1 text-xs" onClick={() => setAdding(true)}>
            + Add vintage note
          </Button>
        </div>
      )}

      {onCreate && adding && (
        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
          <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
            <div>
              <div className="mb-1 text-xs font-medium text-stone-500">Vintage</div>
              <Input
                autoFocus
                value={addYear}
                onChange={(event) => setAddYear(event.target.value)}
                placeholder="e.g. 1998"
                inputMode="numeric"
              />
              {addYearInvalid && (
                <p className="mt-1 text-xs text-rose-600">Use a year between 1800 and 2100.</p>
              )}
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-stone-500">Notes</div>
              <Textarea
                rows={4}
                className="min-h-[120px]"
                placeholder={`Notes about the ${regionName} ${addYear.trim() || "vintage"}...`}
                value={addNotes}
                onChange={(event) => setAddNotes(event.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={commitCreate} disabled={!canCreate || Boolean(busyKey)}>
              {busyKey?.startsWith("create-") ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setAdding(false);
                setAddYear("");
                setAddNotes("");
              }}
              disabled={Boolean(busyKey)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {sortedVintages.length === 0 ? (
        <p className="text-sm text-stone-500">{emptyText}</p>
      ) : (
        <div className={compact ? "space-y-2" : "space-y-3"}>
          {sortedVintages.map((item) => {
            const isEditing = editingYear === item.year;
            return (
              <div
                key={`${item.region_id}-${item.year}`}
                className={`rounded-2xl border border-stone-200 ${compact ? "bg-white px-4 py-3" : "bg-stone-50/80 px-4 py-4"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {linkHref ? (
                      <Link
                        href={linkHref}
                        className="inline-flex items-center gap-1 text-sm font-medium text-stone-900 underline-offset-2 hover:underline"
                      >
                        {item.year}
                        <svg className="h-3.5 w-3.5 shrink-0 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    ) : (
                      <div className="text-sm font-medium text-stone-900">{item.year}</div>
                    )}
                  </div>
                  {!isEditing && (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => beginEdit(item)}
                        className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-700 transition hover:border-stone-500 hover:bg-white"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => commitDelete(item.year)}
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600 transition hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="mt-3 space-y-3">
                    <Textarea
                      rows={4}
                      className="min-h-[120px]"
                      value={editingNotes}
                      onChange={(event) => setEditingNotes(event.target.value)}
                    />
                    <NotesEditBar
                      saving={busyKey === `edit-${regionId}-${item.year}` || busyKey === `delete-${regionId}-${item.year}`}
                      onSave={() => commitEdit(item.year)}
                      onCancel={() => {
                        setEditingYear(null);
                        setEditingNotes("");
                      }}
                      onDelete={() => commitDelete(item.year)}
                    />
                  </div>
                ) : item.notes ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-800">{item.notes}</p>
                ) : (
                  <p className="mt-3 text-sm text-stone-500">No notes yet.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
