'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'

// ========================================
// TIPOS
// ========================================

export type ResultadoRedimension = {
    success: boolean
    error?: string
    resumen?: {
        diasOriginales: number
        diasNuevos: number
        diferenciaDias: number
        montoOriginal: number
        montoNuevo: number
        diferenciaMonto: number
        requiereFacturaExtra: boolean
        requiereNotaCredito: boolean
    }
}

export type DatosRedimension = {
    reservaId: string
    nuevaFechaSalida: string  // ISO string
}

// ========================================
// VALIDAR DISPONIBILIDAD PARA EXTENSIÓN
// ========================================

export async function validarDisponibilidadExtension(
    habitacionId: string,
    fechaSalidaActual: string,
    nuevaFechaSalida: string
): Promise<{ disponible: boolean; conflictos?: string[] }> {
    const supabase = await createClient()

    // Buscar reservas que se solapan con el período de extensión
    const { data: conflictos, error } = await supabase
        .from('reservas')
        .select('id, codigo_reserva, fecha_entrada, fecha_salida')
        .eq('habitacion_id', habitacionId)
        .neq('estado', 'CANCELADA')
        .neq('estado', 'NO_SHOW')
        .neq('estado', 'CHECKED_OUT')
        .gte('fecha_entrada', fechaSalidaActual)
        .lt('fecha_entrada', nuevaFechaSalida)

    if (error) {
        logger.error('Error al validar disponibilidad', {
            action: 'validarDisponibilidadExtension',
            habitacionId,
            originalError: getErrorMessage(error)
        })
        return { disponible: false, conflictos: ['Error al verificar disponibilidad'] }
    }

    if (conflictos && conflictos.length > 0) {
        return {
            disponible: false,
            conflictos: conflictos.map(c => `Reserva ${c.codigo_reserva} (${c.fecha_entrada})`)
        }
    }

    return { disponible: true }
}

// ========================================
// CALCULAR RESUMEN DE CAMBIO
// ========================================

export async function calcularResumenCambio(
    reservaId: string,
    nuevaFechaSalida: string
): Promise<ResultadoRedimension> {
    const supabase = await createClient()

    // Obtener datos de la reserva
    const { data: reserva, error } = await supabase
        .from('reservas')
        .select(`
      id,
      fecha_entrada,
      fecha_salida,
      precio_pactado,
      estado
    `)
        .eq('id', reservaId)
        .single()

    if (error || !reserva) {
        return { success: false, error: 'Reserva no encontrada' }
    }

    // Calcular días usando diferencia de calendario (Ignora horas, evita errores de UTC/Local)
    // Se extrae solo la parte YYYY-MM-DD para garantizar consistencia absoluta.
    const fechaEntradaStr = reserva.fecha_entrada.split('T')[0]
    const fechaSalidaActualStr = reserva.fecha_salida.split('T')[0]
    const fechaSalidaNuevaStr = nuevaFechaSalida.split('T')[0]

    const diasOriginales = differenceInCalendarDays(
        new Date(fechaSalidaActualStr + 'T12:00:00'),
        new Date(fechaEntradaStr + 'T12:00:00')
    )
    const diasNuevos = differenceInCalendarDays(
        new Date(fechaSalidaNuevaStr + 'T12:00:00'),
        new Date(fechaEntradaStr + 'T12:00:00')
    )
    const diferenciaDias = diasNuevos - diasOriginales

    logger.info('Redimensionamiento procesado', {
        reservaId,
        nochesOriginales: diasOriginales,
        nochesNuevas: diasNuevos,
        diferencia: diferenciaDias
    })

    if (diasNuevos < 1) {
        return { success: false, error: 'La estadía debe ser de al menos 1 noche' }
    }

    // Calcular montos
    const precioPorNoche = reserva.precio_pactado
    const montoOriginal = precioPorNoche * diasOriginales
    const montoNuevo = precioPorNoche * diasNuevos
    const diferenciaMonto = montoNuevo - montoOriginal

    // Verificar si hay comprobante emitido
    const { data: comprobantes } = await supabase
        .from('comprobantes')
        .select('id, tipo_comprobante, total_venta, estado_sunat')
        .eq('reserva_id', reservaId)
        .neq('estado_sunat', 'ANULADO')
        .in('tipo_comprobante', ['BOLETA', 'FACTURA'])

    const tieneComprobanteEmitido = comprobantes && comprobantes.length > 0

    return {
        success: true,
        resumen: {
            diasOriginales,
            diasNuevos,
            diferenciaDias,
            montoOriginal,
            montoNuevo,
            diferenciaMonto,
            requiereFacturaExtra: Boolean(tieneComprobanteEmitido && diferenciaMonto > 0),
            requiereNotaCredito: Boolean(tieneComprobanteEmitido && diferenciaMonto < 0)
        }
    }
}

