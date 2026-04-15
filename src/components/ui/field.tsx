import { cn } from "@/lib/utils";

type FieldProps = React.HTMLAttributes<HTMLDivElement>;

export function Field({ className, ...props }: FieldProps) {
  return <div className={cn("text-sm", className)} {...props} />;
}

type FieldLabelProps = React.HTMLAttributes<HTMLDivElement>;

export function FieldLabel({ className, ...props }: FieldLabelProps) {
  return <div className={cn("mb-2 font-medium text-stone-800", className)} {...props} />;
}

export function FieldHint({ className, ...props }: FieldLabelProps) {
  return <div className={cn("mt-2 text-xs text-stone-500", className)} {...props} />;
}
