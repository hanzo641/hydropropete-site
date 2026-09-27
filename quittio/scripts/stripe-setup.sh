#!/usr/bin/env bash
# Crée les 3 produits et 6 prix Quittio dans Stripe (mode test par défaut) via la Stripe CLI.
# Usage : stripe login && ./scripts/stripe-setup.sh   (ajoutez --live aux commandes pour la production)
# Affiche les lignes à copier dans .env.local / Vercel.
set -euo pipefail

id_of() { grep -m1 '"id"' | cut -d'"' -f4; }

create() { # $1=clé $2=nom $3=prix mensuel (centimes) $4=prix annuel (centimes)
  local product monthly yearly up
  product=$(stripe products create --name="Quittio $2" --description="Abonnement Quittio, formule $2" -d "metadata[plan]=$1" | id_of)
  monthly=$(stripe prices create --product="$product" --currency=eur --unit-amount="$3" -d "recurring[interval]=month" -d "tax_behavior=inclusive" -d "lookup_key=${1}_monthly" | id_of)
  yearly=$(stripe prices create --product="$product" --currency=eur --unit-amount="$4" -d "recurring[interval]=year" -d "tax_behavior=inclusive" -d "lookup_key=${1}_yearly" | id_of)
  up=$(echo "$1" | tr '[:lower:]' '[:upper:]')
  echo "STRIPE_PRICE_${up}_MONTHLY=$monthly"
  echo "STRIPE_PRICE_${up}_YEARLY=$yearly"
}

create essentiel "Essentiel" 490 4900
create serenite "Sérénité" 990 9900
create patrimoine "Patrimoine" 1990 19900
