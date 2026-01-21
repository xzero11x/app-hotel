'use client'

import { useState } from 'react'
import { format, differenceInDays, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import type { RackHabitacion } from '@/lib/actions/rack'
import { StepTarifa } from './steps/step-tarifa'
import { StepHuesped } from './steps/step-huesped'
import { StepConfirmacion } from './steps/step-confirmacion'
import { StepExito } from './steps/step-exito'
import { RegistrarPagoDialog } from '@/components/cajas/registrar-pago-dialog'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  habitacion: RackHabitacion
  fechaInicial: Date
  fechaFinal?: Date
  onSuccess: () => void
}

type FormData = {
  // Step 1: Tarifa
  tarifa_id: string | null
  fecha_entrada: Date
  fecha_salida: Date
  precio_pactado: number
  
  // Step 2: Huésped
  huesped_id: string | null // Si existe en BD
  tipo_documento: string
  numero_documento: string
  nombres: string
  apellidos: string
  email: string
  telefono: string
  nacionalidad: string
  fecha_nacimiento: string
  
  // Step 3: Pago (Checkbox solo para UI logic)
  registrar_pago: boolean
  metodo_pago: string | null
  numero_operacion: string | null
  monto_pagado: number
  huespedes?: any[] // Añadido para tipado
}

type PaymentData = {
  id: string
  saldo_pendiente: number
  titular_nombre: string
  titular_tipo_doc: string
  titular_numero_doc: string
  habitacion_numero: string
  precio_pactado: number
  fecha_entrada?: string
  fecha_salida?: string
}

type SuccessData = {
  id: string
  codigo: string
  esCheckin: boolean
}

export function NewReservationDialog({ 
  open, 
  onOpenChange, 
  habitacion, 
  fechaInicial,
  fechaFinal,
  onSuccess 
}: Props) {
  const [currentStep, setCurrentStep] = useState(1)
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [successData, setSuccessData] = useState<SuccessData | null>(null)
  
  // Calcular fecha_salida: 
  // Si hay fechaFinal (rango seleccionado), es la última noche. Sumamos 1 día para el checkout.
  // Si solo hay fechaInicial, sumamos 1 día para que sea una estadía de 1 noche.
  const calcularFechaSalida = () => {
    const base = fechaFinal || fechaInicial
    return addDays(base, 1)
  }
  
  const [formData, setFormData] = useState<FormData>({
    tarifa_id: null,
    fecha_entrada: fechaInicial,
    fecha_salida: calcularFechaSalida(),
    precio_pactado: 0,
    
    huesped_id: null,
    tipo_documento: 'DNI',
    numero_documento: '',
    nombres: '',
    apellidos: '',
    email: '',
    telefono: '',
    nacionalidad: 'PE',
    fecha_nacimiento: '',
    
    registrar_pago: false,
    metodo_pago: null,
    numero_operacion: null,
    monto_pagado: 0
  })

  const totalNoches = differenceInDays(formData.fecha_salida, formData.fecha_entrada)
  const totalEstimado = formData.precio_pactado * totalNoches

  const updateFormData = (updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  const handleClose = () => {
    setCurrentStep(1)
    setSuccessData(null)
    onOpenChange(false)
  }

  const handlePaymentRequest = (reservaId: string) => {
    const titular = formData.huespedes?.find((h: any) => h.es_titular)
    if (!titular) return

    setPaymentData({
      id: reservaId,
      saldo_pendiente: totalEstimado,
      titular_nombre: `${titular.nombres} ${titular.apellidos}`,
      titular_tipo_doc: titular.tipo_documento,
      titular_numero_doc: titular.numero_documento,
      habitacion_numero: habitacion.numero,
      precio_pactado: formData.precio_pactado,
      fecha_entrada: formData.fecha_entrada.toISOString(),
      fecha_salida: formData.fecha_salida.toISOString()
    })
    
    // NO cerramos el sheet aquí para que el diálogo de pago pueda renderizarse encima
    // Si cerramos el sheet, este componente se desmonta y paymentData se pierde.
  }

  const canGoNext = () => {
    if (currentStep === 1) {
      return formData.tarifa_id && formData.precio_pactado > 0
    }
    if (currentStep === 2) {
      return formData.numero_documento && formData.nombres && formData.apellidos
    }
    return true
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col">
          
          {/* MODO ÉXITO */}
          {successData ? (
            <StepExito 
              reservaId={successData.id}
              codigoReserva={successData.codigo}
              esCheckIn={successData.esCheckin}
              totalPagar={totalEstimado}
              onCobrar={() => handlePaymentRequest(successData.id)}
              onCerrar={handleClose}
            />
          ) : (
            /* MODO WIZARD NORMAL */
            <>
              <SheetHeader>
                <SheetTitle>
                  {currentStep === 1 && 'Seleccionar Tarifa'}
                  {currentStep === 2 && 'Datos del Huésped'}
                  {currentStep === 3 && 'Confirmación'}
                </SheetTitle>
                <SheetDescription>
                  Hab. {habitacion.numero} - {habitacion.tipos_habitacion.nombre}
                </SheetDescription>
              </SheetHeader>

              {/* Progress */}
              <div className="flex items-center gap-2 my-6">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`flex-1 h-2 rounded ${
                      step <= currentStep ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>

              {/* Steps */}
              <div className="flex-1 overflow-y-auto space-y-6">
                {currentStep === 1 && (
                  <StepTarifa
                    habitacion={habitacion}
                    formData={formData}
                    updateFormData={updateFormData}
                    totalNoches={totalNoches}
                    totalEstimado={totalEstimado}
                  />
                )}

                {currentStep === 2 && (
                  <StepHuesped
                    formData={formData}
                    updateFormData={updateFormData}
                  />
                )}

                {currentStep === 3 && (
                  <StepConfirmacion
                    habitacion={habitacion}
                    formData={formData}
                    totalNoches={totalNoches}
                    totalEstimado={totalEstimado}
                    onSuccess={(reservaId, codigo, esCheckin) => {
                      onSuccess() // Refrescar Rack inmediatamente
                      setSuccessData({ id: reservaId, codigo, esCheckin })
                    }}
                    onClose={handleClose}
                  />
                )}
              </div>

              {/* Navigation (solo para step 1 y 2) */}
              {currentStep < 3 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t">
                  {currentStep > 1 ? (
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(prev => prev - 1)}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Atrás
                    </Button>
                  ) : (
                    <Button variant="ghost" onClick={handleClose}>
                      Cancelar
                    </Button>
                  )}

                  <Button
                    onClick={() => setCurrentStep(prev => prev + 1)}
                    disabled={!canGoNext()}
                  >
                    Siguiente
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog de Pago Post-Reserva */}
      {paymentData && (
        <RegistrarPagoDialog
          open={!!paymentData}
          onOpenChange={(open) => !open && setPaymentData(null)}
          reserva={paymentData}
          onSuccess={() => {
            setPaymentData(null)
            handleClose() // Cerrar todo el flujo al terminar pago
            onSuccess() // Refrescar Rack nuevamente tras pagar
          }}
        />
      )}
    </>
  )
}