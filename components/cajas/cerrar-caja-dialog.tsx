'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { cerrarCaja, forzarCierreCaja } from '@/lib/actions/cajas'
import { Lock, Loader2, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  turnoId: string
  totalEsperadoPen: number
  totalEsperadoUsd: number
  esAdmin?: boolean
}

export function CerrarCajaDialog({ turnoId, totalEsperadoPen, totalEsperadoUsd, esAdmin = false }: Props) {
  const [open, setOpen] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    monto_declarado_pen: '',
    monto_declarado_usd: ''
  })
  const router = useRouter()

  const diferenciaPen = formData.monto_declarado_pen 
    ? parseFloat(formData.monto_declarado_pen) - totalEsperadoPen 
    : 0
  
  const diferenciaUsd = formData.monto_declarado_usd
    ? parseFloat(formData.monto_declarado_usd) - totalEsperadoUsd
    : 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setShowConfirm(true)
  }

  const handleConfirm = async () => {
    setLoading(true)
    setShowConfirm(false)

    try {
      const input = {
        turno_id: turnoId,
        monto_declarado_pen: parseFloat(formData.monto_declarado_pen),
        monto_declarado_usd: parseFloat(formData.monto_declarado_usd) || 0
      }

      const result = esAdmin 
        ? await forzarCierreCaja(input)
        : await cerrarCaja(input)

      if (result.success) {
        toast.success('Caja cerrada', {
          description: esAdmin ? 'Cierre forzoso realizado' : 'Tu turno ha finalizado',
        })
        setOpen(false)
        router.refresh()
        if (!esAdmin) {
          router.push('/cajas/historial')
        }
      } else {
        toast.error('Error', {
          description: result.error || 'No se pudo cerrar la caja',
        })
      }
    } catch (error) {
      toast.error('Error', {
        description: 'Ocurrió un error al cerrar la caja',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant={esAdmin ? "destructive" : "default"} className="gap-2">
            <Lock className="h-4 w-4" />
            {esAdmin ? 'Cierre Forzoso' : 'Cerrar Turno'}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{esAdmin ? '⚠️ Cierre Forzoso' : 'Cerrar Turno'}</DialogTitle>
              <DialogDescription>
                {esAdmin 
                  ? 'Vas a cerrar el turno de otro usuario. Cuenta el dinero físico en su caja.'
                  : 'Cuenta el dinero físico en tu caja antes de cerrar.'
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              {/* Soles (PEN) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="declarado_pen">Dinero Contado (PEN) *</Label>
                  <span className="text-sm text-muted-foreground">
                    Esperado: S/ {totalEsperadoPen.toFixed(2)}
                  </span>
                </div>
                <Input
                  id="declarado_pen"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.monto_declarado_pen}
                  onChange={(e) => setFormData({ ...formData, monto_declarado_pen: e.target.value })}
                  required
                  className={
                    formData.monto_declarado_pen && Math.abs(diferenciaPen) > 0.01
                      ? diferenciaPen < 0 
                        ? 'border-red-500 focus-visible:ring-red-500' 
                        : 'border-blue-500 focus-visible:ring-blue-500'
                      : ''
                  }
                />
                {formData.monto_declarado_pen && Math.abs(diferenciaPen) > 0.01 && (
                  <p className={`text-sm font-medium ${diferenciaPen < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    {diferenciaPen < 0 ? '🔴 FALTANTE' : '🔵 SOBRANTE'}: {diferenciaPen >= 0 ? '+' : ''}S/ {diferenciaPen.toFixed(2)}
                  </p>
                )}
              </div>

              {/* Dólares (USD) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="declarado_usd">Dinero Contado (USD)</Label>
                  <span className="text-sm text-muted-foreground">
                    Esperado: $ {totalEsperadoUsd.toFixed(2)}
                  </span>
                </div>
                <Input
                  id="declarado_usd"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.monto_declarado_usd}
                  onChange={(e) => setFormData({ ...formData, monto_declarado_usd: e.target.value })}
                  className={
                    formData.monto_declarado_usd && Math.abs(diferenciaUsd) > 0.01
                      ? diferenciaUsd < 0 
                        ? 'border-red-500 focus-visible:ring-red-500' 
                        : 'border-blue-500 focus-visible:ring-blue-500'
                      : ''
                  }
                />
                {formData.monto_declarado_usd && Math.abs(diferenciaUsd) > 0.01 && (
                  <p className={`text-sm font-medium ${diferenciaUsd < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    {diferenciaUsd < 0 ? '🔴 FALTANTE' : '🔵 SOBRANTE'}: {diferenciaUsd >= 0 ? '+' : ''}$ {diferenciaUsd.toFixed(2)}
                  </p>
                )}
              </div>

              {/* Advertencia si hay diferencia */}
              {Math.abs(diferenciaPen) > 0.01 && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium">Hay una diferencia entre el sistema y lo contado</p>
                      <p className="text-xs mt-1">
                        {diferenciaPen < 0 
                          ? 'Falta dinero en caja. Revisa si olvidaste registrar algún egreso.'
                          : 'Sobra dinero en caja. Revisa si olvidaste registrar algún ingreso.'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                variant={esAdmin ? "destructive" : "default"}
                disabled={loading || !formData.monto_declarado_pen}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cerrando...
                  </>
                ) : (
                  'Cerrar Caja'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar cierre?</AlertDialogTitle>
            <AlertDialogDescription>
              {Math.abs(diferenciaPen) > 0.01 ? (
                <span className="text-yellow-800">
                  ⚠️ Hay una diferencia de <strong>{diferenciaPen >= 0 ? '+' : ''}S/ {diferenciaPen.toFixed(2)}</strong>. 
                  Esta acción no se puede deshacer.
                </span>
              ) : (
                'La caja está cuadrada. ¿Deseas proceder con el cierre?'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirm(false)}>
              Revisar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Confirmar Cierre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
