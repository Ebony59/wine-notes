"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type CoverPhotoGridItem = {
  id: string;
  url: string;
  alt?: string;
  href?: string;
  footerLabel?: string | null;
  isCover: boolean;
};

type CoverPhotoGridProps<T extends CoverPhotoGridItem> = {
  items: T[];
  containerClassName?: string;
  itemClassName?: string;
  coverBadgeText?: string;
  setCoverText?: string;
  deleteText?: string;
  onOpen?: (item: T) => void;
  onSetCover?: (item: T) => void;
  onDelete?: (item: T) => void;
};

export function CoverPhotoGrid<T extends CoverPhotoGridItem>({
  items,
  containerClassName,
  itemClassName,
  coverBadgeText = "Cover",
  setCoverText = "Set cover",
  deleteText = "Delete",
  onOpen,
  onSetCover,
  onDelete,
}: CoverPhotoGridProps<T>) {
  return (
    <div className={cn("flex flex-wrap gap-2", containerClassName)}>
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "group relative overflow-hidden rounded-xl border border-stone-200 bg-stone-100",
            itemClassName
          )}
        >
          {item.href ? (
            <Link href={item.href} aria-label={item.alt || "Open photo"} className="absolute inset-0 z-10" />
          ) : onOpen ? (
            <button
              type="button"
              onClick={() => onOpen(item)}
              aria-label={item.alt || "Open photo"}
              className="absolute inset-0 z-10"
            />
          ) : null}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt={item.alt ?? ""}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
          />

          <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/40" />

          {item.footerLabel && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 translate-y-full bg-gradient-to-t from-black/85 to-transparent px-2 pb-2 pt-6 text-xs font-semibold text-white transition-transform duration-300 group-hover:translate-y-0">
              {item.footerLabel}
            </div>
          )}

          {item.isCover && (
            <div className="pointer-events-none absolute left-1.5 top-1.5 z-20 rounded-lg bg-stone-900/90 px-2 py-1 text-[11px] font-semibold text-white shadow-md">
              {coverBadgeText}
            </div>
          )}

          {(onSetCover || onDelete) && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/45 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              <div className="flex flex-col items-center gap-2">
                {!item.isCover && onSetCover && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onSetCover(item);
                    }}
                    className="rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-stone-900 shadow-sm transition hover:bg-white"
                  >
                    {setCoverText}
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onDelete(item);
                    }}
                    className="text-xs font-medium text-rose-200 underline underline-offset-2 transition hover:text-white"
                  >
                    {deleteText}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
