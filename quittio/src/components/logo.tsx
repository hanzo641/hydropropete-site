import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <defs>
        <linearGradient id="qg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.62 0.2 280)" />
          <stop offset="1" stopColor="oklch(0.45 0.22 268)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#qg)" />
      <path d="M9 15.5 16 9.5l7 6V23a1 1 0 0 1-1 1h-4.5v-4.5h-3V24H10a1 1 0 0 1-1-1z" fill="#fff" />
      <path d="m19.2 21.4 1.9 1.9 3.6-3.8" fill="none" stroke="oklch(0.85 0.15 160)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span className="text-lg">Quittio</span>
    </span>
  );
}
