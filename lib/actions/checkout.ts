'use server'

import { createClient } from '@/lib/supabase/server'
import { getSaldoPendiente } from './pagos'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'

// ========================================
// TYPES
// ========================================
export type CheckoutInput = {
  reserva_id: string
  forzar_checkout?: boolean // Para casos excepcionales (deuda condonada)
  nota_checkout?: string
}

export type CheckoutResult = {
  success: boolean
  message: string
  saldo_pendiente?: number
  reserva_id?: string
}

// ========================================
// VALIDAR SI UNA RESERVA PUEDE HACER CHECKOUT
// ========================================
export async function validarCheckout(reserva_id: string): Promise<{
  puede_checkout: boolean
  motivo?: string
  saldo_pendiente?: number
}> {
  const supabase = await createClient()

  // 1. Verificar que la reserva existe y está en estado CHECKED_IN
  const { data: reserva, error: reservaError } = await supabase
    .from('reservas')
    .select('id, estado, precio_pactado')
    .eq('id', reserva_id)
    .single()

  if (reservaError || !reserva) {
    return {
      puede_checkout: false,
      motivo: 'Reserva no encontrada'
    }
  }

  if (reserva.estado !== 'CHECKED_IN') {
    return {
      puede_checkout: false,
      motivo: `No se puede hacer checkout. Estado actual: ${reserva.estado}`
    }
  }

  // 2. Verificar saldo pendiente
  const saldoPendiente = await getSaldoPendiente(reserva_id)

  if (saldoPendiente > 0) {
    return {
      puede_checkout: false,
      motivo: 'El huésped tiene saldo pendiente de pago',
      saldo_pendiente: saldoPendiente
    }
  }

  return {
    puede_checkout: true,
    saldo_pendiente: 0
  }
}

// ========================================
// REALIZAR CHECKOUT
// ========================================
export async function realizarCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const supabase = await createClient()

  // 1. Validar si puede hacer checkout
  const validacion = await validarCheckout(input.reserva_id)

  if (!validacion.puede_checkout && !input.forzar_checkout) {
    return {
      success: false,
      message: validacion.motivo || 'No se puede realizar el checkout',
      saldo_pendiente: validacion.saldo_pendiente
    }
  }

  // 2. Obtener datos de la reserva (necesitamos habitacion_id)
  const { data: reserva, error: reservaError } = await supabase
    .from('reservas')
    .select('id, habitacion_id, estado')
    .eq('id', input.reserva_id)
    .single()

  if (reservaError || !reserva) {
    return {
      success: false,
      message: 'Error al obtener datos de la reserva'
    }
  }

  // 3. Actualizar estado de la reserva a CHECKED_OUT
  const { error: updateReservaError } = await supabase
    .from('reservas')
    .update({
      estado: 'CHECKED_OUT',
      huesped_presente: false,
      check_out_real: new Date().toISOString()
    })
    .eq('id', input.reserva_id)

  if (updateReservaError) {
    logger.error('Error al actualizar reserva en checkout', {
      action: 'realizarCheckout',
      reservaId: input.reserva_id,
      originalError: getErrorMessage(updateReservaError),
    })
    return {
      success: false,
      message: 'Error al actualizar estado de la reserva'
    }
  }

  // 4. Marcar habitación como SUCIA y LIBRE (CRÍTICO)
  const { error: updateHabitacionError } = await supabase
    .from('habitaciones')
    .update({
      estado_ocupacion: 'LIBRE',
      estado_limpieza: 'SUCIA'
    })
    .eq('id', reserva.habitacion_id)

  if (updateHabitacionError) {
    logger.error('Error al actualizar habitación en checkout, haciendo rollback', {
      action: 'realizarCheckout',
      reservaId: input.reserva_id,
      habitacionId: reserva.habitacion_id,
      originalError: getErrorMessage(updateHabitacionError),
    })

    // ROLLBACK: Revertir el checkout de la reserva
    await supabase
      .from('reservas')
      .update({
        estado: 'CHECKED_IN',
        check_out_real: null,
        huesped_presente: true
      })
      .eq('id', input.reserva_id)

    return {
      success: false,
      message: 'Error: No se pudo liberar la habitación. El checkout no se completó.'
    }
  }

  // 5. Checkout completado - Realtime actualizará la UI automáticamente
  // NOTA: No usar revalidatePath - no funciona con Client Components

  return {
    success: true,
    message: input.forzar_checkout && validacion.saldo_pendiente
      ? `Checkout forzado completado. Saldo pendiente: S/ ${validacion.saldo_pendiente?.toFixed(2)}`
      : 'Checkout realizado exitosamente',
    reserva_id: input.reserva_id
  }
}

