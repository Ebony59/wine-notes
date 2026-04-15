import { cn } from "@/lib/utils";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export function PageShell({ className, ...props }: DivProps) {
  return (
    <main
      className={cn(
        "min-h-screen bg-[linear-gradient(180deg,rgba(255,249,240,0.94)_0%,rgba(245,235,221,0.86)_100%)] px-4 py-10 sm:px-6 lg:px-8",
        className
      )}
      {...props}
    />
  );
}

export function PageContainer({ className, ...props }: DivProps) {
  return <div className={cn("mx-auto max-w-5xl", className)} {...props} />;
}

export function PageTopBar({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
      {...props}
    />
  );
}

export function PageTopNav({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center gap-2 rounded-[24px] border border-stone-200/80 bg-white/75 p-2 shadow-[0_14px_36px_rgba(88,56,34,0.08)] backdrop-blur sm:w-auto sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

export function PageHero({ className, ...props }: DivProps) {
  return <div className={cn("max-w-3xl", className)} {...props} />;
}

export function Eyebrow({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs uppercase tracking-[0.32em] text-stone-500", className)} {...props} />;
}

export function PageTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h1 className={cn("mt-3 font-serif text-4xl text-stone-900 sm:text-5xl", className)} {...props} />;
}

export function PageIntro({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-4 text-base text-stone-600", className)} {...props} />;
}
