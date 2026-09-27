import type { Metadata } from "next";
import { AuthCard } from "@/components/app/auth-card";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connectez-vous à votre espace propriétaire Quittio.",
  alternates: { canonical: "/connexion" },
  robots: { index: false, follow: true },
};

export default function LoginPage({ searchParams }: PageProps<"/connexion">) {
  return <AuthCard mode="login" searchParams={searchParams as Promise<Record<string, string>>} />;
}
