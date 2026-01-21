'use server'

import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { esTransicionValida } from '@/lib/utils/validaciones-reservas'

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

    // 2. Validar que se pueda cancelar usando el helper
    const validacion = esTransicionValida(reserva.estado, 'CANCELADA')
    if (!validacion.valida) {
      return {
        error: validacion.mensaje || 'Transición de estado no permitida',
        code: 'TRANSICION_INVALIDA'
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

    logger.info('Reserva cancelada exitosamente', {
      action: 'cancelarReserva',
      reservaId,
    })

    return {
      success: true,
      message: 'Reserva cancelada exitosamente'
    }
  } catch (error: unknown) {
    logger.error('Error al cancelar reserva', {
      action: 'cancelarReserva',
      reservaId,
      originalError: getErrorMessage(error),
    })
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
// Helpers movidos a @/lib/utils para evitar error de Server Actions
// calcularTotalReserva
// calcularNoches

// ========================================
// CONTROL DE PRESENCIA (LLAVE)
// ========================================
export async function toggleHuespedPresente(reservaId: string, presente: boolean) {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('reservas')
      .update({ huesped_presente: presente })
      .eq('id', reservaId)

    if (error) throw error

    // NOTA: No usar revalidatePath - Realtime + optimistic updates manejan la UI
    return { success: true }
  } catch (error: unknown) {
    logger.error('Error al actualizar estado del huésped', {
      action: 'toggleHuespedPresente',
      reservaId,
      originalError: getErrorMessage(error),
    })
    return { error: 'Error al actualizar estado del huésped' }
  }
}
