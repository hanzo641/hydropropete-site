"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <Button variant="ghost" size="icon" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} onClick={() => setOpen((o) => !o)}>
        {open ? <X aria-hidden /> : <Menu aria-hidden />}
      </Button>
      {open ? (
        <nav id="mobile-menu" aria-label="Navigation mobile" className="absolute inset-x-0 top-16 border-b bg-background px-4 pb-6 pt-2 shadow-lg">
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={() => setOpen(false)} className="block rounded-md px-2 py-3 text-base">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button asChild variant="outline">
              <Link href="/connexion" onClick={() => setOpen(false)}>
                Connexion
              </Link>
            </Button>
            <Button asChild>
              <Link href="/inscription" onClick={() => setOpen(false)}>
                Essai gratuit
              </Link>
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
