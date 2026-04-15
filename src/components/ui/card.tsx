import { cn } from "@/lib/utils";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-stone-200 bg-white/80 p-5 shadow-[0_18px_50px_rgba(88,56,34,0.08)] backdrop-blur sm:p-6",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: DivProps) {
  return <div className={cn("font-serif text-2xl text-stone-900", className)} {...props} />;
}

export function CardDescription({ className, ...props }: DivProps) {
  return <div className={cn("text-sm text-stone-600", className)} {...props} />;
}
