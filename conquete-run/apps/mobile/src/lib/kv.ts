import Storage from 'expo-sqlite/kv-store';

/** Petit magasin clé → valeur synchrone (SQLite sur mobile, localStorage sur le web). */
export const kv = {
  getItem: (k: string): string | null => Storage.getItemSync(k),
  setItem: (k: string, v: string): void => Storage.setItemSync(k, v),
  removeItem: (k: string): void => {
    Storage.removeItemSync(k);
  },
};
