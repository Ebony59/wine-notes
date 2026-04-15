import { cloneElement, isValidElement } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-stone-900 text-stone-50 hover:bg-stone-700 border border-stone-900",
  secondary:
    "bg-white text-stone-800 border border-stone-300 hover:border-stone-500 hover:bg-stone-50",
  ghost:
    "bg-transparent text-stone-700 border border-transparent hover:bg-white/70 hover:border-stone-200",
  danger:
    "bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 hover:border-rose-300",
};

export function Button({
  asChild = false,
  children,
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
    variants[variant],
    className
  );

  if (asChild) {
    if (!isValidElement(children)) return null;

    return cloneElement(children, {
      className: cn(classes, children.props.className),
    });
  }

  return (
    <button
      type={type}
      className={classes}
      {...props}
    >
      {children}
    </button>
  );
}
