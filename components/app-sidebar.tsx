'use client'

import * as React from 'react'
import {
  Hotel,
  LayoutDashboard,
  Bed,
  Calendar,
  Users,
  Receipt,
  Settings,
  ChevronRight,
  LogOut,
} from 'lucide-react'

import { NavMain } from '@/components/nav-main'
import { NavUser } from '@/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { logout } from '@/lib/actions/auth'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Datos de navegación
const navItems = [
  {
    title: 'Inicio',
    url: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Habitaciones',
    url: '/habitaciones',
    icon: Bed,
    items: [
      {
        title: 'Todas las habitaciones',
        url: '/habitaciones',
      },
      {
        title: 'Disponibilidad',
        url: '/habitaciones/disponibilidad',
      },
      {
        title: 'Categorías',
        url: '/habitaciones/categorias',
      },
    ],
  },
  {
    title: 'Reservas',
    url: '/reservas',
    icon: Calendar,
    items: [
      {
        title: 'Todas las reservas',
        url: '/reservas',
      },
      {
        title: 'Nueva reserva',
        url: '/reservas/nueva',
      },
      {
        title: 'Estadías activas',
        url: '/reservas/estadias',
      },
    ],
  },
  {
    title: 'Huéspedes',
    url: '/huespedes',
    icon: Users,
  },
  {
    title: 'Facturación',
    url: '/facturacion',
    icon: Receipt,
    items: [
      {
        title: 'Comprobantes',
        url: '/facturacion/comprobantes',
      },
      {
        title: 'Caja',
        url: '/facturacion/caja',
      },
      {
        title: 'Reportes',
        url: '/facturacion/reportes',
      },
    ],
  },
  {
    title: 'Configuración',
    url: '/configuracion',
    icon: Settings,
    items: [
      {
        title: 'General',
        url: '/configuracion/general',
      },
      {
        title: 'Usuarios',
        url: '/configuracion/usuarios',
      },
      {
        title: 'Tarifas',
        url: '/configuracion/tarifas',
      },
      {
        title: 'Series',
        url: '/configuracion/series',
      },
    ],
  },
]

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: {
    nombre_completo: string
    email: string
    rol: 'admin' | 'recepcion' | 'limpieza' | 'contador'
  }
}) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Hotel className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Hotel App</span>
                  <span className="truncate text-xs">Sistema de gestión</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} onLogout={logout} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
