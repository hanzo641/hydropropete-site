import * as React from "react";
import { cn } from "@/lib/utils";

const field =
  "flex w-full rounded-lg border border-input bg-background px-3 text-base shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive sm:text-sm";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input data-slot="input" className={cn(field, "h-10 py-2 file:border-0 file:bg-transparent", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(field, "min-h-28 py-2", className)} {...props} />;
}

export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return <select data-slot="select" className={cn(field, "h-10 py-2 pr-8", className)} {...props} />;
}
