import { Suspense } from 'react'
import { HistorialVentasTable } from './components/historial-ventas-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getEstadisticasFacturacion } from '@/lib/actions/comprobantes'
import { FileText, CheckCircle, XCircle, Clock } from 'lucide-react'

export const metadata = {
  title: 'Historial de Ventas | Facturación',
  description: 'Libro de control de comprobantes electrónicos'
}

async function EstadisticasFacturacion() {
  const stats = await getEstadisticasFacturacion()

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Boletas Emitidas</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total_boletas}</div>
          <p className="text-xs text-muted-foreground">
            Comprobantes tipo boleta
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Facturas Emitidas</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total_facturas}</div>
          <p className="text-xs text-muted-foreground">
            Comprobantes tipo factura
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pendientes SUNAT</CardTitle>
          <Clock className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">{stats.total_pendientes}</div>
          <p className="text-xs text-muted-foreground">
            Por enviar o confirmar
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monto Total Vendido</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            S/ {stats.monto_total.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground">
            Comprobantes no anulados
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function EstadisticasSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-[60px] mb-2" />
            <Skeleton className="h-3 w-[120px]" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function FacturacionPage() {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Historial de Ventas</h2>
          <p className="text-muted-foreground">
            Libro de control de comprobantes electrónicos (Boletas, Facturas, Notas de Crédito)
          </p>
        </div>
      </div>

      <Suspense fallback={<EstadisticasSkeleton />}>
        <EstadisticasFacturacion />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle>Todos los Comprobantes</CardTitle>
          <CardDescription>
            Listado completo de documentos emitidos con estado SUNAT y contexto de venta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-[400px]" />}>
            <HistorialVentasTable />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