// ========================================
// LATE CHECKOUT - CALCULAR MONTO
// ========================================

// Importar constantes desde archivo separado (no se pueden exportar objetos desde 'use server')
import { OPCIONES_LATE_CHECKOUT, type OpcionLateCheckout } from '@/lib/constants/late-checkout'

// Re-exportar el tipo para que otros lo usen (los tipos SÍ se pueden re-exportar)
export type { OpcionLateCheckout }

export type ResultadoLateCheckout = {
    success: boolean
    error?: string
    precioNoche?: number
    montoACobrar?: number
    porcentaje?: number
    descripcionComprobante?: string
    esDiaCompleto?: boolean
}

export async function calcularLateCheckout(
    reservaId: string,
    horasExtra: number
): Promise<ResultadoLateCheckout> {
    const supabase = await createClient()

    try {
        // Obtener datos de la reserva
        const { data: reserva, error } = await supabase
            .from('reservas')
            .select('id, precio_pactado, habitacion_id, habitaciones(numero)')
            .eq('id', reservaId)
            .single()

        if (error || !reserva) {
            return { success: false, error: 'No se encontró la reserva' }
        }

        // Buscar la opción de late checkout
        const opcion = OPCIONES_LATE_CHECKOUT.find(o => o.horas === horasExtra)
        if (!opcion) {
            return { success: false, error: 'Opción de late checkout inválida' }
        }

        const precioNoche = reserva.precio_pactado
        const montoACobrar = (precioNoche * opcion.porcentaje) / 100

        // Descripción para el comprobante
        const habitacionNumero = (reserva.habitaciones as any)?.numero || 'N/A'
        const descripcionComprobante = opcion.esDiaCompleto
            ? `Extensión estadía - Habitación ${habitacionNumero}`
            : `Late Check-out (${opcion.horas}h) - Habitación ${habitacionNumero}`

        return {
            success: true,
            precioNoche,
            montoACobrar,
            porcentaje: opcion.porcentaje,
            descripcionComprobante,
            esDiaCompleto: opcion.esDiaCompleto
        }
    } catch (error) {
        logger.error('Error en calcularLateCheckout', {
            action: 'calcularLateCheckout',
            reservaId,
            originalError: getErrorMessage(error)
        })
        return { success: false, error: 'Error al calcular late checkout' }
    }
}

// ========================================
// EXTENDER ESTADÍA
// ========================================

