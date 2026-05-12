"use client";

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
  const imageClasses =
    "block overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-sm";

  return (
    <div className={className}>
      {onExpand ? (
        <button
          type="button"
          onClick={onExpand}
          className={`${imageClasses} text-left transition hover:border-stone-300`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={alt} className="max-h-72 w-auto object-contain" />
        </button>
      ) : (
        <div className={imageClasses}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={alt} className="max-h-72 w-auto object-contain" />
        </div>
      )}

      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={onReplace}
          className="text-xs text-stone-500 underline underline-offset-2 transition hover:text-stone-800"
        >
          Replace
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-rose-500 underline underline-offset-2 transition hover:text-rose-700"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
