'use server'

import { createClient } from '@/lib/supabase/server'

// ========================================
// CANCELAR RESERVA
// ========================================
export async function cancelarReserva(reservaId: string, motivo?: string) {
  const supabase = await createClient()

  try {
    // 1. Obtener datos de la reserva
    const { data: reserva, error: reservaError } = await supabase
      .from('reservas')
      .select('id, estado, habitacion_id')
      .eq('id', reservaId)
      .single()

    if (reservaError || !reserva) {
      return {
        error: 'Reserva no encontrada',
        code: 'RESERVA_NO_ENCONTRADA'
      }
    }

    // 2. Validar que se pueda cancelar
    if (reserva.estado === 'CANCELADA') {
      return {
        error: 'La reserva ya está cancelada',
        code: 'YA_CANCELADA'
      }
    }

    if (reserva.estado === 'CHECKED_OUT') {
      return {
        error: 'No se puede cancelar una reserva que ya hizo check-out',
        code: 'CHECKOUT_COMPLETADO'
      }
    }

    // 3. Actualizar estado de reserva
    const { error: updateError } = await supabase
      .from('reservas')
      .update({ 
        estado: 'CANCELADA'
      })
      .eq('id', reservaId)

    if (updateError) {
      throw new Error(`Error al actualizar reserva: ${updateError.message}`)
    }

    // 4. Si estaba CHECKED_IN, liberar habitación
    if (reserva.estado === 'CHECKED_IN' && reserva.habitacion_id) {
      await supabase
        .from('habitaciones')
        .update({ 
          estado_ocupacion: 'LIBRE',
          estado_limpieza: 'SUCIA'
        })
        .eq('id', reserva.habitacion_id)
    }

    return { 
      success: true, 
      message: 'Reserva cancelada exitosamente' 
    }
  } catch (error: any) {
    console.error('[cancelarReserva] Error:', error)
    return {
      error: 'Error de sistema',
      message: 'Hubo un problema al cancelar la reserva',
      code: 'ERROR_SISTEMA'
    }
  }
}

// ========================================
// HELPERS PARA CÁLCULOS
// ========================================
function calcularTotalEstimado(reserva: {
  precio_pactado: number
  fecha_entrada: string | Date
  fecha_salida: string | Date
}): number {
  const entrada = new Date(reserva.fecha_entrada)
  const salida = new Date(reserva.fecha_salida)
  const noches = Math.max(1, 
    Math.floor((salida.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24))
  )
  return reserva.precio_pactado * noches
}

function calcularNoches(fecha_entrada: string | Date, fecha_salida: string | Date): number {
  const entrada = new Date(fecha_entrada)
  const salida = new Date(fecha_salida)
  return Math.max(1, 
    Math.floor((salida.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24))
  )
}
