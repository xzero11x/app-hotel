'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ========================================
// TYPES
// ========================================

export type HabitacionLimpieza = {
    id: string
    numero: string
    piso: number
    estado_ocupacion: 'LIBRE' | 'OCUPADA' | 'RESERVADA'
    // Calculados
    tipo_limpieza: 'LIMPIEZA_TOTAL' | 'MANTENIMIENTO' | 'OCUPADO'
    puede_entrar: boolean
    huesped_presente: boolean | null
}

// ========================================
// OBTENER HABITACIONES SUCIAS
// ========================================

export async function getHabitacionesSucias(): Promise<HabitacionLimpieza[]> {
    const supabase = await createClient()

    // Obtener habitaciones sucias con info de ocupación
    const { data: habitaciones, error } = await supabase
        .from('habitaciones')
        .select(`
            id,
            numero,
            piso,
            estado_ocupacion,
            estado_limpieza
        `)
        .eq('estado_limpieza', 'SUCIA')
        .order('piso', { ascending: true })
        .order('numero', { ascending: true })

    if (error) {
        console.error('Error al obtener habitaciones sucias:', error)
        return []
    }

    // Para cada habitación ocupada, verificar si el huésped está presente
    const resultado: HabitacionLimpieza[] = []

    for (const hab of habitaciones) {
        let huesped_presente: boolean | null = null
        let tipo_limpieza: HabitacionLimpieza['tipo_limpieza'] = 'LIMPIEZA_TOTAL'
        let puede_entrar = true

        if (hab.estado_ocupacion === 'OCUPADA') {
            // Buscar reserva activa para verificar huésped_presente
            const { data: reserva } = await supabase
                .from('reservas')
                .select('id, huesped_presente')
                .eq('habitacion_id', hab.id)
                .eq('estado', 'CHECKED_IN')
                .single()

            if (reserva) {
                huesped_presente = reserva.huesped_presente ?? true // Default: presente

                if (huesped_presente) {
                    tipo_limpieza = 'OCUPADO'
                    puede_entrar = false
                } else {
                    tipo_limpieza = 'MANTENIMIENTO'
                    puede_entrar = true
                }
            }
        } else {
            // LIBRE + SUCIA = Limpieza Total (post-checkout)
            tipo_limpieza = 'LIMPIEZA_TOTAL'
            puede_entrar = true
        }

        resultado.push({
            id: hab.id,
            numero: hab.numero,
            piso: hab.piso,
            estado_ocupacion: hab.estado_ocupacion,
            tipo_limpieza,
            puede_entrar,
            huesped_presente
        })
    }

    return resultado
}

// ========================================
// MARCAR HABITACIÓN COMO LIMPIA
// ========================================

export async function marcarLimpia(habitacionId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()

    const { error } = await supabase
        .from('habitaciones')
        .update({ estado_limpieza: 'LIMPIA' })
        .eq('id', habitacionId)

    if (error) {
        console.error('Error al marcar habitación limpia:', error)
        return { success: false, error: 'No se pudo actualizar el estado' }
    }

    // NOTA: No usar revalidatePath - Realtime actualiza ambas páginas automáticamente
    return { success: true }
}
