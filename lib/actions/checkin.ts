'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Schema para buscar huésped
export async function buscarHuespedPorDocumento(numDoc: string, tipoDoc: string = 'DNI') {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('huespedes')
            .select('*')
            .eq('numero_documento', numDoc)
            .eq('tipo_documento', tipoDoc)
            .single()

        if (error && error.code !== 'PGRST116') {
            return { error: 'Error al buscar huésped' }
        }

        return { huesped: data }
    } catch (error) {
        return { error: 'Error al buscar huésped' }
    }
}

// Schema para crear/actualizar huésped
const huespedSchema = z.object({
    tipo_documento: z.string(),
    numero_documento: z.string().min(1, 'El número de documento es requerido'),
    nombres: z.string().min(1, 'Los nombres son requeridos'),
    apellidos: z.string().min(1, 'Los apellidos son requeridos'),
    correo: z.string().email('Email inválido').optional().nullable(),
    telefono: z.string().optional().nullable(),
    nacionalidad: z.string().optional().nullable(),
    ciudad_procedencia: z.string().optional().nullable(),
    direccion: z.string().optional().nullable(),
    razon_social: z.string().optional().nullable(),
})

export async function crearOActualizarHuesped(data: any) {
    try {
        const validated = huespedSchema.parse(data)
        const supabase = await createClient()

        // Verificar si existe
        const { data: existing } = await supabase
            .from('huespedes')
            .select('id')
            .eq('numero_documento', validated.numero_documento)
            .eq('tipo_documento', validated.tipo_documento)
            .single()

        if (existing) {
            // Actualizar
            const { data: updated, error } = await supabase
                .from('huespedes')
                .update({
                    ...validated,
                })
                .eq('id', existing.id)
                .select()
                .single()

            if (error) {
                return { error: 'Error al actualizar huésped' }
            }

            return { huesped: updated }
        } else {
            // Crear nuevo
            const { data: created, error } = await supabase
                .from('huespedes')
                .insert({
                    ...validated,
                })
                .select()
                .single()

            if (error) {
                return { error: 'Error al crear huésped' }
            }

            return { huesped: created }
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { error: error.issues[0].message }
        }
        return { error: 'Error al procesar huésped' }
    }
}

// Schema para crear reserva con check-in inmediato
const checkInSchema = z.object({
    habitacion_id: z.string().uuid(),
    huesped_principal_id: z.string().uuid(),
    canal_venta_id: z.string().uuid().optional(),
    fecha_entrada: z.string(),
    fecha_salida: z.string(),
    precio_pactado: z.number().positive(),
    moneda_pactada: z.enum(['PEN', 'USD']).default('PEN'),
    acompanantes: z.array(z.object({
        nombres: z.string(),
        apellidos: z.string(),
        tipo_documento: z.string(),
        numero_documento: z.string(),
        nacionalidad: z.string().optional(),
    })).optional(),
})

