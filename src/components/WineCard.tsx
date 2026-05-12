"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type WineCardWine = {
  id: string;
  name: string;
  vintage_year: number | null;
  producer_id: number | null;
  producers?: { name: string } | null;
  countries?: { name: string } | null;
  regions?: { name: string } | null;
  subregions?: { name: string } | null;
};

type MetadataField = "producer" | "country" | "region" | "subregion";

type WineCardProps<T extends WineCardWine> = {
  wines: T[];
  className?: string;
  hideFields?: MetadataField[];
};

export function formatWineVintage(year: number | null) {
  return year ?? "NV";
}

export function getWineGroupHref(wine: Pick<WineCardWine, "name" | "producer_id">) {
  return `/wines/group/${wine.producer_id ?? 0}/${encodeURIComponent(wine.name)}`;
}

export function groupWinesForCards<T extends WineCardWine>(wines: T[]) {
  const grouped = new Map<string, T[]>();

  for (const wine of wines) {
    const key = `${wine.producer_id ?? "none"}::${wine.name}`;
    const current = grouped.get(key) ?? [];
    current.push(wine);
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((group) =>
      [...group].sort((a, b) => (b.vintage_year ?? -1) - (a.vintage_year ?? -1))
    )
    .sort((a, b) => {
      const nameCompare = a[0].name.localeCompare(b[0].name);
      if (nameCompare !== 0) return nameCompare;
      return (a[0].producers?.name ?? "").localeCompare(b[0].producers?.name ?? "");
    });
}

export function WineCard<T extends WineCardWine>({
  wines,
  className,
  hideFields = [],
}: WineCardProps<T>) {
  if (wines.length === 0) return null;

  const primaryWine = wines[0];
  const wineHref = getWineGroupHref(primaryWine);
  const hidden = new Set(hideFields);
  const metadataValues = [
    !hidden.has("producer") ? primaryWine.producers?.name ?? null : null,
    !hidden.has("subregion") ? primaryWine.subregions?.name ?? null : null,
    !hidden.has("region") ? primaryWine.regions?.name ?? null : null,
    !hidden.has("country") ? primaryWine.countries?.name ?? null : null,
  ].filter((value): value is string => Boolean(value));

  const metadata = Array.from(new Set(metadataValues)).join(" · ");

  return (
    <div
      className={cn(
        "group relative rounded-2xl border border-stone-200 bg-white px-4 py-4 transition hover:border-stone-300 hover:bg-stone-50/80",
        className
      )}
    >
      <Link
        href={wineHref}
        aria-label={`Open wine page for ${primaryWine.name}`}
        className="absolute inset-0 rounded-2xl"
      />

      <div className="relative z-10 pointer-events-none flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-medium text-stone-900">{primaryWine.name}</div>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4 shrink-0 text-stone-400 transition-transform group-hover:translate-x-0.5"
            >
              <path
                d="M7.5 5.5 12 10l-4.5 4.5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
            </svg>
          </div>
          {metadata && <div className="mt-1 text-xs text-stone-500">{metadata}</div>}
        </div>

        <div className="shrink-0 text-xs text-stone-500">
          {wines.length} {wines.length === 1 ? "vintage" : "vintages"}
        </div>
      </div>

      <div className="relative z-10 mt-4 flex flex-wrap gap-2">
        {wines.map((wine) => (
          <Link
            key={wine.id}
            href={`/wines/${wine.id}`}
            className="pointer-events-auto rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 transition hover:bg-stone-100"
          >
            {formatWineVintage(wine.vintage_year)}
          </Link>
        ))}
      </div>
    </div>
  );
}