// ========================================
// CHECK-OUT RÁPIDO (SIN VALIDACIÓN DE DEUDA)
// ========================================
export async function checkoutRapido(reserva_id: string): Promise<CheckoutResult> {
  return realizarCheckout({
    reserva_id,
    forzar_checkout: true,
    nota_checkout: 'Checkout rápido sin validación de deuda'
  })
}

// ========================================
// OBTENER RESERVAS LISTAS PARA CHECKOUT
// ========================================
export async function getReservasParaCheckout() {
  const supabase = await createClient()

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('reservas')
    .select(`
      id,
      codigo_reserva,
      fecha_salida,
      estado,
      precio_pactado,
      habitacion_id,
      habitaciones (
        numero,
        tipos_habitacion (nombre)
      ),
      reserva_huespedes!inner (
        huespedes!inner (
          nombres,
          apellidos
        )
      )
    `)
    .eq('estado', 'CHECKED_IN')
    .lte('fecha_salida', hoy.toISOString())
    .order('fecha_salida', { ascending: true })

  if (error) {
    logger.error('Error al obtener reservas para checkout', { action: 'getReservasParaCheckout', originalError: getErrorMessage(error) })
    return []
  }

  return data || []
}

// ========================================
// OBTENER CHECKOUTS DEL DÍA
// ========================================
export async function getCheckoutsDelDia() {
  const supabase = await createClient()

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const manana = new Date(hoy)
  manana.setDate(manana.getDate() + 1)

  const { data, error } = await supabase
    .from('reservas')
    .select(`
      id,
      codigo_reserva,
      fecha_salida,
      estado,
      habitacion_id,
      habitaciones (
        numero,
        tipos_habitacion (nombre)
      ),
      reserva_huespedes!inner (
        es_titular,
        huespedes!inner (
          nombres,
          apellidos
        )
      )
    `)
    .eq('estado', 'CHECKED_IN')
    .gte('fecha_salida', hoy.toISOString())
    .lt('fecha_salida', manana.toISOString())
    .eq('reserva_huespedes.es_titular', true)
    .order('fecha_salida', { ascending: true })

  if (error) {
    logger.error('Error al obtener checkouts del día', { action: 'getCheckoutsDelDia', originalError: getErrorMessage(error) })
    return []
  }

  return data || []
}

// ========================================
// CHECKOUTS ATRASADOS (OVERSTAY)
// ========================================
export async function getCheckoutsAtrasados() {
  const supabase = await createClient()

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('reservas')
    .select(`
      id,
      codigo_reserva,
      fecha_salida,
      estado,
      habitacion_id,
      habitaciones (
        numero
      ),
      reserva_huespedes!inner (
        es_titular,
        huespedes!inner (
          nombres,
          apellidos
        )
      )
    `)
    .eq('estado', 'CHECKED_IN')
    .lt('fecha_salida', hoy.toISOString())
    .eq('reserva_huespedes.es_titular', true)
    .order('fecha_salida', { ascending: true })

  if (error) {
    logger.error('Error al obtener checkouts atrasados', { action: 'getCheckoutsAtrasados', originalError: getErrorMessage(error) })
    return []
  }

  return data || []
}
