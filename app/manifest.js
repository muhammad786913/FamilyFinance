export default function manifest() {
  return {
    name: "FamilyFinance — Household cash-flow planner",
    short_name: "FamilyFinance",
    description:
      "Plan household income, bills, and savings in PKR. See when cash may run short before the next payday.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait-primary",
    background_color: "#F0F4F8",
    theme_color: "#00A6D6",
    lang: "en-PK",
    dir: "ltr",
    categories: ["finance", "productivity", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Monthly plan", short_name: "Plan", url: "/plan" },
      { name: "Add a bill", short_name: "Expenses", url: "/expenses" },
      { name: "Dashboard", short_name: "Home", url: "/dashboard" },
    ],
  };
}
