import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://documind.niranjansah87.com.np";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/$"],
        disallow: [
          "/documents",
          "/documents/*",
          "/evaluation",
          "/login",
          "/api/*",
          "/health",
          "/ready",
          "/metrics",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

