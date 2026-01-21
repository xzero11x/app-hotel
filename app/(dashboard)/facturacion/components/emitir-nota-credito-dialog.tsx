'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertTriangle, FileMinus } from 'lucide-react'
import { emitirNotaCreditoManual } from '@/lib/actions/comprobantes'

/**
 * Tipos de Nota de Crédito según SUNAT (Nubefact Doc API V1)
 * Solo mostramos los relevantes para hotelería
 */
const TIPOS_NOTA_CREDITO = [
    { value: '1', label: 'Anulación de la operación', description: 'Anula 100% del comprobante' },
    { value: '6', label: 'Devolución total', description: 'Devolver todo el dinero' },
    { value: '9', label: 'Disminución en el valor', description: 'Reducir monto parcialmente' },
    { value: '10', label: 'Otros conceptos', description: 'Otros ajustes' },
]

interface ComprobanteOriginal {
    id: string
    tipo_comprobante: 'BOLETA' | 'FACTURA' | 'NOTA_CREDITO' | 'TICKET_INTERNO'
    numero_completo: string
    total_venta: number
    moneda: string
    cliente_nombre: string
    cliente_doc: string
}

interface EmitirNotaCreditoDialogProps {
    comprobante: ComprobanteOriginal | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function EmitirNotaCreditoDialog({
    comprobante,
    open,
    onOpenChange,
    onSuccess
}: EmitirNotaCreditoDialogProps) {
    const [tipoNC, setTipoNC] = useState<string>('9')
    const [monto, setMonto] = useState<string>('')
    const [motivo, setMotivo] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Determinar si es anulación total (tipos 1 y 6 usan el monto completo)
    const esAnulacionTotal = tipoNC === '1' || tipoNC === '6'
    const montoEfectivo = esAnulacionTotal
        ? comprobante?.total_venta || 0
        : parseFloat(monto) || 0

    // Reset al abrir
    const handleOpenChange = (newOpen: boolean) => {
        if (newOpen) {
            setTipoNC('9')
            setMonto('')
            setMotivo('')
            setError(null)
        }
        onOpenChange(newOpen)
    }

    const handleSubmit = async () => {
        if (!comprobante) return

        // Validaciones
        if (!motivo.trim()) {
            setError('Debe ingresar un motivo para la Nota de Crédito')
            return
        }

        if (!esAnulacionTotal && montoEfectivo <= 0) {
            setError('Debe ingresar un monto válido')
            return
        }

        if (!esAnulacionTotal && montoEfectivo > comprobante.total_venta) {
            setError(`El monto no puede superar el total del comprobante (${formatCurrency(comprobante.total_venta, comprobante.moneda)})`)
            return
        }

        setLoading(true)
        setError(null)

        try {
            const resultado = await emitirNotaCreditoManual({
                comprobante_original_id: comprobante.id,
                tipo_nota_credito: parseInt(tipoNC),
                monto_devolucion: montoEfectivo,
                motivo: motivo.trim()
            })

            if (resultado.success) {
                onOpenChange(false)
                onSuccess?.()
            } else {
                setError(resultado.error || 'Error al emitir la Nota de Crédito')
            }
        } catch (err) {
            setError('Error inesperado al procesar la solicitud')
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (amount: number, currency: string = 'PEN') => {
        return new Intl.NumberFormat('es-PE', {
            style: 'currency',
            currency: currency,
        }).format(amount)
    }

    if (!comprobante) return null

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileMinus className="h-5 w-5 text-orange-500" />
                        Emitir Nota de Crédito
                    </DialogTitle>
                    <DialogDescription>
                        Emite una Nota de Crédito electrónica que modifica el comprobante seleccionado.
                        Esta acción es irreversible y será enviada a SUNAT.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Información del comprobante original */}
                    <div className="rounded-lg border bg-muted/50 p-3">
                        <p className="text-sm font-medium">Comprobante a modificar</p>
                        <div className="mt-1 flex items-center justify-between">
                            <span className="font-mono text-sm">{comprobante.numero_completo}</span>
                            <span className="font-semibold">
                                {formatCurrency(comprobante.total_venta, comprobante.moneda)}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {comprobante.cliente_nombre} - {comprobante.cliente_doc}
                        </p>
                    </div>

                    {/* Tipo de NC */}
                    <div className="grid gap-2">
                        <Label htmlFor="tipo_nc">Tipo de Nota de Crédito *</Label>
                        <Select value={tipoNC} onValueChange={setTipoNC}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccione el tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                {TIPOS_NOTA_CREDITO.map((tipo) => (
                                    <SelectItem key={tipo.value} value={tipo.value}>
                                        <div className="flex flex-col">
                                            <span>{tipo.label}</span>
                                            <span className="text-xs text-muted-foreground">{tipo.description}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Monto (solo si no es anulación total) */}
                    {!esAnulacionTotal && (
                        <div className="grid gap-2">
                            <Label htmlFor="monto">Monto a devolver *</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    {comprobante.moneda === 'USD' ? '$' : 'S/'}
                                </span>
                                <Input
                                    id="monto"
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max={comprobante.total_venta}
                                    value={monto}
                                    onChange={(e) => setMonto(e.target.value)}
                                    placeholder="0.00"
                                    className="pl-10"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Máximo: {formatCurrency(comprobante.total_venta, comprobante.moneda)}
                            </p>
                        </div>
                    )}

                    {/* Alerta para anulación total */}
                    {esAnulacionTotal && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                                Se emitirá NC por el monto total: {formatCurrency(comprobante.total_venta, comprobante.moneda)}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Motivo */}
                    <div className="grid gap-2">
                        <Label htmlFor="motivo">Motivo *</Label>
                        <Textarea
                            id="motivo"
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            placeholder="Describa el motivo de la Nota de Crédito..."
                            rows={3}
                            maxLength={200}
                        />
                        <p className="text-xs text-muted-foreground text-right">
                            {motivo.length}/200 caracteres
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading} variant="destructive">
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <FileMinus className="mr-2 h-4 w-4" />
                                Emitir Nota de Crédito
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
