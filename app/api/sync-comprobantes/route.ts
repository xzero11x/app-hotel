import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consultarEstadoNubefact } from '@/lib/services/nubefact'
import { logger } from '@/lib/logger'

/**
 * API Route: Sincronización de Comprobantes PENDIENTES
 * 
 * Consulta el estado de comprobantes pendientes en SUNAT vía Nubefact
 * y actualiza la base de datos.
 * 
 * Uso: 
 * - Manual: POST /api/sync-comprobantes con Authorization: Bearer <CRON_SECRET>
 * - Cron: Configurar en Vercel/Railway cada 15 minutos
 * 
 * @example
 * curl -X POST https://tu-hotel.com/api/sync-comprobantes \
 *   -H "Authorization: Bearer $CRON_SECRET"
 */

// Tiempo máximo de ejecución (importante para serverless)
export const maxDuration = 60 // 60 segundos

export async function POST(request: NextRequest) {
    try {
        // 1. Validar autenticación (CRON_SECRET o admin)
        const authHeader = request.headers.get('Authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret) {
            logger.error('CRON_SECRET no configurado', { action: 'sync-comprobantes' })
            return NextResponse.json({ error: 'Servidor no configurado' }, { status: 500 })
        }

        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const supabase = await createClient()

        // 2. Obtener comprobantes PENDIENTES (máximo 50 por ejecución)
        const { data: pendientes, error: fetchError } = await supabase
            .from('comprobantes')
            .select('id, tipo_comprobante, serie, numero')
            .eq('estado_sunat', 'PENDIENTE')
            .order('created_at', { ascending: true })
            .limit(50)

        if (fetchError) {
            logger.error('Error al obtener comprobantes pendientes', { error: fetchError.message })
            return NextResponse.json({ error: 'Error de base de datos' }, { status: 500 })
        }

        if (!pendientes || pendientes.length === 0) {
            return NextResponse.json({
                message: 'No hay comprobantes pendientes',
                procesados: 0
            })
        }

        logger.info('Iniciando sincronización de comprobantes', {
            action: 'sync-comprobantes',
            total: pendientes.length
        })

        // 3. Procesar cada comprobante
        const resultados = {
            aceptados: 0,
            rechazados: 0,
            pendientes: 0,
            errores: 0
        }

        for (const comprobante of pendientes) {
            try {
                const estadoNubefact = await consultarEstadoNubefact(
                    comprobante.tipo_comprobante,
                    comprobante.serie,
                    comprobante.numero
                )

                if (estadoNubefact.aceptada_por_sunat === true) {
                    // ACEPTADO
                    await supabase
                        .from('comprobantes')
                        .update({
                            estado_sunat: 'ACEPTADO',
                            hash_cpe: estadoNubefact.hash,
                            xml_url: estadoNubefact.enlace,
                            cdr_url: estadoNubefact.enlace_del_cdr
                        })
                        .eq('id', comprobante.id)

                    resultados.aceptados++

                } else if (estadoNubefact.errors || estadoNubefact.codigo_sunat) {
                    // RECHAZADO
                    await supabase
                        .from('comprobantes')
                        .update({
                            estado_sunat: 'RECHAZADO',
                            observaciones: estadoNubefact.errors || estadoNubefact.mensaje
                        })
                        .eq('id', comprobante.id)

                    resultados.rechazados++

                } else {
                    // Sigue PENDIENTE
                    resultados.pendientes++
                }

            } catch (error) {
                logger.error('Error al consultar comprobante', {
                    comprobanteId: comprobante.id,
                    error: error instanceof Error ? error.message : 'Error desconocido'
                })
                resultados.errores++
            }

            // Rate limiting: esperar 200ms entre llamadas para no saturar Nubefact
            await new Promise(resolve => setTimeout(resolve, 200))
        }

        logger.info('Sincronización completada', {
            action: 'sync-comprobantes',
            resultados
        })

        return NextResponse.json({
            message: 'Sincronización completada',
            procesados: pendientes.length,
            resultados
        })

    } catch (error) {
        logger.error('Error en sincronización de comprobantes', {
            action: 'sync-comprobantes',
            error: error instanceof Error ? error.message : 'Error desconocido'
        })

        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        )
    }
}

// GET para verificar que el endpoint existe
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        description: 'Endpoint de sincronización de comprobantes PENDIENTES',
        usage: 'POST con Authorization: Bearer <CRON_SECRET>'
    })
}
