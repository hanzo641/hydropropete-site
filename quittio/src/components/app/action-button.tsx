"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/app/espace/actions";

/** Bouton qui déclenche une Server Action et annonce le résultat (aria-live). */
export function ActionButton({
  action,
  children,
  confirm,
  variant,
  size = "sm",
  className,
}: {
  action: () => Promise<ActionState>;
  children: React.ReactNode;
  confirm?: string;
  variant?: "default" | "outline" | "ghost" | "secondary" | "destructive";
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => setState(await action()));
        }}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {children}
      </Button>
      <span aria-live="polite" className="text-xs">
        {state?.error ? <span className="text-destructive">{state.error}</span> : state?.message ? <span className="text-success">{state.message}</span> : null}
      </span>
    </span>
  );
}
