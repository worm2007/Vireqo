import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/demo", "/pricing", "/contact", "/privacy", "/terms", "/faq"],
      disallow: ["/dashboard", "/login", "/signup", "/reset-password", "/forgot-password", "/verify-email"],
    },
    sitemap: "https://www.vireqo.in/sitemap.xml",
  };
}
