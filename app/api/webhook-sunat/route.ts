/**
 * WEBHOOK SUNAT - Recibe notificaciones de Nubefact
 * 
 * Este endpoint recibe actualizaciones de estado de comprobantes
 * desde Nubefact cuando SUNAT procesa documentos de forma asíncrona.
 * 
 * Casos de uso:
 * 1. Confirmación de comprobantes que quedaron PENDIENTE
 * 2. Resultado de comunicaciones de baja (anulaciones)
 * 3. Notificaciones de rechazo posterior
 * 
 * Configurar URL en panel Nubefact:
 * https://tu-dominio.com/api/webhook-sunat
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

// Secret para validar que la solicitud viene de Nubefact
const WEBHOOK_SECRET = process.env.NUBEFACT_WEBHOOK_SECRET

// Rate limiting simple (en memoria - para producción usar Redis)
const requestCounts = new Map<string, { count: number; timestamp: number }>()
const RATE_LIMIT = 100 // requests
const RATE_WINDOW = 60000 // 1 minuto

function isRateLimited(ip: string): boolean {
    const now = Date.now()
    const record = requestCounts.get(ip)

    if (!record || now - record.timestamp > RATE_WINDOW) {
        requestCounts.set(ip, { count: 1, timestamp: now })
        return false
    }

    if (record.count >= RATE_LIMIT) {
        return true
    }

    record.count++
    return false
}

export async function POST(request: NextRequest) {
    const startTime = Date.now()

    try {
        // Obtener IP para rate limiting
        const ip = request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown'

        if (isRateLimited(ip)) {
            logger.warn('Webhook SUNAT: Rate limit excedido', { ip })
            return NextResponse.json(
                { error: 'Too Many Requests' },
                { status: 429 }
            )
        }

        // Validar origen (si hay secret configurado)
        if (WEBHOOK_SECRET) {
            const signature = request.headers.get('x-nubefact-signature') ||
                request.headers.get('authorization')

            if (signature !== WEBHOOK_SECRET) {
                logger.warn('Webhook SUNAT: Firma inválida', {
                    ip,
                    signatureProvided: !!signature
                })
                return NextResponse.json(
                    { error: 'Unauthorized' },
                    { status: 401 }
                )
            }
        }

        // Parsear body
        const body = await request.json()

        logger.info('Webhook SUNAT recibido', {
            tipo_comprobante: body.tipo_de_comprobante,
            serie: body.serie,
            numero: body.numero,
            aceptada: body.aceptada_por_sunat,
            operacion: body.operacion || 'generar_comprobante'
        })

        // Validar campos mínimos
        if (!body.serie || !body.numero) {
            logger.warn('Webhook SUNAT: Campos faltantes', { body })
            return NextResponse.json(
                { error: 'Missing required fields: serie, numero' },
                { status: 400 }
            )
        }

        // Crear cliente Supabase
        const supabase = await createClient()

        // Determinar nuevo estado
        let nuevoEstado: 'PENDIENTE' | 'ACEPTADO' | 'RECHAZADO' | 'ANULADO' = 'PENDIENTE'

        if (body.aceptada_por_sunat === true) {
            // Verificar si es una anulación aceptada
            if (body.operacion === 'generar_anulacion' || body.operacion === 'consultar_anulacion') {
                nuevoEstado = 'ANULADO'
            } else {
                nuevoEstado = 'ACEPTADO'
            }
        } else if (body.aceptada_por_sunat === false) {
            nuevoEstado = 'RECHAZADO'
        }

        // Actualizar comprobante en BD
        const updateData: Record<string, unknown> = {
            estado_sunat: nuevoEstado
        }

        // Solo actualizar campos si vienen en el webhook
        if (body.codigo_hash) updateData.hash_cpe = body.codigo_hash
        if (body.enlace_del_cdr) updateData.cdr_url = body.enlace_del_cdr
        if (body.enlace_del_xml) updateData.xml_url = body.enlace_del_xml
        if (body.enlace_del_pdf) updateData.pdf_url = body.enlace_del_pdf
        if (body.external_id) updateData.external_id = body.external_id

        const { data, error } = await supabase
            .from('comprobantes')
            .update(updateData)
            .eq('serie', body.serie)
            .eq('numero', parseInt(body.numero))
            .select('id, serie, numero')
            .single()

        if (error) {
            logger.error('Error actualizando comprobante desde webhook', {
                error: error.message,
                serie: body.serie,
                numero: body.numero
            })

            // No retornar 500 para evitar reintentos infinitos de Nubefact
            return NextResponse.json({
                success: false,
                error: 'Comprobante no encontrado o error de BD',
                processed: false
            })
        }

        const processingTime = Date.now() - startTime

        logger.info('Comprobante actualizado vía webhook', {
            comprobante_id: data?.id,
            serie: body.serie,
            numero: body.numero,
            nuevo_estado: nuevoEstado,
            processing_time_ms: processingTime
        })

        return NextResponse.json({
            success: true,
            comprobante_id: data?.id,
            nuevo_estado: nuevoEstado,
            processed: true
        })

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido'

        logger.error('Error en webhook SUNAT', {
            error: errorMessage,
            processing_time_ms: Date.now() - startTime
        })

        return NextResponse.json(
            { error: 'Internal error', processed: false },
            { status: 500 }
        )
    }
}

/**
 * GET - Validación del endpoint
 * Nubefact puede hacer GET para verificar que el webhook está activo
 */
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        service: 'PMS Hotel - SUNAT Webhook',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
            POST: 'Recibe notificaciones de Nubefact/SUNAT'
        }
    })
}
