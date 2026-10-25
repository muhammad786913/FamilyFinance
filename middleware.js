export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/income/:path*",
    "/expenses/:path*",
    "/plan/:path*",
    "/goals/:path*",
    "/events/:path*",
    "/simulator/:path*",
    "/reports/:path*",
    "/survival/:path*",
    "/settings/:path*",
    "/onboarding/:path*",
  ],
};
