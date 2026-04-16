"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { convertIfNeeded, type PendingPhoto } from "@/lib/photo-utils";

type Props = {
  /** Called whenever the pending photo list changes. Stable setter refs (from useState) work best. */
  onChange?: (photos: PendingPhoto[]) => void;
  /** Optional hint shown above the picker box. */
  hintText?: string;
};

export function PhotoPicker({ onChange, hintText }: Props) {
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notify parent whenever photos changes.
  // onChangeRef keeps the reference stable so the effect only re-runs when photos changes,
  // not every time the parent re-renders and passes a new inline function.
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });
  useEffect(() => {
    onChangeRef.current?.(photos);
  }, [photos]);

  // ── Add helpers ─────────────────────────────────────────────────────────────

  async function addFile(file: File) {
    const id = crypto.randomUUID();
    // Add placeholder immediately so the thumbnail slot appears
    setPhotos(prev => [...prev, { id, file, url: "", preview: null, converting: true }]);
    try {
      // Convert before creating the preview URL so HEIC renders on Chrome/Firefox
      const displayable = await convertIfNeeded(file);
      setPhotos(prev => prev.map(p =>
        p.id === id
          ? { ...p, preview: URL.createObjectURL(displayable), converting: false }
          : p
      ));
    } catch {
      // Preview stays null; file is still queued for upload
      setPhotos(prev => prev.map(p =>
        p.id === id ? { ...p, converting: false } : p
      ));
    }
  }

  function addUrl() {
    const url = urlInput.trim();
    if (!url) return;
    const id = crypto.randomUUID();
    setPhotos(prev => [...prev, { id, file: null, url, preview: url, converting: false }]);
    setUrlInput("");
  }

  function removePhoto(id: string) {
    setPhotos(prev => prev.filter(p => p.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  // ── Event handlers ───────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    // Start all conversions concurrently; each manages its own converting flag
    await Promise.all(files.map(f => addFile(f)));
  }

  async function handlePaste(e: React.ClipboardEvent) {
    const imageItem = Array.from(e.clipboardData.items).find(item =>
      item.type.startsWith("image/")
    );
    const file = imageItem?.getAsFile();
    if (!file) return;
    e.preventDefault();
    const extension = file.type.split("/")[1] || "png";
    await addFile(new File([file], `pasted-image.${extension}`, { type: file.type }));
  }

  const expandedPhoto = photos.find(p => p.id === expandedId) ?? null;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {hintText && (
        <p className="mb-2 text-xs text-stone-500">{hintText}</p>
      )}

      <div
        className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50 p-4"
        onPaste={handlePaste}
      >
        {/* URL input */}
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Paste image URL from the web…"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addUrl()}
          />
          <Button
            variant="secondary"
            onClick={addUrl}
            disabled={!urlInput.trim()}
            className="shrink-0"
          >
            Add
          </Button>
        </div>

        <div className="flex items-center gap-3 text-xs text-stone-500">
          <span>Paste with Cmd/Ctrl+V · or</span>
          <label className="cursor-pointer rounded-xl border border-stone-200 bg-white px-3 py-1.5 font-medium transition hover:bg-stone-50">
            Choose files
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>

        {/* Thumbnail grid */}
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {photos.map(p => (
              <div key={p.id} className="group relative">
                {/* Thumbnail — click to expand */}
                <button
                  type="button"
                  onClick={() => p.preview && setExpandedId(p.id)}
                  className="block h-16 w-16 overflow-hidden rounded-xl border border-stone-200 bg-stone-100"
                >
                  {p.converting ? (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-stone-400">…</div>
                  ) : p.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.preview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-stone-400">?</div>
                  )}
                </button>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removePhoto(p.id)}
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-stone-700 text-[10px] text-white opacity-0 transition group-hover:opacity-100"
                  aria-label="Remove photo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {expandedPhoto?.preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setExpandedId(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={expandedPhoto.preview}
            alt=""
            className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setExpandedId(null)}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/40"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
