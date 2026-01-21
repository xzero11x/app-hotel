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
        es_titular: z.boolean().optional().default(false)
    })).optional(),
})

export async function crearCheckIn(data: any) {
    try {
        const validated = checkInSchema.parse(data)
        const supabase = await createClient()

        // 1. Obtener datos completos del huésped principal (Titular)
        // El formulario solo envía el ID, pero el RPC necesita los datos para el upsert atómico
        const { data: titular, error: titularError } = await supabase
            .from('huespedes')
            .select('*')
            .eq('id', validated.huesped_principal_id)
            .single()

        if (titularError || !titular) {
            return { error: 'No se encontró la información del huésped principal' }
        }

        // 2. Construir lista unificada de huéspedes para el RPC
        const listaHuespedes = [
            {
                ...titular,
                es_titular: true
            }
        ]

        if (validated.acompanantes && validated.acompanantes.length > 0) {
            validated.acompanantes.forEach(acomp => {
                listaHuespedes.push({
                    ...acomp,
                    es_titular: false,
                    // Campos opcionales que el RPC acepta
                    correo: null,
                    telefono: null,
                    direccion: null,
                    razon_social: null
                })
            })
        }

        // 3. Llamada Atómica al RPC (Todo o Nada)
        const { data: rpcResult, error: rpcError } = await supabase.rpc('realizar_checkin_atomico', {
            p_habitacion_id: validated.habitacion_id,
            p_fecha_entrada: validated.fecha_entrada,
            p_fecha_salida: validated.fecha_salida,
            p_precio_pactado: validated.precio_pactado,
            p_moneda_pactada: validated.moneda_pactada,
            p_huespedes: listaHuespedes,
            p_reserva_id: null, // NULL indica nueva reserva (Walk-in)
            p_canal_venta_id: validated.canal_venta_id || null
        })

        if (rpcError) {
            console.error('Error RPC crearCheckIn:', rpcError)
            return { error: `Error del sistema: ${rpcError.message}` }
        }

        // Validar respuesta lógica del RPC
        // El RPC devuelve JSONB: { success: boolean, error?: string, reserva_id?: string }
        const result = rpcResult as any

        if (!result.success) {
            return { error: result.error || 'Error al procesar el check-in' }
        }

        return { reserva: { id: result.reserva_id } }

    } catch (error) {
        console.error('Error en crearCheckIn:', error)
        if (error instanceof z.ZodError) {
            return { error: error.issues[0].message }
        }
        return { error: 'Error inesperado al crear check-in' }
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
export async function realizarCheckin(reserva_id: string) {
    const supabase = await createClient()

    try {
        // Llamada a la función atómica en base de datos
        // Esta función maneja el bloqueo de fila (FOR UPDATE) y la transición ACID
        const { data: rpcResult, error: rpcError } = await supabase.rpc('confirmar_checkin_reserva', {
            p_reserva_id: reserva_id
        })

        if (rpcError) {
            console.error('Error RPC confirmar_checkin_reserva:', rpcError)
            return {
                error: 'Error de sistema',
                message: `Error interno al procesar check-in: ${rpcError.message}`,
                code: 'ERROR_RPC'
            }
        }

        // Casting del resultado JSONB
        const result = rpcResult as any

        if (!result.success) {
            // El RPC devuelve el mensaje de error específico (ej: "Habitación sucia")
            return {
                error: 'No se puede realizar el check-in',
                message: result.error,
                code: 'VALIDACION_FALLIDA'
            }
        }

        return {
            success: true,
            message: result.message || 'Check-in realizado exitosamente'
        }

    } catch (error: any) {
        console.error('[realizarCheckin] Error inesperado:', error)
        return {
            error: 'Error de sistema',
            message: 'Hubo un problema inesperado al procesar el check-in.',
            code: 'ERROR_EXCEPTION'
        }
    }
}
