'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ========================================
// TYPES
// ========================================
export type Pago = {
  id: string
  reserva_id: string
  caja_turno_id: string
  comprobante_id: string | null
  metodo_pago: string
  moneda_pago: 'PEN' | 'USD'
  monto: number
  tipo_cambio_pago: number
  referencia_pago: string | null
  nota: string | null
  fecha_pago: string
}

export type RegistrarPagoInput = {
  reserva_id: string
  caja_turno_id: string
  metodo_pago: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'YAPE' | 'PLIN' | 'OTRO'
  monto: number
  moneda?: 'PEN' | 'USD'
  tipo_cambio?: number
  referencia_pago?: string
  nota?: string
  comprobante_id?: string
}

// ========================================
// OBTENER TURNO ACTIVO DE UN USUARIO
// ========================================
async function getTurnoActivo(usuario_id: string): Promise<string | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('caja_turnos')
    .select('id')
    .eq('usuario_id', usuario_id)
    .eq('estado', 'ABIERTA')
    .order('fecha_apertura', { ascending: false })
    .limit(1)
    .single()

  return data?.id || null
}

// ========================================
// REGISTRAR PAGO
// ========================================
export async function registrarPago(input: RegistrarPagoInput) {
  const supabase = await createClient()

  // Obtener usuario actual
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Usuario no autenticado')
  }

  // Si no viene caja_turno_id, buscar turno activo del usuario
  let cajaTurnoId = input.caja_turno_id
  if (!cajaTurnoId) {
    const turnoActivo = await getTurnoActivo(user.id)
    if (!turnoActivo) {
      throw new Error('No hay turno de caja abierto. Debes abrir un turno primero.')
    }
    cajaTurnoId = turnoActivo
  }

  // Validar que la reserva existe
  const { data: reserva, error: reservaError } = await supabase
    .from('reservas')
    .select('id, precio_pactado')
    .eq('id', input.reserva_id)
    .single()

  if (reservaError || !reserva) {
    throw new Error('Reserva no encontrada')
  }

  // Validar que el monto es válido
  if (input.monto <= 0) {
    throw new Error('El monto debe ser mayor a 0')
  }

  // Insertar pago
  const { data: pago, error: pagoError } = await supabase
    .from('pagos')
    .insert({
      reserva_id: input.reserva_id,
      caja_turno_id: cajaTurnoId,
      metodo_pago: input.metodo_pago,
      monto: input.monto,
      moneda_pago: input.moneda || 'PEN',
      tipo_cambio_pago: input.tipo_cambio || 1.0,
      referencia_pago: input.referencia_pago,
      nota: input.nota,
      comprobante_id: input.comprobante_id,
      fecha_pago: new Date().toISOString()
    })
    .select()
    .single()

  if (pagoError) {
    console.error('Error al registrar pago:', pagoError)
    throw new Error('Error al registrar el pago')
  }

  revalidatePath('/rack')
  revalidatePath('/reservas')

  return pago
}

// ========================================
// OBTENER PAGOS DE UNA RESERVA
// ========================================
export async function getPagosByReserva(reserva_id: string): Promise<Pago[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('pagos')
    .select('*')
    .eq('reserva_id', reserva_id)
    .order('fecha_pago', { ascending: false })

  if (error) {
    console.error('Error al obtener pagos:', error)
    throw new Error('Error al obtener pagos')
  }

  return data || []
}

// ========================================
// CALCULAR SALDO PENDIENTE DE UNA RESERVA
// ========================================
export async function getSaldoPendiente(reserva_id: string): Promise<number> {
  const supabase = await createClient()

  // Obtener precio pactado
  const { data: reserva, error: reservaError } = await supabase
    .from('reservas')
    .select('precio_pactado')
    .eq('id', reserva_id)
    .single()

  if (reservaError || !reserva?.precio_pactado) {
    return 0
  }

  // Obtener suma de pagos
  const { data: pagos, error: pagosError } = await supabase
    .from('pagos')
    .select('monto, moneda_pago, tipo_cambio_pago')
    .eq('reserva_id', reserva_id)

  if (pagosError) {
    return reserva.precio_pactado
  }

  // Calcular total pagado (convirtiendo a PEN si es necesario)
  const totalPagado = pagos?.reduce((sum, p) => {
    const montoEnPen = p.moneda_pago === 'USD' 
      ? p.monto * p.tipo_cambio_pago 
      : p.monto
    return sum + montoEnPen
  }, 0) || 0

  return Math.max(0, reserva.precio_pactado - totalPagado)
}

// ========================================
// OBTENER TOTAL PAGADO DE UNA RESERVA
// ========================================
export async function getTotalPagado(reserva_id: string): Promise<number> {
  const supabase = await createClient()

  const { data: pagos, error } = await supabase
    .from('pagos')
    .select('monto, moneda_pago, tipo_cambio_pago')
    .eq('reserva_id', reserva_id)

  if (error) {
    console.error('Error al obtener pagos:', error)
    return 0
  }

  // Calcular total pagado (convirtiendo a PEN si es necesario)
  const totalPagado = pagos?.reduce((sum, p) => {
    const montoEnPen = p.moneda_pago === 'USD' 
      ? p.monto * p.tipo_cambio_pago 
      : p.monto
    return sum + montoEnPen
  }, 0) || 0

  return totalPagado
}

// ========================================
// ANULAR PAGO (NOTA DE CRÉDITO O ERROR)
// ========================================
export async function anularPago(pago_id: string, motivo: string) {
  const supabase = await createClient()

  // TODO: Implementar lógica de anulación
  // - Marcar pago como anulado (agregar campo "anulado" en BD)
  // - Registrar en auditoría
  // - Si tiene comprobante, generar nota de crédito

  throw new Error('Funcionalidad pendiente de implementar')
}
