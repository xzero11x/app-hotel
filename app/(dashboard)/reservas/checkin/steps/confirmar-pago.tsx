'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChevronLeft, CheckCircle2, Wallet, CreditCard, ArrowLeftRight, Smartphone, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface ConfirmarPagoProps {
    habitacionData: any
    huespedData: any
    onNext: (data: any) => void
    onBack: () => void
    loading: boolean
}

const METODOS_PAGO = [
    { id: 'EFECTIVO', label: 'Efectivo', icon: Wallet },
    { id: 'TARJETA', label: 'Tarjeta', icon: CreditCard },
    { id: 'TRANSFERENCIA', label: 'Transferencia', icon: ArrowLeftRight },
    { id: 'YAPE', label: 'Yape', icon: Smartphone },
    { id: 'PLIN', label: 'Plin', icon: Smartphone },
]

export function ConfirmarPago({
    habitacionData,
    huespedData,
    onNext,
    onBack,
    loading,
}: ConfirmarPagoProps) {
    const [tipoPago, setTipoPago] = useState<'ahora' | 'salir'>('salir')
    const [metodoPago, setMetodoPago] = useState<string>('EFECTIVO')

    const precioNoche = parseFloat(habitacionData?.precio_noche || 0)

    function handleFinalizar() {
        onNext({
            metodo_pago: tipoPago === 'ahora' ? metodoPago : null,
            monto: tipoPago === 'ahora' ? precioNoche : 0,
        })
    }

    return (
        <>
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Columna 1: Resumen */}
                <div className="space-y-4">
                    <h3 className="font-semibold">Resumen</h3>

                    <div className="border rounded-lg p-4 space-y-3">
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Habitación</span>
                            <span className="font-medium">{habitacionData?.habitacion_numero}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Categoría</span>
                            <span className="font-medium">{habitacionData?.categoria_nombre}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Tarifa</span>
                            <span className="font-medium capitalize">{habitacionData?.tarifa_nombre}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Precio/noche</span>
                            <span className="font-semibold text-primary">S/ {precioNoche.toFixed(2)}</span>
                        </div>

                        <div className="border-t pt-3 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Ingreso</span>
                                <span>{huespedData?.fecha_ingreso && format(new Date(huespedData.fecha_ingreso), 'dd/MM/yyyy', { locale: es })}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Salida</span>
                                <span>{huespedData?.fecha_salida_prevista && format(new Date(huespedData.fecha_salida_prevista), 'dd/MM/yyyy', { locale: es })}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Huéspedes</span>
                                <span>{huespedData?.num_huespedes}</span>
                            </div>
                        </div>
                    </div>

                    <div className="border rounded-lg p-4 space-y-3">
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Titular</span>
                            <span className="font-medium">{huespedData?.nombres} {huespedData?.apellidos}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Documento</span>
                            <span>{huespedData?.tipo_doc}: {huespedData?.num_doc}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Email</span>
                            <span className="text-sm">{huespedData?.email}</span>
                        </div>

                        {huespedData?.acompanantes && huespedData.acompanantes.length > 0 && (
                            <div className="border-t pt-3">
                                <p className="text-sm text-muted-foreground mb-2">Acompañantes ({huespedData.acompanantes.length})</p>
                                {huespedData.acompanantes.map((acomp: any, index: number) => (
                                    <p key={index} className="text-sm">• {acomp.nombres} {acomp.apellidos}</p>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Columna 2: Pago */}
                <div className="space-y-6">
                    <div>
                        <h3 className="font-semibold mb-1">Pago</h3>
                        <p className="text-sm text-muted-foreground">¿Cuándo realizará el pago?</p>
                    </div>

                    {/* Tabs de decisión de pago */}
                    <Tabs value={tipoPago} onValueChange={(v) => setTipoPago(v as 'ahora' | 'salir')} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 h-auto p-1">
                            <TabsTrigger value="ahora" className="flex items-center gap-2 py-4">
                                <Wallet className="h-4 w-4" />
                                <span>Pagar Ahora</span>
                            </TabsTrigger>
                            <TabsTrigger value="salir" className="flex items-center gap-2 py-4">
                                <Clock className="h-4 w-4" />
                                <span>Pagar al Salir</span>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="ahora" className="space-y-4 mt-4">
                            {/* Monto a pagar */}
                            <div className="border rounded-lg p-4 bg-primary/5">
                                <div className="flex items-baseline justify-between">
                                    <span className="text-sm text-muted-foreground">Monto a registrar:</span>
                                    <div className="text-right">
                                        <span className="text-3xl font-bold text-primary">S/ {precioNoche.toFixed(2)}</span>
                                        <p className="text-xs text-muted-foreground">Primera noche</p>
                                    </div>
                                </div>
                            </div>

                            {/* Métodos de pago */}
                            <div className="space-y-3">
                                <p className="text-sm font-medium">Método de Pago</p>
                                <div className="grid grid-cols-5 gap-2">
                                    {METODOS_PAGO.map((metodo) => {
                                        const Icon = metodo.icon
                                        return (
                                            <button
                                                key={metodo.id}
                                                type="button"
                                                onClick={() => setMetodoPago(metodo.id)}
                                                className={cn(
                                                    'flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-colors',
                                                    metodoPago === metodo.id
                                                        ? 'border-primary bg-primary/5'
                                                        : 'border-border hover:border-primary/30'
                                                )}
                                            >
                                                <Icon className={cn(
                                                    'h-5 w-5',
                                                    metodoPago === metodo.id ? 'text-primary' : 'text-muted-foreground'
                                                )} />
                                                <span className={cn(
                                                    'text-xs',
                                                    metodoPago === metodo.id ? 'text-primary font-medium' : 'text-muted-foreground'
                                                )}>
                                                    {metodo.label}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Confirmación */}
                            <div className="border border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-green-900 dark:text-green-100">Pago Confirmado</p>
                                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                                            Se registrará <strong>S/ {precioNoche.toFixed(2)}</strong> por {METODOS_PAGO.find(m => m.id === metodoPago)?.label}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="salir" className="mt-4">
                            <div className="border rounded-lg p-6 text-center space-y-3">
                                <Clock className="h-12 w-12 mx-auto text-muted-foreground" />
                                <div>
                                    <p className="font-medium">Pago Pendiente</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        El pago se realizará al momento del check-out
                                    </p>
                                </div>
                                <div className="border-t pt-3">
                                    <p className="text-xs text-muted-foreground">
                                        Total a pagar al salir: <span className="font-semibold text-foreground">S/ {precioNoche.toFixed(2)}</span> por noche
                                    </p>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="fixed bottom-0 right-0 left-0 md:left-[var(--sidebar-width)] border-t bg-background z-50">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex justify-between">
                        <Button variant="outline" onClick={onBack} disabled={loading}>
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Atrás
                        </Button>
                        <Button onClick={handleFinalizar} disabled={loading} size="lg">
                            {loading ? 'Procesando...' : (
                                <>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Finalizar Check-in
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    )
}
