import { Suspense } from 'react'
import { CajasClient } from './cajas-client'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardHeader } from '@/components/dashboard-header'

export default function CajasPage() {
  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          { label: 'Inicio', href: '/' },
          { label: 'Configuración', href: '/configuracion' },
          { label: 'Cajas' }
        ]}
      />
      
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Cajas</h2>
        </div>
        
        <Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
          <CajasClient />
        </Suspense>
      </div>
    </>
  )
}
