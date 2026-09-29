/** Version web (aperçu, captures) : localStorage du navigateur. */
export const kv = {
  getItem: (k: string): string | null => globalThis.localStorage?.getItem(k) ?? null,
  setItem: (k: string, v: string): void => globalThis.localStorage?.setItem(k, v),
  removeItem: (k: string): void => globalThis.localStorage?.removeItem(k),
};
