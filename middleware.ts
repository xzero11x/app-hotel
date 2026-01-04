import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
    // 1. Actualizar sesión de Supabase
    const { response, user } = await updateSession(request)

    // 2. Rutas públicas (no requieren auth)
    const publicPaths = ['/', '/login']
    const isPublicPath = publicPaths.some(path =>
        request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith('/_next')
    )

    // 3. Rutas protegidas (cualquier ruta que no sea pública)
    const isProtectedPath = !isPublicPath

    // 4. Redirigir si no autenticado y trata de acceder ruta protegida
    if (isProtectedPath && !user) {
        const redirectUrl = new URL('/login', request.url)
        redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
        return NextResponse.redirect(redirectUrl)
    }

    // 5. Redirigir a home si autenticado y está en login
    if (user && request.nextUrl.pathname === '/login') {
        return NextResponse.redirect(new URL('/', request.url))
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
