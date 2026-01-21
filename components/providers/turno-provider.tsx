'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import { getTurnoActivo, getCajasDisponibles, type DetalleTurno, type Caja } from '@/lib/actions/cajas'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

type TurnoContextValue = {
    loading: boolean
    turno: DetalleTurno | null
    hasActiveTurno: boolean
    refetchTurno: () => Promise<void>
    // Pre-cargados para el modal de apertura
    cajasDisponibles: Caja[]
    loadingCajas: boolean
    userId: string | null
    // Modo observador (admin sin turno)
    modoObservador: boolean
    setModoObservador: (modo: boolean) => void
}

const TurnoContext = createContext<TurnoContextValue | null>(null)

export function TurnoProvider({ children }: { children: ReactNode }) {
    const [loading, setLoading] = useState(true)
    const [turno, setTurno] = useState<DetalleTurno | null>(null)
    const [cajasDisponibles, setCajasDisponibles] = useState<Caja[]>([])
    const [loadingCajas, setLoadingCajas] = useState(false)
    const [userId, setUserId] = useState<string | null>(null)
    const [modoObservador, setModoObservador] = useState(false)
    const channelRef = useRef<RealtimeChannel | null>(null)

    const fetchTurno = useCallback(async (showLoading = true) => {
        console.log('[TurnoProvider] fetchTurno iniciado, showLoading:', showLoading)
        if (showLoading) setLoading(true)

        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                console.log('[TurnoProvider] No hay usuario autenticado')
                setTurno(null)
                setUserId(null)
                setLoading(false)
                return
            }

            setUserId(user.id)
            console.log('[TurnoProvider] Buscando turno para usuario:', user.id)

            const turnoActivo = await getTurnoActivo(user.id)
            console.log('[TurnoProvider] Resultado getTurnoActivo:', turnoActivo ? 'Turno encontrado' : 'Sin turno')
            setTurno(turnoActivo)

            // Si NO hay turno, pre-cargar cajas en paralelo para que el modal esté listo
            if (!turnoActivo) {
                console.log('[TurnoProvider] Sin turno, pre-cargando cajas...')
                setLoadingCajas(true)
                const cajasResult = await getCajasDisponibles()
                if (cajasResult.success && cajasResult.data) {
                    setCajasDisponibles(cajasResult.data)
                }
                setLoadingCajas(false)
            }
        } catch (error) {
            console.error('[TurnoProvider] Error fetching turno:', error)
            setTurno(null)
        } finally {
            setLoading(false)
            console.log('[TurnoProvider] fetchTurno completado')
        }
    }, [])

    // Setup inicial y realtime (como fallback)
    useEffect(() => {
        fetchTurno()

        // Intentar suscripción realtime (puede no funcionar si la tabla no está habilitada)
        const supabase = createClient()
        const channel = supabase
            .channel('turno-global-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'caja_turnos' },
                () => {
                    console.log('[TurnoContext] Realtime event received')
                    fetchTurno(false)
                }
            )
            .subscribe((status) => {
                console.log('[TurnoContext] Subscription status:', status)
            })

        channelRef.current = channel

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current)
            }
        }
    }, [fetchTurno])

    const value: TurnoContextValue = {
        loading,
        turno,
        hasActiveTurno: !!turno,
        refetchTurno: () => fetchTurno(false),
        // Datos pre-cargados para el modal
        cajasDisponibles,
        loadingCajas,
        userId,
        // Modo observador (solo lectura)
        modoObservador,
        setModoObservador
    }

    return (
        <TurnoContext.Provider value={value}>
            {children}
        </TurnoContext.Provider>
    )
}

export function useTurnoContext() {
    const context = useContext(TurnoContext)
    if (!context) {
        throw new Error('useTurnoContext debe usarse dentro de un TurnoProvider')
    }
    return context
}

