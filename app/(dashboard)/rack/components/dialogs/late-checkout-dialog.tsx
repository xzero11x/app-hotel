'use client'

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Clock, CreditCard, Loader2, AlertCircle, CalendarPlus } from 'lucide-react'
import {
    calcularLateCheckout,
    extenderEstadia
} from '@/lib/actions/estadias'
import { OPCIONES_LATE_CHECKOUT } from '@/lib/constants/late-checkout'
import { cobrarYFacturar } from '@/lib/actions/pagos'
import { format, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    reserva: {
        id: string
        habitacion_id: string
        habitacion_numero: string
        precio_pactado: number
        fecha_salida: string
        titular_nombre: string
        titular_tipo_doc: string
        titular_numero_doc: string
    }
    onSuccess?: () => void
}

export function LateCheckoutDialog({ open, onOpenChange, reserva, onSuccess }: Props) {
    const [horasSeleccionadas, setHorasSeleccionadas] = useState<number>(3)
    const [calculando, setCalculando] = useState(false)
    const [procesando, setProcesando] = useState(false)
    const [serie, setSerie] = useState<string>('')
    const [resultado, setResultado] = useState<{
        montoACobrar: number
        porcentaje: number
        descripcionComprobante: string
        esDiaCompleto: boolean
    } | null>(null)

    // Cargar serie de boleta al abrir
    useEffect(() => {
        if (open) {
            loadSerie()
        }
    }, [open])

    async function loadSerie() {
        try {
            const { getSeriesDisponibles } = await import('@/lib/actions/comprobantes')
            const series = await getSeriesDisponibles('BOLETA')
            if (series.length > 0) {
                setSerie(series[0].serie)
            } else {
                setSerie('')
            }
        } catch (error) {
            console.error('Error cargando serie:', error)
        }
    }

    // Calcular monto cuando cambia la selección
    useEffect(() => {
        if (open && horasSeleccionadas) {
            calcularMonto()
        }
    }, [open, horasSeleccionadas])

    async function calcularMonto() {
        setCalculando(true)
        try {
            const result = await calcularLateCheckout(reserva.id, horasSeleccionadas)
            if (result.success) {
                setResultado({
                    montoACobrar: result.montoACobrar!,
                    porcentaje: result.porcentaje!,
                    descripcionComprobante: result.descripcionComprobante!,
                    esDiaCompleto: result.esDiaCompleto!
                })
            } else {
                toast.error('Error al calcular', { description: result.error })
            }
        } catch (error) {
            console.error('Error calculando late checkout:', error)
        } finally {
            setCalculando(false)
        }
    }

    async function handleConfirmar() {
        if (!resultado) return

        setProcesando(true)
        try {
            // Si es día completo, primero extender la estadía
            if (resultado.esDiaCompleto) {
                const nuevaFecha = format(
                    addDays(new Date(reserva.fecha_salida), 1),
                    'yyyy-MM-dd'
                )
                const extResult = await extenderEstadia(reserva.id, nuevaFecha)
                if (!extResult.success) {
                    toast.error('Error al extender estadía', { description: extResult.error })
                    setProcesando(false)
                    return
                }
            }

            // Validar que hay serie disponible
            if (!serie) {
                toast.error('No hay series de boleta configuradas. Verifique Configuración > Cajas')
                setProcesando(false)
                return
            }

            // Cobrar y facturar
            const cobroResult = await cobrarYFacturar({
                reserva_id: reserva.id,
                metodo_pago: 'EFECTIVO',
                monto: resultado.montoACobrar,
                moneda: 'PEN',
                tipo_comprobante: 'BOLETA',
                serie: serie,
                cliente_tipo_doc: reserva.titular_tipo_doc === 'RUC' ? '6' : '1',
                cliente_numero_doc: reserva.titular_numero_doc,
                cliente_nombre: reserva.titular_nombre,
                items: [{
                    descripcion: resultado.descripcionComprobante,
                    cantidad: 1,
                    precio_unitario: resultado.montoACobrar,
                    subtotal: resultado.montoACobrar
                }]
            })

            if (cobroResult.success) {
                toast.success(resultado.esDiaCompleto ? 'Extensión registrada' : 'Late checkout cobrado', {
                    description: `S/ ${resultado.montoACobrar.toFixed(2)} cobrado correctamente`
                })
                onOpenChange(false)
                onSuccess?.()
            } else {
                toast.error('Error al cobrar', { description: cobroResult.error })
            }
        } catch (error) {
            console.error('Error procesando late checkout:', error)
            toast.error('Error inesperado')
        } finally {
            setProcesando(false)
        }
    }

    const opcionActual = OPCIONES_LATE_CHECKOUT.find(o => o.horas === horasSeleccionadas)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-amber-500" />
                        Late Check-out
                    </DialogTitle>
                    <DialogDescription>
                        Habitación {reserva.habitacion_numero} • Checkout actual: {format(new Date(reserva.fecha_salida), 'dd MMM', { locale: es })} 12:00 PM
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Selector de horas */}
                    <div className="space-y-2">
                        <Label>Tiempo adicional</Label>
                        <Select
                            value={horasSeleccionadas.toString()}
                            onValueChange={(v) => setHorasSeleccionadas(Number(v))}
                            disabled={procesando}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {OPCIONES_LATE_CHECKOUT.map((opcion) => (
                                    <SelectItem key={opcion.horas} value={opcion.horas.toString()}>
                                        {opcion.descripcion}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Alerta si es día completo */}
                    {resultado?.esDiaCompleto && (
                        <Alert>
                            <CalendarPlus className="h-4 w-4" />
                            <AlertDescription>
                                Esto extenderá la estadía 1 noche adicional (fecha salida: {format(addDays(new Date(reserva.fecha_salida), 1), 'dd MMM yyyy', { locale: es })})
                            </AlertDescription>
                        </Alert>
                    )}

                    <Separator />

                    {/* Resumen de cobro */}
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-muted-foreground">
                            <span>Precio por noche</span>
                            <span>S/ {reserva.precio_pactado.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                            <span>Porcentaje aplicado</span>
                            <span>{opcionActual?.porcentaje || 0}%</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-semibold text-lg">
                            <span>Monto a cobrar</span>
                            {calculando ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <span className="text-green-600">S/ {resultado?.montoACobrar.toFixed(2) || '0.00'}</span>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={procesando}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirmar}
                        disabled={procesando || calculando || !resultado}
                    >
                        {procesando ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <CreditCard className="h-4 w-4 mr-2" />
                                Cobrar S/ {resultado?.montoACobrar.toFixed(2) || '0.00'}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
