'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import { SelectHabitacion } from './steps/select-habitacion'
import { DatosHuesped } from './steps/datos-huesped'
import { ConfirmarPago } from './steps/confirmar-pago'
import { crearCheckIn, registrarPago } from '@/lib/actions/checkin'

interface CheckInFormProps {
    habitaciones: any[]
}

export function CheckInForm({ habitaciones }: CheckInFormProps) {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)

    // Datos del formulario
    const [habitacionData, setHabitacionData] = useState<any>(null)
    const [huespedData, setHuespedData] = useState<any>(null)
    const [pagoData, setPagoData] = useState<any>(null)

    const steps = [
        { number: 1, title: 'Seleccionar Habitación', completed: step > 1 },
        { number: 2, title: 'Datos del Huésped', completed: step > 2 },
        { number: 3, title: 'Confirmar y Pagar', completed: step > 3 },
    ]

    async function handleFinalizar() {
        if (!habitacionData || !huespedData || !pagoData) return

        setLoading(true)

        try {
            // Crear check-in
            const checkInResult = await crearCheckIn({
                habitacion_id: habitacionData.habitacion_id,
                huesped_principal_id: huespedData.huesped_id,
                tarifa_id: habitacionData.tarifa_id,
                fecha_ingreso: huespedData.fecha_ingreso,
                fecha_salida_prevista: huespedData.fecha_salida_prevista,
                precio_noche_final: habitacionData.precio_noche,
                num_huespedes: huespedData.num_huespedes,
                acompanantes: huespedData.acompanantes,
            })

            if (checkInResult.error) {
                alert(checkInResult.error)
                setLoading(false)
                return
            }

            // Registrar pago si hay
            if (pagoData.monto > 0) {
                const pagoResult = await registrarPago({
                    estadia_id: checkInResult.estadia.id,
                    monto: pagoData.monto,
                    metodo_pago: pagoData.metodo_pago,
                    concepto: 'Pago inicial de check-in',
                })

                if (pagoResult.error) {
                    alert('Check-in creado pero error al registrar pago: ' + pagoResult.error)
                }
            }

            // Redirigir a la lista de estadías activas
            router.push('/reservas/estadias')
            router.refresh()
        } catch (error) {
            alert('Error al procesar check-in')
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Progress Steps - Compacto */}
            <div className="relative">
                <div className="flex items-start justify-between max-w-2xl mx-auto">
                    {steps.map((s, index) => (
                        <div key={s.number} className="flex flex-col items-center flex-1">
                            {/* Círculo del paso */}
                            <div className="relative z-10">
                                <div
                                    className={`flex items-center justify-center h-10 w-10 rounded-full transition-all ${s.completed
                                        ? 'bg-primary border-2 border-primary'
                                        : step === s.number
                                            ? 'bg-primary border-2 border-primary'
                                            : 'bg-muted border-2 border-muted'
                                        }`}
                                >
                                    {s.completed ? (
                                        <CheckCircle2 className="h-5 w-5 text-primary-foreground" />
                                    ) : (
                                        <span
                                            className={`text-sm font-semibold ${step === s.number
                                                ? 'text-primary-foreground'
                                                : 'text-muted-foreground'
                                                }`}
                                        >
                                            {s.number}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Texto del paso */}
                            <p
                                className={`mt-2 text-xs font-medium text-center max-w-[100px] leading-tight ${step >= s.number ? 'text-foreground' : 'text-muted-foreground'
                                    }`}
                            >
                                {s.title}
                            </p>

                            {/* Línea conectora */}
                            {index < steps.length - 1 && (
                                <div
                                    className="absolute left-0 right-0 top-5 -z-10 mx-auto"
                                    style={{
                                        width: 'calc(100% - 80px)',
                                        left: `calc(${(100 / steps.length) * (index + 0.5)}% + 20px)`,
                                    }}
                                >
                                    <div
                                        className={`h-0.5 transition-colors ${step > s.number ? 'bg-primary' : 'bg-muted'
                                            }`}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Form Content */}
            <div className="pb-32">
                {step === 1 && (
                    <SelectHabitacion
                        habitaciones={habitaciones}
                        initialData={habitacionData}
                        onNext={(data) => {
                            setHabitacionData(data)
                            setStep(2)
                        }}
                    />
                )}

                {step === 2 && (
                    <DatosHuesped
                        habitacionData={habitacionData}
                        initialData={huespedData}
                        onNext={(data) => {
                            setHuespedData(data)
                            setStep(3)
                        }}
                        onBack={() => setStep(1)}
                    />
                )}

                {step === 3 && (
                    <ConfirmarPago
                        habitacionData={habitacionData}
                        huespedData={huespedData}
                        onNext={(data) => {
                            setPagoData(data)
                            handleFinalizar()
                        }}
                        onBack={() => setStep(2)}
                        loading={loading}
                    />
                )}
            </div>
        </div>
    )
}
