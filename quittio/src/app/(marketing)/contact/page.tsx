import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { ContactForm } from "@/components/marketing/contact-form";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Une question sur Quittio, la gestion de vos loyers ou votre abonnement ? Écrivez-nous, réponse sous 24 h ouvrées.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contact" title="Parlons de vos locations" intro="Une question avant de vous lancer, un souci technique ou une idée ? Nous répondons nous-mêmes, sous 24 h ouvrées." />
      <section className="py-16">
        <div className="container-page grid max-w-5xl gap-10 lg:grid-cols-[1fr_2fr]">
          <div className="space-y-4">
            <p className="flex items-center gap-2 font-medium">
              <Mail className="size-5 text-primary" aria-hidden /> Par e-mail
            </p>
            <a href={`mailto:${site.supportEmail}`} className="text-lg underline underline-offset-4">
              {site.supportEmail}
            </a>
            <p className="text-sm text-muted-foreground">Abonné ? Précisez l&apos;e-mail de votre compte pour une réponse plus rapide.</p>
          </div>
          <div className="rounded-2xl border bg-card p-6 sm:p-8">
            <ContactForm />
          </div>
        </div>
      </section>
    </>
  );
}
