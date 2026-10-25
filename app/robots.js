export default function robots() {
  const allow = process.env.ALLOW_INDEXING === "true";
  const base = process.env.APP_URL || "http://localhost:3000";
  if (!allow) {
    return { rules: { userAgent: "*", disallow: "/" }, sitemap: undefined };
  }
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/dashboard", "/income", "/expenses", "/plan", "/goals", "/events", "/simulator", "/reports", "/survival", "/settings", "/onboarding", "/api"] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
