// ── Vitest-Setup: jsdom-Lücken füllen ──────────────────────────────────────
//
// jsdom liefert `Blob`, aber ohne `.stream()`. Node 22 hat das Streams-API
// global, also rüsten wir die fehlende Methode auf der jsdom-Blob-Prototyp-
// Kette nach. Das wird vom Online-Sharing-Crypto-Code (`shareEncryption.ts`)
// gebraucht, der per `Blob → stream → CompressionStream` deflate-raw fährt.
//
// Außerdem: ein paar Browser-APIs, die Komponenten/Hooks zur Render-Zeit
// abfragen (matchMedia, IntersectionObserver, scrollTo) und die jsdom nicht
// mitbringt. Bewusst minimal, kein Polyfill-Paket.

if (typeof Blob !== 'undefined' && typeof Blob.prototype.stream !== 'function') {
  Object.defineProperty(Blob.prototype, 'stream', {
    configurable: true,
    writable: true,
    value: function stream(this: Blob): ReadableStream<Uint8Array> {
      const blob = this
      return new ReadableStream<Uint8Array>({
        async start(controller) {
          const buf = new Uint8Array(await blob.arrayBuffer())
          controller.enqueue(buf)
          controller.close()
        },
      })
    },
  })
}

// matchMedia: useInstallPrompt fragt `(display-mode: standalone)` direkt beim
// Mount ab. Wir liefern einen permanent-„nicht installiert"-Stub.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as MediaQueryList),
  })
}

// IntersectionObserver / ResizeObserver: einige UI-Helfer (z. B. lazy
// Render-Hooks) erwarten die Konstruktoren, brauchen aber kein echtes
// Verhalten – ein No-op-Stub reicht.
class NoopObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): unknown[] { return [] }
}
if (typeof globalThis.IntersectionObserver === 'undefined') {
  ;(globalThis as { IntersectionObserver: unknown }).IntersectionObserver = NoopObserver
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as { ResizeObserver: unknown }).ResizeObserver = NoopObserver
}

// scrollTo / scrollIntoView: einige Views rufen das beim View-Wechsel auf,
// jsdom kennt es nicht. No-op reicht.
if (typeof window !== 'undefined' && typeof window.scrollTo !== 'function') {
  ;(window as { scrollTo: () => void }).scrollTo = () => {}
}
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {}
}
