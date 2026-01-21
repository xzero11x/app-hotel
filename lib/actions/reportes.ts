'use server'

import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'

export interface LibroHuespedesItem {
    fecha_ingreso: string
    habitacion: string
    nombre_completo: string
    nacionalidad: string
    departamento: string
    tipo_documento: string
    numero_documento: string
    fecha_salida: string
    tarifa: string          // Texto formateado: "PEN 100"
    tarifa_numero: number   // Número puro: 100
    dias: number            // Número de noches
    total: number           // tarifa_numero * dias
    moneda: string          // "PEN" o "USD"
}

export type FiltrosLibro = {
    fechaInicio: Date
    fechaFin: Date
}

/**
 * Obtiene los datos para legalizar el Libro de Huéspedes
 * Formato requerido por la ley:
 * - N° Habitación
 * - Fecha Ingreso
 * - Fecha Salida Probable
 * - Nombre Huésped
 * - Nacionalidad / Procedencia
 * - Documento
 * - Tarifa Pactada
 */
export async function getLibroHuespedes(filtros: FiltrosLibro) {
    const supabase = await createClient()

    const fechaInicioISO = filtros.fechaInicio.toISOString()
    const fechaFinISO = filtros.fechaFin.toISOString()

    // Consultar reservas activas o pasadas en el rango, obteniendo los huéspedes
    // Filtramos por fecha_entrada (ingreso) que es lo que pide el libro
    const { data: reservas, error } = await supabase
        .from('reservas')
        .select(`
      id,
      fecha_entrada,
      check_in_real,
      fecha_salida,
      precio_pactado,
      moneda_pactada,
      habitaciones!inner(numero),
      reserva_huespedes!inner(
        huespedes!inner(
            nombres,
            apellidos,
            nacionalidad,
            procedencia_departamento,
            tipo_documento,
            numero_documento
        )
      )
    `)
        .gte('fecha_entrada', fechaInicioISO)
        .lte('fecha_entrada', fechaFinISO)
        .order('fecha_entrada', { ascending: true })

    if (error) {
        console.error('Error al obtener libro de huéspedes:', error)
        return { success: false, error: 'Error al cargar el libro de huéspedes' }
    }

    // Transformar datos al formato plano del libro
    const filas: LibroHuespedesItem[] = []

    reservas.forEach((reserva: any) => {
        const habitacion = reserva.habitaciones.numero
        const fechaIngreso = reserva.check_in_real || reserva.fecha_entrada
        const fechaSalida = reserva.fecha_salida
        const tarifaNumero = reserva.precio_pactado || 0
        const moneda = reserva.moneda_pactada || 'PEN'
        const tarifa = `${moneda} ${tarifaNumero}`

        // Calcular días de estadía
        const dias = Math.max(1, Math.ceil(
            (new Date(fechaSalida).getTime() - new Date(fechaIngreso).getTime()) / (1000 * 60 * 60 * 24)
        ))
        const total = tarifaNumero * dias

        // Por cada huésped en la reserva, una línea en el libro
        reserva.reserva_huespedes.forEach((rh: any) => {
            const h = rh.huespedes

            filas.push({
                fecha_ingreso: fechaIngreso,
                habitacion,
                nombre_completo: `${h.nombres} ${h.apellidos}`.trim().toUpperCase(),
                nacionalidad: (h.nacionalidad || 'PERUANA').toUpperCase(),
                departamento: (h.procedencia_departamento || '-').toUpperCase(),
                tipo_documento: h.tipo_documento,
                numero_documento: h.numero_documento,
                fecha_salida: fechaSalida,
                tarifa,
                tarifa_numero: tarifaNumero,
                dias,
                total,
                moneda
            })
        })
    })

    // Ordenar por fecha de ingreso real cronológicamente
    filas.sort((a, b) => new Date(a.fecha_ingreso).getTime() - new Date(b.fecha_ingreso).getTime())

    return { success: true, data: filas }
}

// ========================================
// REPORTE DE RETIROS ADMINISTRATIVOS
// ========================================

export interface RetiroAdministrativo {
    id: string
    fecha: string
    monto: number
    moneda: 'PEN' | 'USD'
    motivo: string
    receptor: string  // Extraído del motivo
    cajero: string    // Quien registró el egreso
    turno_id: string
    caja_nombre: string
}

export interface ResumenRetiros {
    total_pen: number
    total_usd: number
    cantidad: number
    retiros: RetiroAdministrativo[]
}

export type FiltrosRetiros = {
    fechaInicio: Date
    fechaFin: Date
}

/**
 * Obtiene el reporte de retiros administrativos (dueño/gerencia)
 * para un periodo determinado, consolidando totales y detalles.
 */
export async function getReporteRetirosAdministrativos(filtros: FiltrosRetiros): Promise<{ success: boolean; data?: ResumenRetiros; error?: string }> {
    const supabase = await createClient()

    const fechaInicioISO = filtros.fechaInicio.toISOString()
    const fechaFinISO = filtros.fechaFin.toISOString()

    // Obtener movimientos tipo EGRESO con categoría RETIRO_ADMINISTRATIVO
    // o que contengan "RETIRO ADMINISTRATIVO" en el motivo
    const { data: movimientos, error } = await supabase
        .from('caja_movimientos')
        .select(`
            id,
            monto,
            moneda,
            motivo,
            created_at,
            categoria,
            caja_turno_id,
            usuarios!caja_movimientos_usuario_id_fkey (
                nombres,
                apellidos
            ),
            caja_turnos!caja_turno_id (
                id,
                cajas (
                    nombre
                )
            )
        `)
        .eq('tipo', 'EGRESO')
        .gte('created_at', fechaInicioISO)
        .lte('created_at', fechaFinISO)
        .or('categoria.eq.RETIRO_ADMINISTRATIVO,motivo.ilike.%RETIRO ADMINISTRATIVO%')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error al obtener retiros:', error)
        return { success: false, error: 'Error al obtener retiros administrativos' }
    }

    // Procesar y transformar datos
    let totalPen = 0
    let totalUsd = 0
    const retiros: RetiroAdministrativo[] = []

    for (const mov of movimientos || []) {
        const monto = Number(mov.monto)
        const moneda = mov.moneda as 'PEN' | 'USD'

        if (moneda === 'PEN') {
            totalPen += monto
        } else {
            totalUsd += monto
        }

        // Extraer receptor del motivo (formato: "RETIRO ADMINISTRATIVO - Entregado a: [NOMBRE]. [resto]")
        let receptor = 'No especificado'
        const matchReceptor = mov.motivo.match(/Entregado a:\s*([^.]+)/i)
        if (matchReceptor) {
            receptor = matchReceptor[1].trim()
        }

        // Datos del cajero
        const usuario = mov.usuarios as any
        const cajero = usuario ? `${usuario.nombres} ${usuario.apellidos}`.trim() : 'Desconocido'

        // Datos del turno/caja
        const turno = mov.caja_turnos as any
        const cajaNombre = turno?.cajas?.nombre || 'Sin caja'

        retiros.push({
            id: mov.id,
            fecha: mov.created_at,
            monto,
            moneda,
            motivo: mov.motivo,
            receptor,
            cajero,
            turno_id: mov.caja_turno_id,
            caja_nombre: cajaNombre
        })
    }

    return {
        success: true,
        data: {
            total_pen: totalPen,
            total_usd: totalUsd,
            cantidad: retiros.length,
            retiros
        }
    }
}

