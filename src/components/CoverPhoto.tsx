"use client";

import { cn } from "@/lib/utils";

type CoverPhotoProps = {
  /** The resolved URL of the cover image. */
  url: string;
  /** Alt text for the image (typically the entity name). */
  alt: string;
  /**
   * If provided the image becomes a clickable button that calls this handler
   * (use it to open a lightbox). If omitted the image is rendered as a plain div.
   */
  onExpand?: () => void;
  /** Called when the user clicks "Replace" — scroll to the photo picker, etc. */
  onReplace: () => void;
  /** Called when the user clicks "Remove" — should clear cover_photo_url. */
  onRemove: () => void;
  className?: string;
};

export function CoverPhoto({
  url,
  alt,
  onExpand,
  onReplace,
  onRemove,
  className,
}: CoverPhotoProps) {
  const media = (
    <div className="relative aspect-[3/2] overflow-hidden rounded-[28px] border border-stone-200 bg-stone-100 shadow-xl">
      {/* Blurred photo backdrop — fills the frame with the image's own colours */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl"
      />
      {/* Soft warm vignette over the backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(245,235,221,0.45)_100%)]" />
      {/* Main photo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_4px_24px_rgba(0,0,0,0.25)]"
      />
      {onExpand && (
        <div className="pointer-events-none absolute right-4 top-4 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-stone-700 shadow-sm backdrop-blur-sm">
          View full size
        </div>
      )}
    </div>
  );

  return (
    <div className={cn("space-y-3", className)}>
      {onExpand ? (
        <button
          type="button"
          onClick={onExpand}
          className="block w-full text-left transition hover:scale-[1.01]"
        >
          {media}
        </button>
      ) : (
        media
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white/90 px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
            Cover photo
          </div>
          <div className="truncate text-sm font-medium text-stone-900">{alt}</div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onReplace}
            className="text-xs font-medium text-stone-600 underline underline-offset-2 transition hover:text-stone-900"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs font-medium text-rose-500 underline underline-offset-2 transition hover:text-rose-700"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
