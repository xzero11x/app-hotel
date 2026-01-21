'use client'

// Hook para gestión de datos del Rack - OPTIMIZADO PARA REALTIME
import { useEffect, useState, useCallback, useRef, useTransition } from 'react'
import { addDays, startOfDay } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import {
  getRackHabitaciones,
  getRackReservas,
  getRackKPIs,
  getTareasDelDia,
} from '@/lib/actions/rack'
import type { RackHabitacion, RackReserva, RackKPIs } from '@/types/rack'

type TareasDelDia = {
  checkins: any[]
  checkouts: any[]
}

// Singleton para el cliente de Supabase (evita múltiples instancias)
let supabaseInstance: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!supabaseInstance) {
    supabaseInstance = createClient()
  }
  return supabaseInstance
}

export function useRackData(daysRange = 30) {
  const [habitaciones, setHabitaciones] = useState<RackHabitacion[]>([])
  const [reservas, setReservas] = useState<RackReserva[]>([])
  const [kpis, setKpis] = useState<RackKPIs>({
    llegadas: 0,
    salidas: 0,
    sucias: 0,
    ocupadas: 0
  })
  const [tareas, setTareas] = useState<TareasDelDia>({
    checkins: [],
    checkouts: []
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Para transiciones no urgentes (evita bloquear la UI)
  const [isPending, startTransition] = useTransition()

  // Flag para saber si ya se cargaron las habitaciones
  const habitacionesCargadas = useRef(false)
  // Referencia a las habitaciones para uso en callbacks de Realtime
  const habitacionesRef = useRef<RackHabitacion[]>([])
  
  // Mantener referencia sincronizada
  useEffect(() => {
    habitacionesRef.current = habitaciones
  }, [habitaciones])

  // Calcular rango de fechas: 3 días de contexto pasado, el resto futuro
  const today = startOfDay(new Date())
  const PAST_DAYS_CONTEXT = 3
  const startDate = addDays(today, -PAST_DAYS_CONTEXT)
  const endDate = addDays(today, daysRange - PAST_DAYS_CONTEXT)

  // Función para cargar solo datos dinámicos (reservas, kpis, tareas)
  const loadDynamicData = useCallback(async () => {
    const [reservasData, kpisData, tareasData] = await Promise.all([
      getRackReservas(startDate, endDate),
      getRackKPIs(),
      getTareasDelDia()
    ])
    // Usar startTransition para que no bloquee interacciones del usuario
    startTransition(() => {
      setReservas(reservasData)
      setKpis(kpisData)
      setTareas(tareasData)
    })
  }, [startDate.toISOString(), endDate.toISOString()])

  // Carga inicial: habitaciones (1 vez) + datos dinámicos
  useEffect(() => {
    async function loadInitialData() {
      try {
        setIsLoading(true)
        setError(null)

        // Cargar habitaciones solo si no se han cargado antes
        if (!habitacionesCargadas.current) {
          const [habitacionesData, reservasData, kpisData, tareasData] = await Promise.all([
            getRackHabitaciones(),
            getRackReservas(startDate, endDate),
            getRackKPIs(),
            getTareasDelDia()
          ])
          setHabitaciones(habitacionesData)
          setReservas(reservasData)
          setKpis(kpisData)
          setTareas(tareasData)
          habitacionesCargadas.current = true
        } else {
          // Si ya tenemos habitaciones, solo cargar datos dinámicos
          await loadDynamicData()
        }
      } catch (err) {
        console.error('Error loading rack data:', err)
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setIsLoading(false)
      }
    }

    loadInitialData()
  }, [daysRange]) // Solo re-ejecutar si cambia el rango

  // ==========================================
  // SUPABASE REALTIME: Actualizaciones instantáneas
  // Optimizado para máxima velocidad
  // ==========================================
  useEffect(() => {
    const supabase = getSupabase()

    // Canal único para habitaciones - CRÍTICO: Solo escuchar UPDATEs
    const habitacionesChannel = supabase
      .channel('rack-habitaciones-v2')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'habitaciones' },
        (payload) => {
          console.log('[Realtime] Habitación actualizada:', payload.new.id)
          
          // CRÍTICO: Actualizar SOLO los campos que cambiaron, preservando relaciones
          setHabitaciones(prev => prev.map(h => {
            if (h.id !== payload.new.id) return h
            
            // Fusionar SOLO campos de la tabla, preservar relaciones existentes
            return {
              ...h,
              estado_limpieza: (payload.new as any).estado_limpieza ?? h.estado_limpieza,
              estado_ocupacion: (payload.new as any).estado_ocupacion ?? h.estado_ocupacion,
              estado_servicio: (payload.new as any).estado_servicio ?? h.estado_servicio,
              numero: (payload.new as any).numero ?? h.numero,
              piso: (payload.new as any).piso ?? h.piso,
              // NO tocar las relaciones: tipos_habitacion, categorias_habitacion
            }
          }))
          
          // Actualizar KPIs en background (no bloqueante)
          startTransition(() => {
            getRackKPIs().then(setKpis).catch(console.error)
          })
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Habitaciones channel:', status)
      })

    // Canal para reservas - escuchar todos los eventos
    const reservasChannel = supabase
      .channel('rack-reservas-v2')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservas' },
        (payload) => {
          console.log('[Realtime] Reserva modificada:', payload.eventType, payload.new)
          
          // Para CHECKOUT: La reserva pasa a CHECKED_OUT y debe eliminarse del rack
          // Actualizamos inmediatamente sin startTransition para que sea instantáneo
          if (payload.eventType === 'UPDATE') {
            const newData = payload.new as any
            
            // Si la reserva cambió a CHECKED_OUT, eliminarla del estado local inmediatamente
            if (newData.estado === 'CHECKED_OUT' || newData.estado === 'CANCELADA') {
              console.log('[Realtime] Checkout detectado, eliminando reserva y actualizando habitación:', newData.habitacion_id)
              
              setReservas(prev => prev.filter(r => r.id !== newData.id))
              
              // Actualizar tareas también
              setTareas(prev => ({
                checkins: prev.checkins.filter((c: any) => c.id !== newData.id),
                checkouts: prev.checkouts.filter((c: any) => c.id !== newData.id)
              }))
              
              // CRÍTICO: También actualizar la habitación a LIBRE y SUCIA inmediatamente
              // porque el evento de habitaciones puede llegar después o no llegar
              if (newData.habitacion_id) {
                setHabitaciones(prev => prev.map(h => {
                  if (h.id !== newData.habitacion_id) return h
                  console.log('[Realtime] Actualizando habitación a LIBRE/SUCIA:', h.numero)
                  return {
                    ...h,
                    estado_ocupacion: 'LIBRE',
                    estado_limpieza: 'SUCIA'
                  }
                }))
                
                // Actualizar KPIs
                startTransition(() => {
                  getRackKPIs().then(setKpis).catch(console.error)
                })
              }
              return
            }
            
            // Si la reserva cambió a CHECKED_IN (check-in realizado)
            if (newData.estado === 'CHECKED_IN') {
              console.log('[Realtime] Check-in detectado, actualizando habitación a OCUPADA:', newData.habitacion_id)
              
              // Actualizar la reserva existente
              setReservas(prev => {
                const exists = prev.find(r => r.id === newData.id)
                if (exists) {
                  return prev.map(r => r.id === newData.id ? { ...r, estado: 'CHECKED_IN', huesped_presente: newData.huesped_presente ?? true } : r)
                }
                // Si no existe, recargar todo (nueva reserva con check-in directo)
                loadDynamicData().catch(console.error)
                return prev
              })
              
              // CRÍTICO: También actualizar la habitación a OCUPADA inmediatamente
              if (newData.habitacion_id) {
                setHabitaciones(prev => prev.map(h => {
                  if (h.id !== newData.habitacion_id) return h
                  console.log('[Realtime] Actualizando habitación a OCUPADA:', h.numero)
                  return {
                    ...h,
                    estado_ocupacion: 'OCUPADA'
                  }
                }))
                
                // Actualizar KPIs
                startTransition(() => {
                  getRackKPIs().then(setKpis).catch(console.error)
                })
              }
              return
            }
          }
          
          // Para otros casos (INSERT de nuevas reservas, etc), recargar en background
          startTransition(() => {
            loadDynamicData().catch(console.error)
          })
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Reservas channel:', status)
      })

    // Cleanup al desmontar - IMPORTANTE para evitar memory leaks
    return () => {
      console.log('[Realtime] Limpiando canales...')
      supabase.removeChannel(habitacionesChannel)
      supabase.removeChannel(reservasChannel)
    }
  }, [loadDynamicData])

  // ==========================================
  // ELIMINADO: Polling innecesario
  // Realtime es suficiente para actualizaciones instantáneas
  // ==========================================

  // Función de refetch optimizada: solo recarga datos dinámicos
  const refetch = useCallback(async () => {
    try {
      setIsRefreshing(true)
      await loadDynamicData()
    } catch (err) {
      console.error('Error refreshing rack data:', err)
    } finally {
      setIsRefreshing(false)
    }
  }, [loadDynamicData])

  // Función para forzar recarga de habitaciones (raro, pero disponible)
  const refetchHabitaciones = useCallback(async () => {
    try {
      const habitacionesData = await getRackHabitaciones()
      setHabitaciones(habitacionesData)
    } catch (err) {
      console.error('Error refreshing habitaciones:', err)
    }
  }, [])

  // ==========================================
  // ACTUALIZACIÓN OPTIMISTA: Actualizar UI ANTES de confirmar BD
  // CRÍTICO para UX fluida y veloz
  // ==========================================
  
  /**
   * Actualiza una habitación localmente de forma INMEDIATA
   * Usar antes de llamar al servidor
   */
  const updateHabitacionOptimistic = useCallback((
    habitacionId: string, 
    updates: Partial<Pick<RackHabitacion, 'estado_limpieza' | 'estado_ocupacion' | 'estado_servicio'>>
  ) => {
    setHabitaciones(prev => prev.map(h =>
      h.id === habitacionId ? { ...h, ...updates } : h
    ))
    
    // También actualizar KPIs localmente si cambia limpieza u ocupación
    if (updates.estado_limpieza || updates.estado_ocupacion) {
      setKpis(prev => {
        const newKpis = { ...prev }
        
        // Encontrar estado anterior
        const habitacionAnterior = habitacionesRef.current.find(h => h.id === habitacionId)
        
        if (updates.estado_limpieza && habitacionAnterior) {
          // Ajustar contador de sucias
          if (updates.estado_limpieza === 'SUCIA' && habitacionAnterior.estado_limpieza !== 'SUCIA') {
            newKpis.sucias = (prev.sucias || 0) + 1
          } else if (updates.estado_limpieza !== 'SUCIA' && habitacionAnterior.estado_limpieza === 'SUCIA') {
            newKpis.sucias = Math.max(0, (prev.sucias || 0) - 1)
          }
        }
        
        if (updates.estado_ocupacion && habitacionAnterior) {
          // Ajustar contador de ocupadas
          if (updates.estado_ocupacion === 'OCUPADA' && habitacionAnterior.estado_ocupacion !== 'OCUPADA') {
            newKpis.ocupadas = (prev.ocupadas || 0) + 1
          } else if (updates.estado_ocupacion !== 'OCUPADA' && habitacionAnterior.estado_ocupacion === 'OCUPADA') {
            newKpis.ocupadas = Math.max(0, (prev.ocupadas || 0) - 1)
          }
        }
        
        return newKpis
      })
    }
  }, [])

  /**
   * Revierte una actualización optimista si el servidor falla
   */
  const revertHabitacionOptimistic = useCallback((
    habitacionId: string, 
    originalData: Partial<Pick<RackHabitacion, 'estado_limpieza' | 'estado_ocupacion' | 'estado_servicio'>>
  ) => {
    setHabitaciones(prev => prev.map(h =>
      h.id === habitacionId ? { ...h, ...originalData } : h
    ))
    
    // Recargar KPIs reales del servidor
    startTransition(() => {
      getRackKPIs().then(setKpis).catch(console.error)
    })
  }, [])

  /**
   * Actualiza una reserva localmente (para huesped_presente)
   */
  const updateReservaOptimistic = useCallback((
    reservaId: string,
    updates: Partial<Pick<RackReserva, 'huesped_presente'>>
  ) => {
    setReservas(prev => prev.map(r =>
      r.id === reservaId ? { ...r, ...updates } : r
    ))
  }, [])

  /**
   * Elimina una reserva del estado local (para checkout/cancelación)
   */
  const removeReservaOptimistic = useCallback((reservaId: string) => {
    setReservas(prev => prev.filter(r => r.id !== reservaId))
    // También eliminar de tareas
    setTareas(prev => ({
      checkins: prev.checkins.filter((c: any) => c.id !== reservaId),
      checkouts: prev.checkouts.filter((c: any) => c.id !== reservaId)
    }))
  }, [])

  return {
    habitaciones,
    reservas,
    kpis,
    tareas,
    startDate,
    endDate,
    isLoading,
    isRefreshing,
    isPending, // Nuevo: indica si hay actualizaciones pendientes en background
    error,
    refetch,              // Solo recarga datos dinámicos (optimizado)
    refetchHabitaciones,  // Para casos raros donde cambien las habitaciones
    // Funciones para actualizaciones optimistas - USAR SIEMPRE
    updateHabitacionOptimistic,
    revertHabitacionOptimistic,
    updateReservaOptimistic,
    removeReservaOptimistic,
  }
}
