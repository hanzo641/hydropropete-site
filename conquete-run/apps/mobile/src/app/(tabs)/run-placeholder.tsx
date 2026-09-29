import { Redirect } from 'expo-router';

/** Onglet central : le bouton ouvre l'écran de course en plein écran. */
export default function RunPlaceholder() {
  return <Redirect href="/run" />;
}
