import type { MetadataRoute } from "next"

const BASE_URL = "https://jobsilver.com"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/account/",
        "/admin/",
        "/api/",
        "/checkout-redirect",
        "/choose-plan",
        "/control-",
        "/dashboard",
        "/jobs/",
        "/preferences",
        "/profile",
        "/setup",
        "/test/",
        "/tester",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
