const GSI_SRC = "https://accounts.google.com/gsi/client";

let gsiPromise: Promise<void> | null = null;

// Loads Google Identity Services once, on demand. (The e-commerce app has the tag in `index.html`; a Next.js
// app has no such file, and only the pages with a Google button should pay for the script.)
export function loadGoogleSdk(): Promise<void> {
  if (gsiPromise) return gsiPromise;

  gsiPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();

    const script = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`) ?? document.createElement("script");
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => {
      gsiPromise = null; // let the next mount try again
      reject(new Error("Failed to load Google Identity Services"));
    });

    if (!script.src) {
      script.src = GSI_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return gsiPromise;
}
