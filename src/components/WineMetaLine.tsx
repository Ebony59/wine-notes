import Link from "next/link";
import { cn } from "@/lib/utils";
import type { WineMetaBarItem } from "./WineMetaBar";

type Props = {
  items: WineMetaBarItem[];
  className?: string;
};

export function WineMetaLine({ items, className }: Props) {
  const visible = items.filter((i) => i.label.trim().length > 0);
  if (visible.length === 0) return null;

  return (
    <div className={cn("mt-3 flex flex-wrap items-center gap-y-1 text-sm", className)}>
      {visible.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center">
          {index > 0 && (
            <span className="mx-2 select-none text-stone-300">·</span>
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="text-stone-600 underline-offset-2 transition hover:text-stone-900 hover:underline"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-stone-600">{item.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}
