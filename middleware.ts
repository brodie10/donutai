import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from './lib/auth';

export async function middleware(req: NextRequest) {
    const publicPaths = ['/login', '/api/auth/login', '/api/auth/register', '/favicon.ico'];
    const isPublic = publicPaths.includes(req.nextUrl.pathname);

    if (isPublic) {
        return NextResponse.next();
    }

    const userId = await verifySession();
    if (!userId) {
        return NextResponse.redirect(new URL('/login', req.url));
    }

    // Set userId in header for API routes to use easily
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', userId);

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - public (public folder)
         */
        '/((?!_next/static|_next/image|public).*)',
    ],
};
