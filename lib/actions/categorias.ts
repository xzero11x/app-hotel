'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Schema de validación para tarifas
const tarifaSchema = z.object({
    nombre: z.string().min(2, 'El nombre de la tarifa es requerido'),
    precio: z.number().min(0, 'El precio debe ser mayor a 0'),
})

// Schema de validación para categorías
const categoriaSchema = z.object({
    nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    descripcion: z.string().optional(),
    capacidad_maxima: z.number().min(1, 'La capacidad debe ser al menos 1'),
    tarifas: z.array(tarifaSchema).min(1, 'Debes agregar al menos una tarifa'),
})

export type CategoriaFormData = z.infer<typeof categoriaSchema>

export async function getCategoriasConTarifas() {
    const supabase = await createClient()

    const { data: categorias, error } = await supabase
        .from('categorias')
        .select(`
            *,
            tarifas (*)
        `)
        .order('nombre')

    if (error) {
        console.error('Error fetching categorias:', error)
        return []
    }

    return categorias
}

export async function createCategoriaConTarifas(data: CategoriaFormData) {
    try {
        const validated = categoriaSchema.parse(data)
        const supabase = await createClient()

        // Crear categoría (usando capacidad_max que es el nombre real en la BD)
        const { data: categoria, error: categoriaError } = await supabase
            .from('categorias')
            .insert({
                nombre: validated.nombre,
                descripcion: validated.descripcion,
                capacidad_max: validated.capacidad_maxima, // Mapeo de nombre
            })
            .select()
            .single()

        if (categoriaError) {
            return { error: categoriaError.message }
        }

        // Crear todas las tarifas (usando nombre y precio que son los nombres reales)
        const tarifasToInsert = validated.tarifas.map(tarifa => ({
            categoria_id: categoria.id,
            nombre: tarifa.nombre,
            precio: tarifa.precio,
            activa: true,
        }))

        const { error: tarifasError } = await supabase
            .from('tarifas')
            .insert(tarifasToInsert)

        if (tarifasError) {
            // Si falla crear tarifas, eliminar la categoría
            await supabase.from('categorias').delete().eq('id', categoria.id)
            return { error: tarifasError.message }
        }

        revalidatePath('/habitaciones/categorias')
        return { success: true }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { error: error.issues[0].message }
        }
        return { error: 'Error al crear categoría' }
    }
}

export async function updateCategoriaConTarifas(id: string, data: CategoriaFormData) {
    try {
        const validated = categoriaSchema.parse(data)
        const supabase = await createClient()

        // Actualizar categoría
        const { error: categoriaError } = await supabase
            .from('categorias')
            .update({
                nombre: validated.nombre,
                descripcion: validated.descripcion,
                capacidad_max: validated.capacidad_maxima, // Mapeo de nombre
            })
            .eq('id', id)

        if (categoriaError) {
            return { error: categoriaError.message }
        }

        // Eliminar tarifas existentes
        await supabase
            .from('tarifas')
            .delete()
            .eq('categoria_id', id)

        // Crear nuevas tarifas
        const tarifasToInsert = validated.tarifas.map(tarifa => ({
            categoria_id: id,
            nombre: tarifa.nombre,
            precio: tarifa.precio,
            activa: true,
        }))

        const { error: tarifasError } = await supabase
            .from('tarifas')
            .insert(tarifasToInsert)

        if (tarifasError) {
            return { error: tarifasError.message }
        }

        revalidatePath('/habitaciones/categorias')
        return { success: true }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { error: error.issues[0].message }
        }
        return { error: 'Error al actualizar categoría' }
    }
}

export async function deleteCategoria(id: string) {
    const supabase = await createClient()

    // Verificar si hay habitaciones usando esta categoría
    const { count } = await supabase
        .from('habitaciones')
        .select('*', { count: 'exact', head: true })
        .eq('categoria_id', id)

    if (count && count > 0) {
        return { error: `No se puede eliminar. Hay ${count} habitación(es) usando esta categoría.` }
    }

    const { error } = await supabase
        .from('categorias')
        .delete()
        .eq('id', id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/habitaciones/categorias')
    return { success: true }
}
