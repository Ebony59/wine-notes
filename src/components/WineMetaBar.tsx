import Link from "next/link";
import { cn } from "@/lib/utils";

export type WineMetaBarItem = {
  label: string;
  href?: string | null;
};

type WineMetaBarProps = {
  items: WineMetaBarItem[];
  className?: string;
};

export function WineMetaBar({ items, className }: WineMetaBarProps) {
  const visibleItems = items.filter((item) => item.label.trim().length > 0);

  if (visibleItems.length === 0) return null;

  return (
    <div className={cn("mt-3 flex flex-wrap gap-2", className)}>
      {visibleItems.map((item, index) => {
        const key = `${item.label}-${item.href ?? "static"}-${index}`;
        const sharedClassName =
          "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition";

        if (item.href) {
          return (
            <Link
              key={key}
              href={item.href}
              className={cn(
                sharedClassName,
                "border-stone-300 bg-white text-stone-700 hover:border-stone-500 hover:text-stone-900"
              )}
            >
              <span>{item.label}</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="h-3 w-3 shrink-0 text-stone-400"
              >
                <path
                  d="M6 3.5 10 8l-4 4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              </svg>
            </Link>
          );
        }

        return (
          <span
            key={key}
            className={cn(
              sharedClassName,
              "border-stone-200 bg-stone-50 text-stone-600"
            )}
          >
            {item.label}
          </span>
        );
      })}
    </div>
  );
}
