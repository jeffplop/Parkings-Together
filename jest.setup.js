// Jest setup: polyfill WebSocket for Node < 22 environments.
// @supabase/realtime-js requires either native WebSocket (Node 22+) or a manual
// transport. In CI/test environments the global may be missing — provide a stub
// so module-level createClient() calls don't throw during test collection.
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class MockWebSocket {
    constructor() {
      this.readyState = 3; // CLOSED
    }
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return true; }
  };
}
