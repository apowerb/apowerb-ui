import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.js");

/** @type {import('next').NextConfig} */
const backendUrl = process.env.API_URL || "http://localhost:8000";

const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=()",
          },
        ],
      },
    ];
  },
  async rewrites() {
    // Last-resort proxy, for `/api` paths no route handler claims.
    //
    // It MUST stay in `fallback`. Returning a bare array makes it an
    // `afterFiles` rewrite, and `afterFiles` is checked before dynamic routes:
    // every dynamic handler was shadowed by this rewrite. Since `output:
    // "standalone"` freezes `destination` at build time, the deployed front
    // proxied `/api/users/me` to `localhost:8000` -- its own container -- and
    // answered 500, so nobody could log in. Static handlers such as
    // `/api/agents` were matched first and worked, which made the breakage look
    // random. `fallback` runs after every route, so the handlers win.
    return {
      fallback: [
        {
          source: "/api/:path*",
          destination: `${backendUrl}/api/:path*`,
        },
      ],
    };
  },
};

export default withNextIntl(nextConfig);
