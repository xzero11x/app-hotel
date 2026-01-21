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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { cerrarCaja, forzarCierreCaja } from '@/lib/actions/cajas'
import { Lock, Loader2, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTurnoContext } from '@/components/providers/turno-provider'

interface Props {
  turnoId: string
  totalEsperadoPen: number
  totalEsperadoUsd: number
  esAdmin?: boolean
  customTrigger?: React.ReactNode
}

// Denominaciones de billetes y monedas
const DENOMINACIONES_PEN = [200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10]
const DENOMINACIONES_USD = [100, 50, 20, 10, 5, 1]

export function CerrarCajaDialog({ turnoId, totalEsperadoPen, totalEsperadoUsd, esAdmin = false, customTrigger }: Props) {
  const [open, setOpen] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  // Contadores de billetes/monedas
  const [desglosePEN, setDesglosePEN] = useState<Record<number, number>>({})
  const [desgloseUSD, setDesgloseUSD] = useState<Record<number, number>>({})

  // Montos declarados directos (alternativa al desglose)
  const [montoDirectoPen, setMontoDirectoPen] = useState('')
  const [montoDirectoUsd, setMontoDirectoUsd] = useState('')
  const [usarDesglose, setUsarDesglose] = useState(true)

  const router = useRouter()
  const { refetchTurno } = useTurnoContext()

  // Calcular total del desglose
  const calcularTotalDesglose = (desglose: Record<number, number>) => {
    return Object.entries(desglose).reduce((sum, [denom, cantidad]) => {
      return sum + (parseFloat(denom) * (cantidad || 0))
    }, 0)
  }

  const totalDesglosePEN = calcularTotalDesglose(desglosePEN)
  const totalDesgloseUSD = calcularTotalDesglose(desgloseUSD)

  // Monto final declarado
  const montoDeclaradoPen = usarDesglose ? totalDesglosePEN : (parseFloat(montoDirectoPen) || 0)
  const montoDeclaradoUsd = usarDesglose ? totalDesgloseUSD : (parseFloat(montoDirectoUsd) || 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (montoDeclaradoPen === 0 && !montoDirectoPen && Object.keys(desglosePEN).length === 0) {
      toast.error('Debes declarar el monto contado')
      return
    }
    setShowConfirm(true)
  }

  const handleConfirm = async () => {
    setLoading(true)
    setShowConfirm(false)

    try {
      const input = {
        turno_id: turnoId,
        monto_declarado_pen: montoDeclaradoPen,
        monto_declarado_usd: montoDeclaradoUsd
      }

      const result = esAdmin
        ? await forzarCierreCaja(input)
        : await cerrarCaja(input)

      if (result.success) {
        // CIERRE CIEGO: Solo mensaje genérico, SIN mostrar diferencias
        toast.success('Turno cerrado correctamente', {
          description: 'El arqueo ha sido registrado.',
        })
        setOpen(false)
        await refetchTurno()
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

  const resetForm = () => {
    setDesglosePEN({})
    setDesgloseUSD({})
    setMontoDirectoPen('')
    setMontoDirectoUsd('')
    setUsarDesglose(true)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen)
        if (!isOpen) resetForm()
      }}>
        <DialogTrigger asChild>
          {customTrigger || (
            <Button variant={esAdmin ? "destructive" : "default"} className="gap-2">
              <Lock className="h-4 w-4" />
              {esAdmin ? 'Cierre Forzoso' : 'Cerrar Turno'}
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-orange-500" />
                {esAdmin ? '⚠️ Cierre Forzoso' : 'Cierre de Caja'}
              </DialogTitle>
              <DialogDescription>
                Cuenta el dinero físico en tu caja y declara el monto total.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Selector de método */}
              <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
                <span className="text-sm font-medium">Método de conteo:</span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={usarDesglose ? "default" : "outline"}
                    onClick={() => setUsarDesglose(true)}
                  >
                    Calculadora
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={!usarDesglose ? "default" : "outline"}
                    onClick={() => setUsarDesglose(false)}
                  >
                    Monto Directo
                  </Button>
                </div>
              </div>

              {usarDesglose ? (
                /* Calculadora de billetes */
                <Tabs defaultValue="pen" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="pen">🇵🇪 Soles (PEN)</TabsTrigger>
                    <TabsTrigger value="usd">🇺🇸 Dólares (USD)</TabsTrigger>
                  </TabsList>

                  {/* Tab Soles */}
                  <TabsContent value="pen" className="space-y-4">
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Cuenta tus billetes y monedas</p>
                        <p className="text-lg font-bold text-primary">
                          Total: S/ {totalDesglosePEN.toFixed(2)}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {DENOMINACIONES_PEN.map((denom) => (
                          <div key={denom} className="flex items-center gap-2">
                            <Label className="w-16 text-xs font-medium">S/ {denom}</Label>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={desglosePEN[denom] || ''}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0
                                setDesglosePEN(prev => ({ ...prev, [denom]: val }))
                              }}
                              className="text-xs h-8 w-16"
                              placeholder="0"
                              disabled={loading}
                            />
                            <span className="text-xs text-muted-foreground w-20 text-right">
                              = S/ {((desglosePEN[denom] || 0) * denom).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tab Dólares */}
                  <TabsContent value="usd" className="space-y-4">
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Cuenta tus billetes</p>
                        <p className="text-lg font-bold text-primary">
                          Total: $ {totalDesgloseUSD.toFixed(2)}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {DENOMINACIONES_USD.map((denom) => (
                          <div key={denom} className="flex items-center gap-2">
                            <Label className="w-16 text-xs font-medium">$ {denom}</Label>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={desgloseUSD[denom] || ''}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0
                                setDesgloseUSD(prev => ({ ...prev, [denom]: val }))
                              }}
                              className="text-xs h-8 w-16"
                              placeholder="0"
                              disabled={loading}
                            />
                            <span className="text-xs text-muted-foreground w-20 text-right">
                              = $ {((desgloseUSD[denom] || 0) * denom).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                /* Monto directo */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="monto_pen">Dinero Contado (Soles) *</Label>
                    <Input
                      id="monto_pen"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={montoDirectoPen}
                      onChange={(e) => setMontoDirectoPen(e.target.value)}
                      disabled={loading}
                      className="text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monto_usd">Dinero Contado (Dólares)</Label>
                    <Input
                      id="monto_usd"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={montoDirectoUsd}
                      onChange={(e) => setMontoDirectoUsd(e.target.value)}
                      disabled={loading}
                      className="text-lg"
                    />
                  </div>
                </div>
              )}

              {/* Resumen de lo declarado */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Monto a declarar:</p>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-2xl font-bold">S/ {montoDeclaradoPen.toFixed(2)}</p>
                    {montoDeclaradoUsd > 0 && (
                      <p className="text-lg text-muted-foreground">$ {montoDeclaradoUsd.toFixed(2)}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button
                type="submit"
                variant={esAdmin ? "destructive" : "default"}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cerrando...
                  </>
                ) : (
                  'Cerrar Turno'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmación simple sin revelar diferencias */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar cierre de turno?</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>Vas a cerrar tu turno declarando:</p>
                <p className="font-bold text-lg">S/ {montoDeclaradoPen.toFixed(2)}</p>
                {montoDeclaradoUsd > 0 && (
                  <p className="font-bold">$ {montoDeclaradoUsd.toFixed(2)}</p>
                )}
                <p className="text-sm text-muted-foreground mt-2">Esta acción no se puede deshacer.</p>
              </div>
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
