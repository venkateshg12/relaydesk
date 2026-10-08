// Public origins the browser needs, read once. The widget origin serves `loader.js` and the frame; the test
// site is the plain "bakery" page that proves the widget works on a site we don't control.
export const WIDGET_ORIGIN =
  process.env.NEXT_PUBLIC_WIDGET_ORIGIN ?? "http://localhost:5173";
export const TEST_SITE_ORIGIN =
  process.env.NEXT_PUBLIC_TEST_SITE_ORIGIN ?? "http://localhost:5500";
// Where "View the code" points. No repository is published yet, so without it the button is left out rather
// than linking somewhere that doesn't exist.
export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL;

// The Google OAuth client id. Without it the "Continue with Google" button is not shown.
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
