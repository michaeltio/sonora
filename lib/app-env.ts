// App environment flag.
// NEXT_PUBLIC_APP_ENV (set in .env.local / Vercel env) takes precedence so the
// app can be forced into production behaviour locally. Falls back to NODE_ENV,
// which Next.js sets automatically ("production" for build/start, "development" for dev).
export const isProduction: boolean = process.env.NEXT_PUBLIC_APP_ENV
  ? process.env.NEXT_PUBLIC_APP_ENV === "production"
  : process.env.NODE_ENV === "production";
