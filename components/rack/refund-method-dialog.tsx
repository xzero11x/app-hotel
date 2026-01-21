'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Banknote, CreditCard, Wallet, AlertTriangle, Loader2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export type MetodoDevolucion = 'EFECTIVO' | 'METODO_ORIGINAL'

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    monto: number
    moneda: 'PEN' | 'USD'
    metodoPagoOriginal?: string // Cómo pagó el huésped
    efectivoDisponible: number // En caja actual (en PEN)
    onConfirm: (metodo: MetodoDevolucion) => void
    loading?: boolean
}

const METODOS = [
    {
        id: 'EFECTIVO' as MetodoDevolucion,
        label: 'Devolución en Efectivo',
        description: 'Se descuenta de la caja física inmediatamente',
        icon: Banknote,
        color: 'text-green-600',
    },
    {
        id: 'METODO_ORIGINAL' as MetodoDevolucion,
        label: 'Devolución al Método Original',
        description: 'Se devuelve al mismo medio con que pagó (tarjeta/transferencia)',
        icon: CreditCard,
        color: 'text-blue-600',
    },
]

export function RefundMethodDialog({
    open,
    onOpenChange,
    monto,
    moneda,
    metodoPagoOriginal,
    efectivoDisponible,
    onConfirm,
    loading = false,
}: Props) {
    const [metodoSeleccionado, setMetodoSeleccionado] = useState<MetodoDevolucion>('EFECTIVO')

    const simboloMoneda = moneda === 'USD' ? '$' : 'S/'
    const hayEfectivoSuficiente = efectivoDisponible >= monto
    const metodoOriginalEsEfectivo = metodoPagoOriginal === 'EFECTIVO'

    // Si el método original fue efectivo y no hay suficiente, deshabilitar esa opción
    const efectivoDeshabilitado = !hayEfectivoSuficiente

    const handleConfirm = () => {
        onConfirm(metodoSeleccionado)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Banknote className="h-5 w-5 text-amber-500" />
                        Método de Devolución
                    </DialogTitle>
                    <DialogDescription>
                        ¿Cómo desea realizar la devolución de{' '}
                        <span className="font-bold text-foreground">{simboloMoneda}{monto.toFixed(2)}</span>?
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {/* Alerta de efectivo insuficiente */}
                    {!hayEfectivoSuficiente && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                                Efectivo insuficiente en caja ({simboloMoneda}{efectivoDisponible.toFixed(2)} disponible).
                                Seleccione otra opción.
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Info del método original */}
                    {metodoPagoOriginal && !metodoOriginalEsEfectivo && (
                        <Alert className="mb-4 border-blue-200 bg-blue-50">
                            <Info className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-800">
                                El huésped pagó con <strong>{metodoPagoOriginal}</strong>.
                                Se recomienda devolver al mismo método.
                            </AlertDescription>
                        </Alert>
                    )}

                    <RadioGroup
                        value={metodoSeleccionado}
                        onValueChange={(value) => setMetodoSeleccionado(value as MetodoDevolucion)}
                        className="space-y-3"
                    >
                        {METODOS.map((metodo) => {
                            const Icon = metodo.icon
                            const disabled = metodo.id === 'EFECTIVO' && efectivoDeshabilitado

                            return (
                                <label
                                    key={metodo.id}
                                    className={cn(
                                        "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                                        metodoSeleccionado === metodo.id
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:bg-muted/50",
                                        disabled && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <RadioGroupItem
                                        value={metodo.id}
                                        id={metodo.id}
                                        disabled={disabled}
                                        className="mt-0.5"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <Icon className={cn("h-4 w-4", metodo.color)} />
                                            <Label
                                                htmlFor={metodo.id}
                                                className={cn(
                                                    "font-medium cursor-pointer",
                                                    disabled && "cursor-not-allowed"
                                                )}
                                            >
                                                {metodo.label}
                                            </Label>
                                            {metodo.id === 'EFECTIVO' && efectivoDeshabilitado && (
                                                <Badge variant="destructive" className="text-xs">
                                                    Sin saldo
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {metodo.description}
                                        </p>
                                    </div>
                                </label>
                            )
                        })}
                    </RadioGroup>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={loading || (metodoSeleccionado === 'EFECTIVO' && efectivoDeshabilitado)}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>Confirmar Devolución</>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
