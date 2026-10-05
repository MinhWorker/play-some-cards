/** Games can log without Node/DOM types; the dev server captures these synchronous methods. */
declare global {
  interface Console {
    log(...data: unknown[]): void;
    info(...data: unknown[]): void;
    warn(...data: unknown[]): void;
    error(...data: unknown[]): void;
  }
  var console: Console;
}

export {};
