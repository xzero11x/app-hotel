'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'

// Schema de validación
const loginSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

export type LoginState = {
    error?: string
    success?: boolean
}

export async function login(prevState: LoginState | null, formData: FormData): Promise<LoginState> {
    try {
        // 1. Validar datos
        const rawData = {
            email: formData.get('email'),
            password: formData.get('password'),
        }

        const validated = loginSchema.parse(rawData)

        // 2. Autenticar con Supabase
        const supabase = await createClient()
        const { data, error } = await supabase.auth.signInWithPassword({
            email: validated.email,
            password: validated.password,
        })

        if (error) {
            return { error: error.message }
        }

        if (!data.user) {
            return { error: 'Error al iniciar sesión' }
        }

        // 3. Verificar que el usuario existe en la tabla usuarios
        const { data: usuario, error: usuarioError } = await supabase
            .from('usuarios')
            .select('id, email, nombre_completo, rol, activo')
            .eq('id', data.user.id)
            .single()

        if (usuarioError || !usuario) {
            console.error(' Login Error Debug:', {
                uid: data.user.id,
                usuarioError,
                usuario
            })
            // Usuario autenticado pero no existe en la tabla usuarios
            await supabase.auth.signOut()
            return { error: 'Usuario no autorizado' }
        }

        if (!usuario.activo) {
            await supabase.auth.signOut()
            return { error: 'Usuario inactivo. Contacte al administrador' }
        }

        return { success: true }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { error: error.issues[0].message }
        }
        return { error: 'Error al iniciar sesión' }
    }
}

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
}

export async function getUser() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return null
    }

    // Obtener datos completos del usuario
    const { data: usuario, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', user.id)
        .single()

    if (error) {
        console.error('[getUser] Error fetching user from DB:', error)
        return null
    }

    return usuario
}

