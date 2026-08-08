import type { MetadataRoute } from "next";

const routes = ["", "/demo", "/pricing", "/contact", "/privacy", "/terms", "/faq"];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.vireqo.in";
  const now = new Date();
  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
