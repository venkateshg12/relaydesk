// Public origins the browser needs, read once. The widget origin serves `loader.js` and the frame; the test
// site is the plain "bakery" page that proves the widget works on a site we don't control.
export const WIDGET_ORIGIN =
  process.env.NEXT_PUBLIC_WIDGET_ORIGIN ?? "http://localhost:5173";
// In production the sample site is served by this app itself, from `public/sample` (a copy of `apps/test-site`), so
// "Open the sample site" needs no extra deployment. Locally it is the standalone site on :5500 (`pnpm --filter test-site serve`).
// Set the variable to point it at a site of your own.
export const TEST_SITE_ORIGIN =
  process.env.NEXT_PUBLIC_TEST_SITE_ORIGIN ??
  (process.env.NODE_ENV === "production" ? "/sample" : "http://localhost:5500");
// Where "View the code" points. No repository is published yet, so without it the button is left out rather
// than linking somewhere that doesn't exist.
export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL;

// The Google OAuth client id. Without it the "Continue with Google" button is not shown.
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
