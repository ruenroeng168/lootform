import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin/",
        "/api/",
        "/account",
        "/wallet",
        "/craft",
        "/collection",
        "/profile",
        "/game",
        "/equipment-test",
        "/rank-test",
        "/test",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
