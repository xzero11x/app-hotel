'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Schema de validación para habitaciones
const habitacionSchema = z.object({
    numero: z.string().min(1, 'El número es requerido'),
    piso: z.coerce.number().min(1, 'El piso debe ser al menos 1'),
    categoria_id: z.string().uuid('Debes seleccionar una categoría válida'),
})

export type HabitacionFormData = z.infer<typeof habitacionSchema>

export async function getHabitaciones() {
    const supabase = await createClient()

    const { data: habitaciones, error } = await supabase
        .from('habitaciones')
        .select(`
            *,
            categorias (
                id,
                nombre,
                capacidad_max
            )
        `)
        .order('numero')

    if (error) {
        console.error('Error fetching habitaciones:', error)
        return []
    }

    return habitaciones
}

export async function createHabitacion(data: HabitacionFormData) {
    try {
        const validated = habitacionSchema.parse(data)
        const supabase = await createClient()

        // Verificar que no exista una habitación con el mismo número
        const { data: existing } = await supabase
            .from('habitaciones')
            .select('id')
            .eq('numero', validated.numero)
            .single()

        if (existing) {
            return { error: `Ya existe una habitación con el número ${validated.numero}` }
        }

        const { error: insertError } = await supabase
            .from('habitaciones')
            .insert({
                numero: validated.numero,
                piso: validated.piso,
                categoria_id: validated.categoria_id,
                estado_ocupacion: 'DISPONIBLE',
                estado_limpieza: 'LIMPIA',
            })

        if (insertError) {
            return { error: insertError.message }
        }

        revalidatePath('/habitaciones')
        return { success: true }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { error: error.issues[0].message }
        }
        return { error: 'Error al crear habitación' }
    }
}

export async function updateHabitacion(id: string, data: HabitacionFormData) {
    try {
        const validated = habitacionSchema.parse(data)
        const supabase = await createClient()

        // Verificar que no exista otra habitación con el mismo número
        const { data: existing } = await supabase
            .from('habitaciones')
            .select('id')
            .eq('numero', validated.numero)
            .neq('id', id)
            .single()

        if (existing) {
            return { error: `Ya existe otra habitación con el número ${validated.numero}` }
        }

        const { error } = await supabase
            .from('habitaciones')
            .update({
                numero: validated.numero,
                piso: validated.piso,
                categoria_id: validated.categoria_id,
            })
            .eq('id', id)

        if (error) {
            return { error: error.message }
        }

        revalidatePath('/habitaciones')
        return { success: true }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { error: error.issues[0].message }
        }
        return { error: 'Error al actualizar habitación' }
    }
}

export async function updateEstadoHabitacion(id: string, estado: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('habitaciones')
        .update({
            estado_ocupacion: estado,
        })
        .eq('id', id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/habitaciones')
    return { success: true }
}

export async function deleteHabitacion(id: string) {
    const supabase = await createClient()

    // Verificar si tiene reservas activas (CHECKED_IN)
    const { count } = await supabase
        .from('reservas')
        .select('*', { count: 'exact', head: true })
        .eq('habitacion_id', id)
        .eq('estado', 'CHECKED_IN')

    if (count && count > 0) {
        return { error: 'No se puede eliminar. La habitación tiene reservas activas (check-in).' }
    }

    const { error } = await supabase
        .from('habitaciones')
        .delete()
        .eq('id', id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/habitaciones')
    return { success: true }
}
