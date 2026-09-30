/**
 * h3-js (moteur des hexagones) crée au chargement un `new TextDecoder('utf-16le')`.
 * Le TextDecoder d'Expo sur iOS/Android ne connaît que l'UTF-8 et lève une RangeError :
 * l'app plantait dès l'ouverture. On ajoute un décodeur UTF-16LE minimal, le reste
 * est délégué au décodeur d'origine. Doit être chargé avant tout import de h3-js.
 */
type Decoder = { decode(input?: ArrayBuffer | ArrayBufferView): string };

class Utf16LeDecoder implements Decoder {
  readonly encoding = 'utf-16le';
  decode(input?: ArrayBuffer | ArrayBufferView): string {
    if (!input) return '';
    const bytes = ArrayBuffer.isView(input)
      ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
      : new Uint8Array(input);
    let out = '';
    for (let i = 0; i + 1 < bytes.length; i += 2) out += String.fromCharCode((bytes[i] ?? 0) | ((bytes[i + 1] ?? 0) << 8));
    return out;
  }
}

const Native = (globalThis as { TextDecoder?: new (label?: string, options?: object) => Decoder }).TextDecoder;

function supportsUtf16(): boolean {
  try {
    new Native!('utf-16le');
    return true;
  } catch {
    return false;
  }
}

if (Native && !supportsUtf16()) {
  function TextDecoder(label?: string, options?: object): Decoder {
    const name = String(label ?? 'utf-8').trim().toLowerCase();
    if (name === 'utf-16le' || name === 'utf-16') return new Utf16LeDecoder();
    return new Native!(label, options);
  }
  TextDecoder.prototype = Native.prototype;
  Object.defineProperty(globalThis, 'TextDecoder', { value: TextDecoder, writable: true, configurable: true });
}

export {};