export async function crearCheckIn(data: any) {
    try {
        const validated = checkInSchema.parse(data)
        const supabase = await createClient()

        // Verificar que la habitación esté disponible
        const { data: habitacion, error: habitacionError } = await supabase
            .from('habitaciones')
            .select('estado_ocupacion, estado_servicio')
            .eq('id', validated.habitacion_id)
            .single()

        if (habitacionError || !habitacion) {
            return { error: 'Habitación no encontrada' }
        }

        if (habitacion.estado_ocupacion !== 'LIBRE') {
            return { error: 'La habitación no está disponible' }
        }

        if (habitacion.estado_servicio !== 'OPERATIVA') {
            return { error: 'La habitación está fuera de servicio' }
        }

        // Generar código de reserva
        const codigo_reserva = `RSV-${Date.now().toString().slice(-8)}`

        // Crear la reserva con estado CHECKED_IN directamente
        const { data: reserva, error: reservaError } = await supabase
            .from('reservas')
            .insert({
                codigo_reserva: codigo_reserva,
                habitacion_id: validated.habitacion_id,
                canal_venta_id: validated.canal_venta_id,
                fecha_entrada: validated.fecha_entrada,
                fecha_salida: validated.fecha_salida,
                precio_pactado: validated.precio_pactado,
                moneda_pactada: validated.moneda_pactada,
                estado: 'CHECKED_IN',
                check_in_real: new Date().toISOString(),
                huesped_presente: true,
            })
            .select()
            .single()

        if (reservaError) {
            console.error('Error al crear reserva:', reservaError)
            return { error: 'Error al crear la reserva con check-in' }
        }

        // Asociar huésped principal
        await supabase
            .from('reserva_huespedes')
            .insert({
                reserva_id: reserva.id,
                huesped_id: validated.huesped_principal_id,
                es_titular: true,
            })

        // Asociar acompañantes si hay
        if (validated.acompanantes && validated.acompanantes.length > 0) {
            for (const acomp of validated.acompanantes) {
                // Crear o buscar acompañante
                const { data: acompHuesped } = await supabase
                    .from('huespedes')
                    .select('id')
                    .eq('numero_documento', acomp.numero_documento)
                    .eq('tipo_documento', acomp.tipo_documento)
                    .single()

                let acompId = acompHuesped?.id

                if (!acompId) {
                    const { data: newAcomp } = await supabase
                        .from('huespedes')
                        .insert({
                            nombres: acomp.nombres,
                            apellidos: acomp.apellidos,
                            tipo_documento: acomp.tipo_documento,
                            numero_documento: acomp.numero_documento,
                            nacionalidad: acomp.nacionalidad || 'PE',
                        })
                        .select('id')
                        .single()

                    acompId = newAcomp?.id
                }

                if (acompId) {
                    await supabase
                        .from('reserva_huespedes')
                        .insert({
                            reserva_id: reserva.id,
                            huesped_id: acompId,
                            es_titular: false,
                        })
                }
            }
        }

        // Actualizar estado de la habitación a OCUPADA + LIMPIA
        // NOTA: Se marca LIMPIA porque el huésped acaba de entrar
        // Se marcará SUCIA después del check-out
        await supabase
            .from('habitaciones')
            .update({ 
                estado_ocupacion: 'OCUPADA',
                estado_limpieza: 'LIMPIA'
            })
            .eq('id', validated.habitacion_id)

        return { reserva }
    } catch (error) {
        console.error('Error en crearCheckIn:', error)
        if (error instanceof z.ZodError) {
            return { error: error.issues[0].message }
        }
        return { error: 'Error al crear check-in' }
    }
}

// NOTA: La función registrarPago ahora está en lib/actions/pagos.ts
// Esta función aquí está deprecada y debe removerse
// Usa: import { registrarPago } from '@/lib/actions/pagos'

export async function registrarPagoLegacy(data: any) {
    console.warn('⚠️ registrarPagoLegacy está deprecada. Usa lib/actions/pagos.ts')
    return { error: 'Esta función está deprecada. Usa lib/actions/pagos.ts' }
}

// Obtener habitaciones disponibles con sus tarifas
export async function getHabitacionesDisponibles() {
    try {
        const supabase = await createClient()

        // Primero obtener habitaciones disponibles con su categoría
        const { data: habitaciones, error: habError } = await supabase
            .from('habitaciones')
            .select(`
                *,
                categoria:categorias!categoria_id (
                    id,
                    nombre,
                    descripcion,
                    capacidad_max
                )
            `)
            .eq('estado_ocupacion', 'DISPONIBLE')
            .order('numero')

        if (habError) {
            console.error('Error al cargar habitaciones:', habError)
            return { error: 'Error al cargar habitaciones', habitaciones: [] }
        }

        if (!habitaciones || habitaciones.length === 0) {
            return { habitaciones: [] }
        }

        // Obtener las tarifas para cada categoría
        const categoriasIds = habitaciones
            .map((h: any) => h.categoria?.id)
            .filter(Boolean)

        const { data: tarifas, error: tarifasError } = await supabase
            .from('tarifas')
            .select('*')
            .in('categoria_id', categoriasIds)

        if (tarifasError) {
            console.error('Error al cargar tarifas:', tarifasError)
        }

        // Combinar habitaciones con sus tarifas
        const habitacionesConTarifas = habitaciones.map((hab: any) => ({
            ...hab,
            categorias: hab.categoria ? {
                ...hab.categoria,
                tarifas: tarifas?.filter((t: any) => t.categoria_id === hab.categoria.id) || []
            } : null
        }))

        return { habitaciones: habitacionesConTarifas }
    } catch (error) {
        console.error('Error en getHabitacionesDisponibles:', error)
        return { error: 'Error al cargar habitaciones', habitaciones: [] }
    }
}

