declare namespace NodeJS {
  interface ProcessEnv {
    /** Server-only preferred; used by login + proxy routes. */
    API_URL?: string;
    NEXT_PUBLIC_API_URL?: string;
    /** Must match the Learning Analytics API `JWT_SECRET` for cookie sessions. */
    JWT_SECRET?: string;
    /** Default cookie session; use `localStorage` to call the API directly then sync session. */
    NEXT_PUBLIC_AUTH_STRATEGY?: string;
  }
}
