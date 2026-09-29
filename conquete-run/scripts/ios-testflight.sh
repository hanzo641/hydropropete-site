#!/usr/bin/env bash
# Build iOS sur EAS (Mac dans le cloud d'Expo) puis envoi sur TestFlight, sans interaction.
# À lancer depuis conquete-run/ :  bash scripts/ios-testflight.sh
#
# Variables d'environnement (jamais dans le dépôt) :
#   EXPO_TOKEN            jeton d'accès Expo (expo.dev → Account settings → Access tokens)
#   EXPO_ASC_KEY_ID       identifiant de la clé API App Store Connect (ex. SFB993FB5F)
#   EXPO_ASC_ISSUER_ID    identifiant d'émetteur (App Store Connect → Utilisateurs et accès → Intégrations)
#   EXPO_ASC_API_KEY_P8   contenu du fichier AuthKey_XXXXXXXXXX.p8 (retours à la ligne facultatifs)
#   EXPO_APPLE_TEAM_ID    identifiant d'équipe Apple (10 caractères, developer.apple.com → Membership)
#   EXPO_APPLE_TEAM_TYPE  INDIVIDUAL ou COMPANY_OR_ORGANIZATION
#   ASC_APP_ID            « Apple ID » numérique de l'app créée dans App Store Connect
set -euo pipefail
cd "$(dirname "$0")/../apps/mobile"

missing=()
for v in EXPO_TOKEN EXPO_ASC_KEY_ID EXPO_ASC_ISSUER_ID EXPO_ASC_API_KEY_P8 EXPO_APPLE_TEAM_ID EXPO_APPLE_TEAM_TYPE ASC_APP_ID; do
  [ -n "${!v:-}" ] || missing+=("$v")
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "Variables manquantes : ${missing[*]}" >&2
  exit 1
fi

tmp="$(mktemp -d)"
cp eas.json "$tmp/eas.json.bak"
cleanup() { cp "$tmp/eas.json.bak" eas.json; rm -rf "$tmp"; }
trap cleanup EXIT

# Clé .p8 : on reconstitue le PEM même si les retours à la ligne ont été perdus au collage.
body="$(printf '%s' "$EXPO_ASC_API_KEY_P8" | sed -e 's/-----BEGIN PRIVATE KEY-----//' -e 's/-----END PRIVATE KEY-----//' | tr -d ' \n\r\t')"
{
  echo '-----BEGIN PRIVATE KEY-----'
  printf '%s\n' "$body" | fold -w 64
  echo '-----END PRIVATE KEY-----'
} > "$tmp/AuthKey_$EXPO_ASC_KEY_ID.p8"
export EXPO_ASC_API_KEY_PATH="$tmp/AuthKey_$EXPO_ASC_KEY_ID.p8"

EAS="npx -y eas-cli@latest"
$EAS whoami

# Projet EAS : écrit owner + projectId dans app.json (à committer ensuite).
if ! node -e "process.exit(require('./app.json').expo.extra?.eas?.projectId ? 0 : 1)"; then
  $EAS init --non-interactive --force
fi

# Profil d'envoi TestFlight injecté le temps de la commande (eas.json est restauré à la fin).
node -e "
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
j.submit.production.ios = {
  ascAppId: process.env.ASC_APP_ID,
  ascApiKeyPath: process.env.EXPO_ASC_API_KEY_PATH,
  ascApiKeyIssuerId: process.env.EXPO_ASC_ISSUER_ID,
  ascApiKeyId: process.env.EXPO_ASC_KEY_ID,
};
fs.writeFileSync('eas.json', JSON.stringify(j, null, 2) + '\n');
"

$EAS build --platform ios --profile production --non-interactive --auto-submit \
  --what-to-test "Mode solo : choisis ton camp, cours, déploie tes troupes, reviens le lendemain."
