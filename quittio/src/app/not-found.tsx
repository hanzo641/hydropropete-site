import Link from "next/link";
import { Header } from "@/components/marketing/header";
import { Footer } from "@/components/marketing/footer";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="contenu" className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <p className="text-sm font-semibold text-primary">Erreur 404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Cette page a déménagé… sans laisser d&apos;adresse</h1>
        <p className="mt-4 max-w-md text-muted-foreground">La page demandée n&apos;existe pas ou plus. Essayez plutôt :</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/">Retour à l&apos;accueil</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/outils/calcul-revision-loyer-irl">Calculateur IRL</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </>
  );
}
