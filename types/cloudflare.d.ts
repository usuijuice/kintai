// Minimal Cloudflare Workers binding types used by this app.
// Replace with `@cloudflare/workers-types` if richer typing is needed.
declare global {
  interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = unknown>(): Promise<T | null>;
    run(): Promise<{ success: boolean; meta: unknown }>;
    all<T = unknown>(): Promise<{ results: T[]; success: boolean; meta: unknown }>;
  }
  interface D1Database {
    prepare(query: string): D1PreparedStatement;
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<{ results: T[] }[]>;
    exec(query: string): Promise<{ count: number; duration: number }>;
  }
}

declare module "cloudflare:workers" {
  export const env: {
    DB: D1Database;
    ASSETS: { fetch(request: Request): Promise<Response> };
  };
}

export {};
