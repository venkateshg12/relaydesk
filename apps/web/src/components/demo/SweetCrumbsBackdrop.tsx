// The "Sweet Crumbs Bakery" page the widget sits on: a stand-in for a business's own site, drawn with its own
// look (raspberry on blush, a serif) on purpose — it is not RelayDesk's design, so the widget visibly lives on
// someone else's page (DESIGN_SYSTEM §11, Phase 08). Static: nothing here talks to the server.
const BAKERY = {
  brand: "#B8285F",
  paper: "#FFF7F9",
  ink: "#3B1D28",
  border: "#F3D9E2",
};

const PRODUCTS = [
  { name: "Country sourdough", price: "₹280" },
  { name: "Raspberry brioche", price: "₹190" },
  { name: "Dark chocolate fudge", price: "₹950" },
];

export function SweetCrumbsBackdrop() {
  return (
    <div
      className="absolute inset-0 overflow-hidden font-serif"
      style={{ backgroundColor: BAKERY.paper, color: BAKERY.ink }}
      aria-hidden
    >
      <div
        className="flex items-center justify-between border-b px-5 py-3"
        style={{ borderColor: BAKERY.border }}
      >
        <span
          className="text-lg font-bold tracking-tight"
          style={{ color: BAKERY.brand }}
        >
          Sweet Crumbs Bakery
        </span>
        <span className="hidden gap-4 font-sans text-xs font-medium sm:flex">
          <span>Home</span>
          <span>Cakes</span>
          <span>Delivery</span>
        </span>
      </div>

      <div className="space-y-2 px-5 pt-6">
        <h3
          className="text-2xl leading-tight font-bold"
          style={{ color: BAKERY.brand }}
        >
          Freshly baked every dawn.
        </h3>
        <p className="max-w-sm font-sans text-xs opacity-80">
          Slow-fermented sourdough, butter croissants and celebration cakes,
          baked before sunrise.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 px-5 sm:grid-cols-3">
        {PRODUCTS.map((product) => (
          <div
            key={product.name}
            className="rounded-lg border bg-white p-3"
            style={{ borderColor: BAKERY.border }}
          >
            <p className="text-sm font-bold" style={{ color: BAKERY.brand }}>
              {product.name}
            </p>
            <p className="mt-1 font-sans text-xs font-semibold">
              {product.price}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