// ========================================
// REALIZAR CHECK-IN (Cambio de estado RESERVADA → CHECKED_IN)
// ========================================
// NOTA: Esta función implementa lógica EXPLÍCITA sin depender de triggers
// según documento de requerimientos (sección 6.3.1)
export async function realizarCheckin(reserva_id: string) {
    const supabase = await createClient()

    try {
        // 1️⃣ OBTENER DATOS DE LA RESERVA
        const { data: reserva, error: reservaError } = await supabase
            .from('reservas')
            .select('id, habitacion_id, estado')
            .eq('id', reserva_id)
            .single()

        if (reservaError || !reserva) {
            return { 
                error: 'Reserva no encontrada',
                code: 'RESERVA_NO_ENCONTRADA' 
            }
        }

        // Validar que esté en estado RESERVADA
        if (reserva.estado !== 'RESERVADA') {
            return {
                error: 'Estado inválido',
                message: `No se puede hacer check-in. La reserva está en estado: ${reserva.estado}`,
                code: 'ESTADO_INVALIDO'
            }
        }

        // 2️⃣ VALIDAR HABITACIÓN
        const { data: habitacion, error: habError } = await supabase
            .from('habitaciones')
            .select('estado_limpieza, estado_servicio, estado_ocupacion')
            .eq('id', reserva.habitacion_id)
            .single()

        if (habError || !habitacion) {
            return { 
                error: 'Habitación no encontrada',
                code: 'HABITACION_NO_ENCONTRADA' 
            }
        }

        // Validar estado de servicio
        if (habitacion.estado_servicio !== 'OPERATIVA') {
            return {
                error: 'Habitación no operativa',
                message: `La habitación está en ${habitacion.estado_servicio}. Por favor, contacte a mantenimiento.`,
                code: 'HABITACION_NO_OPERATIVA'
            }
        }

        // Validar estado de limpieza
        if (habitacion.estado_limpieza !== 'LIMPIA') {
            return {
                error: 'Habitación requiere limpieza',
                message: 'Por favor, solicite al área de housekeeping que limpie la habitación primero.',
                code: 'HABITACION_SUCIA'
            }
        }

        // Validar que no esté ocupada (doble check)
        if (habitacion.estado_ocupacion === 'OCUPADA') {
            return {
                error: 'Habitación ocupada',
                message: 'La habitación ya está ocupada por otra reserva.',
                code: 'HABITACION_OCUPADA'
            }
        }

        // 3️⃣ ACTUALIZAR RESERVA (EXPLÍCITO)
        const { error: updateReservaError } = await supabase
            .from('reservas')
            .update({ 
                estado: 'CHECKED_IN',
                check_in_real: new Date().toISOString(),
                huesped_presente: true
            })
            .eq('id', reserva_id)

        if (updateReservaError) {
            throw new Error(`Error al actualizar reserva: ${updateReservaError.message}`)
        }

        // 4️⃣ ACTUALIZAR HABITACIÓN (EXPLÍCITO)
        const { error: updateHabitacionError } = await supabase
            .from('habitaciones')
            .update({ 
                estado_ocupacion: 'OCUPADA',
                estado_limpieza: 'LIMPIA' // Mantiene limpia al entrar
            })
            .eq('id', reserva.habitacion_id)

        if (updateHabitacionError) {
            // Rollback: revertir estado de reserva
            await supabase
                .from('reservas')
                .update({ estado: 'RESERVADA', check_in_real: null, huesped_presente: false })
                .eq('id', reserva_id)
            
            throw new Error(`Error al actualizar habitación: ${updateHabitacionError.message}`)
        }

        return { 
            success: true, 
            message: 'Check-in realizado exitosamente' 
        }
    } catch (error: any) {
        console.error('[realizarCheckin] Error:', error)
        return {
            error: 'Error de sistema',
            message: 'Hubo un problema al procesar el check-in. Por favor, intente nuevamente.',
            code: 'ERROR_SISTEMA'
        }
    }
}