export async function extenderEstadia(
    reservaId: string,
    nuevaFechaSalida: string
): Promise<{ success: boolean; error?: string; mensaje?: string }> {
    const supabase = await createClient()

    try {
        // 1. Obtener datos de la reserva
        const { data: reserva, error: reservaError } = await supabase
            .from('reservas')
            .select(`
        id,
        habitacion_id,
        fecha_entrada,
        fecha_salida,
        precio_pactado,
        estado
      `)
            .eq('id', reservaId)
            .single()

        if (reservaError || !reserva) {
            return { success: false, error: 'Reserva no encontrada' }
        }

        // Validar que la nueva fecha sea posterior a la actual
        if (new Date(nuevaFechaSalida) <= new Date(reserva.fecha_salida)) {
            return { success: false, error: 'Para extender, la nueva fecha debe ser posterior a la actual' }
        }

        // 2. Validar disponibilidad
        const disponibilidad = await validarDisponibilidadExtension(
            reserva.habitacion_id,
            reserva.fecha_salida,
            nuevaFechaSalida
        )

        if (!disponibilidad.disponible) {
            return {
                success: false,
                error: `Habitación no disponible. Conflictos: ${disponibilidad.conflictos?.join(', ')}`
            }
        }

        // 3. Calcular resumen
        const resumen = await calcularResumenCambio(reservaId, nuevaFechaSalida)
        if (!resumen.success || !resumen.resumen) {
            return { success: false, error: resumen.error || 'Error al calcular cambio' }
        }

        // 4. Actualizar fecha de salida
        // 4. Actualizar fecha de salida
        // IMPORTANTE: Guardamos a las 12:00 UTC para evitar que zonas horarias negativas (como UTC-5)
        // desplacen la fecha al día anterior (ej: 00:00Z -> 19:00 día previo).
        const { error: updateError } = await supabase
            .from('reservas')
            .update({ fecha_salida: `${nuevaFechaSalida}T12:00:00Z` })
            .eq('id', reservaId)

        if (updateError) {
            logger.error('Error al actualizar fecha de salida', {
                action: 'extenderEstadia',
                reservaId,
                originalError: getErrorMessage(updateError)
            })
            return { success: false, error: 'Error al actualizar la reserva' }
        }

        // 5. Si hay comprobante, emitir factura adicional por la diferencia
        if (resumen.resumen.requiereFacturaExtra) {
            // TODO: Emitir factura adicional
            // Por ahora solo loggeamos
            logger.info('Extensión requiere factura adicional', {
                action: 'extenderEstadia',
                reservaId,
                montoExtra: resumen.resumen.diferenciaMonto
            })
        }

        logger.info('Estadía extendida exitosamente', {
            action: 'extenderEstadia',
            reservaId,
            diasExtra: resumen.resumen.diferenciaDias,
            montoExtra: resumen.resumen.diferenciaMonto
        })

        revalidatePath('/rack')
        revalidatePath('/ocupaciones')

        return {
            success: true,
            mensaje: `Estadía extendida ${resumen.resumen.diferenciaDias} noches. ${resumen.resumen.requiereFacturaExtra ? 'Se debe emitir factura adicional por S/' + resumen.resumen.diferenciaMonto.toFixed(2) : ''}`
        }

    } catch (error) {
        logger.error('Error en extenderEstadia', {
            action: 'extenderEstadia',
            reservaId,
            originalError: getErrorMessage(error)
        })
        return { success: false, error: 'Error al procesar la extensión' }
    }
}

// ========================================
// ACORTAR ESTADÍA
// ========================================

import { emitirNotaCreditoParcial } from '@/lib/actions/comprobantes'
import { registrarMovimiento } from '@/lib/actions/cajas'

// Tipo para método de devolución
export type MetodoDevolucion = 'EFECTIVO' | 'METODO_ORIGINAL'

