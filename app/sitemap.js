export default function sitemap() {
  const base = process.env.APP_URL || "http://localhost:3000";
  if (process.env.ALLOW_INDEXING !== "true") return [];
  return ["", "/features", "/help", "/faq", "/privacy", "/terms"].map((path) => ({
    url: `${base}${path || "/"}`,
    changefreq: "monthly",
    priority: path ? 0.6 : 1,
  }));
}
