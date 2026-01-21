import { Suspense } from 'react'
import { DashboardHeader } from '@/components/dashboard-header'
import { HistorialCierresClient } from './historial-cierres-client'

export default function HistorialCierresPage() {
  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          { label: 'Inicio', href: '/' },
          { label: 'Cajas' },
          { label: 'Retiros Administrativos' }
        ]}
      />
      
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold">Retiros Administrativos</h1>
          <p className="text-muted-foreground">
            Consulta todos los cierres de caja y su estado de cuadre
          </p>
        </div>

        <Suspense fallback={<div>Cargando historial...</div>}>
          <HistorialCierresClient />
        </Suspense>
      </div>
    </>
  )
}
