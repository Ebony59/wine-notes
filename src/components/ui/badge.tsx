import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "muted" | "danger";
};

const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "border-stone-300 bg-white text-stone-600",
  muted: "border-stone-200 bg-stone-100 text-stone-600",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em]",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
