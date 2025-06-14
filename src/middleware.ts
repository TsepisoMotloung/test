import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { UserRole, ApprovalStatus } from "@/types/models";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get the JWT token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Public routes that don't require authentication
  const publicRoutes = [
    "/",
    "/login",
    "/register",
    "/register/agent",
    "/register/employee",
    "/approval",
    "/forgot-password",
    "/reset-password",
    "/map",
    "/rate",
    "/callback",
  ];

  // Public API routes that don't require authentication
  const publicApiRoutes = [
    "/api/public/",
    "/api/agents/nearby", // Make nearby agents API public
    "/api/auth/",
    "/api/users/search",
    "/api/ratings",
    "/api/callbacks",
    "/api/questions",
    "/api/complaints",
    "/api/locations",
    "/api/locations/search",
    "/api/locations/autocomplete",
    "/api/locations/geocode",
    "/api/locations/reverse-geocode",
  ];

  // Check if the path starts with any of the public routes
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // Check if the path starts with any of the public API routes
  const isPublicApiRoute = publicApiRoutes.some((route) =>
    pathname.startsWith(route),
  );

  // Allow access to public assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/fonts") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Allow public routes and public API routes
  if (isPublicRoute || isPublicApiRoute) {
    // If already logged in, redirect from login/register pages
    if (token && (pathname === "/login" || pathname.startsWith("/register"))) {
      // Check approval status first
      if (
        token.role !== UserRole.ADMIN &&
        token.role !== UserRole.USER &&
        token.approvalStatus !== ApprovalStatus.APPROVED
      ) {
        return NextResponse.redirect(new URL("/approval", request.url));
      }
      
      // Redirect to appropriate dashboard based on role
      if (token.role === UserRole.ADMIN) {
        return NextResponse.redirect(new URL("/admin", request.url));
      } else if (token.role === UserRole.AGENT) {
        return NextResponse.redirect(new URL("/agent", request.url));
      } else if (token.role === UserRole.EMPLOYEE) {
        return NextResponse.redirect(new URL("/employee", request.url));
      } else {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }

    return NextResponse.next();
  }

  // Protected routes - require authentication
  if (!token) {
    // Redirect to login page with callback URL
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", encodeURI(request.url));
    return NextResponse.redirect(url);
  }

  // Role-based access control
  const { role, approvalStatus, isActive } = token;

  // Check if account is inactive
  if (!isActive) {
    return NextResponse.redirect(
      new URL("/login?error=Account%20is%20inactive", request.url),
    );
  }

  // Check approval status for agents and employees
  if (
    role !== UserRole.ADMIN &&
    role !== UserRole.USER &&
    approvalStatus !== ApprovalStatus.APPROVED
  ) {
    return NextResponse.redirect(new URL("/approval", request.url));
  }

  // Admin routes
  if (pathname.startsWith("/admin") && role !== UserRole.ADMIN) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Agent routes
  if (pathname.startsWith("/agent") && role !== UserRole.AGENT) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Employee routes
  if (pathname.startsWith("/employee") && role !== UserRole.EMPLOYEE) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Allow authenticated user to proceed
  return NextResponse.next();
}

// Configure matcher for routes to apply middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