export async function acortarEstadia(
    reservaId: string,
    nuevaFechaSalida: string,
    metodoDevolucion: MetodoDevolucion = 'EFECTIVO'
): Promise<{ success: boolean; error?: string; mensaje?: string; montoDevolucion?: number }> {
    const supabase = await createClient()

    // 1. Obtener datos de la reserva
    const { data: reserva, error: reservaError } = await supabase
        .from('reservas')
        .select(`
        id,
        habitacion_id,
        fecha_entrada,
        fecha_salida,
        precio_pactado,
        moneda_pactada,
        estado,
        codigo_reserva
      `)
        .eq('id', reservaId)
        .single()

    if (reservaError || !reserva) {
        return { success: false, error: 'Reserva no encontrada' }
    }

    // Validar que la nueva fecha sea anterior a la actual
    if (new Date(nuevaFechaSalida) >= new Date(reserva.fecha_salida)) {
        return { success: false, error: 'Para acortar, la nueva fecha debe ser anterior a la actual' }
    }

    // Validar que no sea antes de la fecha de entrada
    if (new Date(nuevaFechaSalida) <= new Date(reserva.fecha_entrada)) {
        return { success: false, error: 'La fecha de salida no puede ser anterior o igual a la entrada' }
    }

    // 2. Calcular resumen
    const resumen = await calcularResumenCambio(reservaId, nuevaFechaSalida)
    if (!resumen.success || !resumen.resumen) {
        return { success: false, error: resumen.error || 'Error al calcular cambio' }
    }

    const montoDevolucion = Math.abs(resumen.resumen.diferenciaMonto)
    const diasDevueltos = Math.abs(resumen.resumen.diferenciaDias)
    let mensajeExtra = ''

    // 3. Lógica Fiscal: Intentar emitir Nota de Crédito PRIMERO (Atomicidad Lógica)
    if (resumen.resumen.requiereNotaCredito && montoDevolucion > 0) {

        // Buscar EL MEJOR comprobante original válido (ACEPTADO o PENDIENTE)
        // Priorizamos el de mayor monto para asegurar que cubra la devolución
        const { data: comprobantes } = await supabase
            .from('comprobantes')
            .select('id, numero, serie, total_venta')
            .eq('reserva_id', reservaId)
            .in('estado_sunat', ['ACEPTADO', 'PENDIENTE'])
            .in('tipo_comprobante', ['BOLETA', 'FACTURA'])
            .order('total_venta', { ascending: false }) // Mayor monto primero
            .limit(1)

        const comprobante = comprobantes?.[0]

        if (comprobante) {
            // Validar que el comprobante cubra el monto
            if (comprobante.total_venta < montoDevolucion) {
                return { success: false, error: `El comprobante asociado (S/ ${comprobante.total_venta}) no cubre el monto a devolver (S/ ${montoDevolucion})` }
            }

            logger.info('Emitiendo Nota de Crédito por acortamiento', { reservaId, comprobanteId: comprobante.id })

            const resultadoNC = await emitirNotaCreditoParcial({
                comprobante_original_id: comprobante.id,
                monto_devolucion: montoDevolucion,
                motivo: `Acortamiento de estadía (${diasDevueltos} días menos)`,
                dias_devueltos: diasDevueltos,
                tipo_nota_credito: 9 // Tipo 09: Ajuste de montos / Disminución de valor
            })

            if (!resultadoNC.success) {
                return { success: false, error: `Error al emitir Nota de Crédito: ${resultadoNC.error}. No se modificó la estadía.` }
            }

            mensajeExtra += ` Se emitió Nota de Crédito ${resultadoNC.notaCredito?.numero}.`
        }
    }

    // 4. Actualizar fecha de salida en BD (Solo si la NC pasó o no era necesaria)
    // IMPORTANTE: Guardamos a las 12:00 UTC para evitar que zonas horarias negativas (como UTC-5)
    // desplacen la fecha al día anterior (ej: 00:00Z -> 19:00 día previo).
    const { error: updateError } = await supabase
        .from('reservas')
        .update({ fecha_salida: `${nuevaFechaSalida}T12:00:00Z` })
        .eq('id', reservaId)

    if (updateError) {
        logger.error('Error al actualizar fecha de salida', {
            action: 'acortarEstadia',
            reservaId,
            originalError: getErrorMessage(updateError)
        })
        return { success: false, error: 'Error crítico: Se emitió NC pero falló la actualización de fecha.' }
    }

    // 5. Lógica Financiera según método de devolución seleccionado
    if (montoDevolucion > 0) {
        // Primero obtener un turno activo (el campo caja_turno_id es NOT NULL)
        const { data: turnoActivo } = await supabase
            .from('caja_turnos')
            .select('id')
            .eq('estado', 'ABIERTA')
            .limit(1)
            .maybeSingle()

        if (!turnoActivo) {
            logger.warn('No hay turno activo para registrar movimientos', {
                action: 'acortarEstadia',
                reservaId
            })
        }

        // Manejar según método de devolución
        switch (metodoDevolucion) {
            case 'EFECTIVO':
                // Registrar EGRESO en caja_movimientos
                const resultadoCaja = await registrarMovimiento({
                    tipo: 'EGRESO',
                    categoria: 'DEVOLUCION',
                    moneda: reserva.moneda_pactada || 'PEN',
                    monto: montoDevolucion,
                    motivo: `Devolución reserva ${reserva.codigo_reserva} (Acortamiento)`,
                    comprobante_referencia: reserva.codigo_reserva
                })

                if (resultadoCaja.success) {
                    mensajeExtra += ' Dinero en efectivo descontado de caja.'
                } else {
                    mensajeExtra += ' Advertencia: Error al descontar de caja (verifique turno).'
                }
                break



            case 'METODO_ORIGINAL':
                // Se registra como egreso pendiente (el dinero volverá por otro medio)
                mensajeExtra += ' Devolución pendiente al método de pago original.'
                break
        }

        // Siempre registrar pago negativo para ajuste de saldo de reserva
        if (turnoActivo) {
            const { error: pagoNegativoError } = await supabase
                .from('pagos')
                .insert({
                    reserva_id: reservaId,
                    caja_turno_id: turnoActivo.id,
                    comprobante_id: null,
                    metodo_pago: metodoDevolucion === 'EFECTIVO' ? 'DEVOLUCION_EFECTIVO' : 'DEVOLUCION_PENDIENTE',
                    moneda_pago: reserva.moneda_pactada || 'PEN',
                    monto: -montoDevolucion, // NEGATIVO
                    tipo_cambio_pago: 1.0,
                    referencia_pago: null,
                    nota: `Devolución NC (${metodoDevolucion}) - Acortamiento ${diasDevueltos} noche(s)`,
                    fecha_pago: new Date().toISOString()
                })

            if (pagoNegativoError) {
                logger.warn('No se pudo registrar pago negativo', {
                    action: 'acortarEstadia',
                    reservaId,
                    originalError: getErrorMessage(pagoNegativoError)
                })
            } else {
                logger.info('Pago negativo registrado', {
                    action: 'acortarEstadia',
                    reservaId,
                    monto: -montoDevolucion,
                    metodo: metodoDevolucion
                })
            }
        }
    }

    // 6. Revalidar rutas
    revalidatePath('/ocupaciones')
    revalidatePath(`/ocupaciones/${reservaId}`)

    return {
        success: true,
        mensaje: `Estadía acortada exitosamente.${mensajeExtra}`,
        montoDevolucion
    }
}

