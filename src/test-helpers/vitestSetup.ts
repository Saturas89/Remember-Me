// ── Vitest-Setup: jsdom-Lücken füllen ──────────────────────────────────────
//
// jsdom liefert `Blob`, aber ohne `.stream()`. Node 22 hat das Streams-API
// global, also rüsten wir die fehlende Methode auf der jsdom-Blob-Prototyp-
// Kette nach. Das wird vom Online-Sharing-Crypto-Code (`shareEncryption.ts`)
// gebraucht, der per `Blob → stream → CompressionStream` deflate-raw fährt.
//
// Bewusst minimal: nur die eine Methode, keine Polyfill-Bibliothek.

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
