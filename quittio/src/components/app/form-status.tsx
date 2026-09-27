"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/app/espace/actions";

export function SubmitButton({ children, variant, className }: { children: React.ReactNode; variant?: "default" | "outline" | "destructive"; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant} className={className}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {children}
    </Button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  return (
    <p aria-live="polite" role="status" className="min-h-5 text-sm">
      {state?.error ? <span className="text-destructive">{state.error}</span> : state?.message ? <span className="text-success">{state.message}</span> : null}
    </p>
  );
}
