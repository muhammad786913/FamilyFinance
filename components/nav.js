export const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", short: "Home", icon: "dashboard" },
      { href: "/plan", label: "Monthly plan", short: "Plan", icon: "plan" },
      { href: "/reports", label: "Reports", short: "Reports", icon: "reports" },
      { href: "/simulator", label: "What-if simulator", short: "What-if", icon: "simulator" },
    ],
  },
  {
    label: "Money in & out",
    items: [
      { href: "/income", label: "Income", short: "Income", icon: "income" },
      { href: "/expenses", label: "Expenses", short: "Bills", icon: "expenses" },
      { href: "/goals", label: "Savings goals", short: "Goals", icon: "goals" },
      { href: "/events", label: "Special events", short: "Events", icon: "events" },
    ],
  },
  {
    label: "Household",
    items: [
      { href: "/survival", label: "Survival budget", short: "Survival", icon: "survival" },
      { href: "/settings", label: "Settings", short: "Settings", icon: "settings" },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

/** Cheap primary shortcuts for the always-visible mobile side rail. */
export const MOBILE_NAV_HREFS = ["/dashboard", "/plan", "/expenses", "/goals"];

export const MOBILE_NAV_ITEMS = MOBILE_NAV_HREFS.map((href) => NAV_ITEMS.find((item) => item.href === href)).filter(Boolean);

export function isActivePath(path, href) {
  return path === href || (path || "").startsWith(`${href}/`);
}

export function navItemForPath(path) {
  return NAV_ITEMS.find((item) => isActivePath(path, item.href)) || NAV_ITEMS[0];
}
