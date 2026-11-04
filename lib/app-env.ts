export const isProduction: boolean = process.env.NEXT_PUBLIC_APP_ENV
  ? process.env.NEXT_PUBLIC_APP_ENV === "production"
  : process.env.NODE_ENV === "production";