// ========================================
// REDIMENSIONAR ESTADÍA (Función principal)
// ========================================

export async function redimensionarEstadia(
    reservaId: string,
    nuevaFechaSalida: string,
    metodoDevolucion?: MetodoDevolucion
): Promise<{ success: boolean; error?: string; mensaje?: string; tipo?: 'extension' | 'acortamiento' }> {
    const supabase = await createClient()

    // Obtener fecha de salida actual
    const { data: reserva } = await supabase
        .from('reservas')
        .select('fecha_salida')
        .eq('id', reservaId)
        .single()

    if (!reserva) {
        return { success: false, error: 'Reserva no encontrada' }
    }

    // Normalizar fechas para comparación (Mediodía para evitar UTC/Local shifts)
    const currentStr = reserva.fecha_salida.split('T')[0]
    const newStr = nuevaFechaSalida.split('T')[0]

    const fechaActual = new Date(currentStr + 'T12:00:00')
    const fechaNueva = new Date(newStr + 'T12:00:00')

    const diffDias = differenceInCalendarDays(fechaNueva, fechaActual)

    logger.info('Solicitud redimensionarEstadia', {
        reservaId,
        actual: currentStr,
        nueva: newStr,
        diferenciaDias: diffDias
    })

    if (diffDias > 0) {
        // Extensión
        const resultado = await extenderEstadia(reservaId, nuevaFechaSalida)
        return { ...resultado, tipo: 'extension' }
    } else if (diffDias < 0) {
        // Acortamiento - usar método de devolución si se proporciona
        const resultado = await acortarEstadia(reservaId, nuevaFechaSalida, metodoDevolucion || 'EFECTIVO')
        return { ...resultado, tipo: 'acortamiento' }
    } else {
        return { success: false, error: 'La nueva fecha es igual a la actual' }
    }
}
