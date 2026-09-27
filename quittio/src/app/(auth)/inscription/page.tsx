import type { Metadata } from "next";
import { AuthCard } from "@/components/app/auth-card";

export const metadata: Metadata = {
  title: "Essai gratuit de 14 jours",
  description: "Créez votre compte Quittio et automatisez vos quittances de loyer. 14 jours gratuits, sans engagement.",
  alternates: { canonical: "/inscription" },
};

export default function SignupPage({ searchParams }: PageProps<"/inscription">) {
  return <AuthCard mode="signup" searchParams={searchParams as Promise<Record<string, string>>} />;
}
