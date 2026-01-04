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
            .eq('num_doc', numDoc)
            .eq('tipo_doc', tipoDoc)
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
    tipo_doc: z.string(),
    num_doc: z.string().min(1, 'El número de documento es requerido'),
    nombres: z.string().min(1, 'Los nombres son requeridos'),
    apellidos: z.string().min(1, 'Los apellidos son requeridos'),
    email: z.string().email('Email inválido').optional().nullable(),
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
            .eq('num_doc', validated.num_doc)
            .eq('tipo_doc', validated.tipo_doc)
            .single()

        if (existing) {
            // Actualizar
            const { data: updated, error } = await supabase
                .from('huespedes')
                .update({
                    ...validated,
                    es_frecuente: true, // Marcarlo como frecuente
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
                    es_frecuente: false,
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

// Schema para crear estadía
const estadiaSchema = z.object({
    habitacion_id: z.string().uuid(),
    huesped_principal_id: z.string().uuid(),
    tarifa_id: z.string().uuid(),
    fecha_ingreso: z.string(),
    fecha_salida_prevista: z.string(),
    precio_noche_final: z.number().positive(),
    num_huespedes: z.number().int().positive(),
    acompanantes: z.array(z.object({
        nombres: z.string(),
        apellidos: z.string(),
        tipo_doc: z.string(),
        num_doc: z.string(),
    })).optional(),
})

export async function crearCheckIn(data: any) {
    try {
        const validated = estadiaSchema.parse(data)
        const supabase = await createClient()

        // Verificar que la habitación esté disponible
        const { data: habitacion, error: habitacionError } = await supabase
            .from('habitaciones')
            .select('estado_ocupacion')
            .eq('id', validated.habitacion_id)
            .single()

        if (habitacionError || !habitacion) {
            return { error: 'Habitación no encontrada' }
        }

        if (habitacion.estado_ocupacion !== 'DISPONIBLE') {
            return { error: 'La habitación no está disponible' }
        }

        // Crear la estadía
        const { data: estadia, error: estadiaError } = await supabase
            .from('estadias')
            .insert({
                habitacion_id: validated.habitacion_id,
                huesped_principal_id: validated.huesped_principal_id,
                tarifa_id: validated.tarifa_id,
                fecha_ingreso: validated.fecha_ingreso,
                fecha_salida_prevista: validated.fecha_salida_prevista,
                precio_noche_final: validated.precio_noche_final,
                num_huespedes: validated.num_huespedes,
                estado: 'ACTIVA',
            })
            .select()
            .single()

        if (estadiaError) {
            console.error('Error al crear estadía:', estadiaError)
            return { error: 'Error al crear la estadía' }
        }

        // Asociar huésped principal
        await supabase
            .from('estadia_huespedes')
            .insert({
                estadia_id: estadia.id,
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
                    .eq('num_doc', acomp.num_doc)
                    .eq('tipo_doc', acomp.tipo_doc)
                    .single()

                let acompId = acompHuesped?.id

                if (!acompId) {
                    const { data: newAcomp } = await supabase
                        .from('huespedes')
                        .insert({
                            nombres: acomp.nombres,
                            apellidos: acomp.apellidos,
                            tipo_doc: acomp.tipo_doc,
                            num_doc: acomp.num_doc,
                        })
                        .select('id')
                        .single()

                    acompId = newAcomp?.id
                }

                if (acompId) {
                    await supabase
                        .from('estadia_huespedes')
                        .insert({
                            estadia_id: estadia.id,
                            huesped_id: acompId,
                            es_titular: false,
                        })
                }
            }
        }

        // Actualizar estado de la habitación
        await supabase
            .from('habitaciones')
            .update({ estado_ocupacion: 'OCUPADA' })
            .eq('id', validated.habitacion_id)

        return { estadia }
    } catch (error) {
        console.error('Error en crearCheckIn:', error)
        if (error instanceof z.ZodError) {
            return { error: error.issues[0].message }
        }
        return { error: 'Error al crear check-in' }
    }
}

// Crear pago
const pagoSchema = z.object({
    estadia_id: z.string().uuid(),
    monto: z.number().positive(),
    metodo_pago: z.enum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'YAPE', 'PLIN']),
    concepto: z.string().optional(),
})

export async function registrarPago(data: any) {
    try {
        const validated = pagoSchema.parse(data)
        const supabase = await createClient()

        const { data: pago, error } = await supabase
            .from('pagos')
            .insert({
                estadia_id: validated.estadia_id,
                monto: validated.monto,
                metodo_pago: validated.metodo_pago,
                notas: validated.concepto || 'Pago de check-in',
                fecha_pago: new Date().toISOString(),
            })
            .select()
            .single()

        if (error) {
            console.error('Error detallado al registrar pago:', error)
            return { error: `Error al registrar pago: ${error.message}` }
        }

        return { pago }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { error: error.issues[0].message }
        }
        return { error: 'Error al procesar pago' }
    }
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
