import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // /mypage routes: require Auth.js session
  if (pathname.startsWith("/mypage")) {
    const session = await auth();
    if (!session?.user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // /admin routes: existing token-based auth
  if (pathname.startsWith("/admin")) {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      return new NextResponse("ADMIN_TOKEN not configured", { status: 500 });
    }

    // Check cookie first
    const cookieToken = request.cookies.get("admin_token")?.value;
    if (cookieToken === adminToken) {
      return NextResponse.next();
    }

    // Check for token in query param (initial login)
    const queryToken = searchParams.get("token");
    if (queryToken === adminToken) {
      const url = request.nextUrl.clone();
      url.searchParams.delete("token");
      const response = NextResponse.rewrite(url);
      response.cookies.set("admin_token", adminToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
      return response;
    }

    return new NextResponse("Unauthorized", { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/mypage/:path*"],
};
