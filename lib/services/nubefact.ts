/**
 * CLIENTE NUBEFACT - INTEGRACIÓN REAL CON API
 * 
 * Cliente para enviar comprobantes electrónicos a SUNAT vía NubeFact (OSE).
 * NubeFact maneja:
 * - Generación de XML UBL 2.1
 * - Firma digital
 * - Envío a SUNAT
 * - Generación de PDF y QR
 * - Almacenamiento de CDR
 * 
 * Documentación: https://nubefact.com/api
 */

'use server'

import { getHotelConfig } from '@/lib/actions/configuracion'
import { logger } from '@/lib/logger'

// NOTA: La URL completa viene de NUBEFACT_API_URL en .env.local
// No hay constantes hardcodeadas - cada cliente tiene su ruta única

// =====================================================
// TYPES
// =====================================================

export type NubefactConfig = {
  token: string
  ruc: string
  modo_produccion: boolean
  api_url: string
}

export type NubefactResponse = {
  success: boolean
  mensaje?: string
  errors?: string
  enlace?: string        // URL del XML
  enlace_pdf?: string    // URL del PDF
  enlace_del_cdr?: string // URL del CDR
  hash?: string          // Hash CPE
  codigo_sunat?: string  // Código respuesta SUNAT
  aceptada_por_sunat?: boolean
}

export type NubefactAnulacionResponse = {
  success: boolean
  mensaje?: string
  errors?: string
  ticket_numero?: string        // Ticket SUNAT para consultar estado
  enlace?: string
  enlace_del_pdf?: string
  enlace_del_xml?: string
  enlace_del_cdr?: string
  aceptada_por_sunat?: boolean
  sunat_description?: string
  sunat_responsecode?: string
}

export type NubefactComprobanteInput = {
  tipo_comprobante: 'BOLETA' | 'FACTURA' | 'NOTA_CREDITO'
  serie: string
  numero: number

  // Cliente
  cliente_tipo_documento: string
  cliente_numero_documento: string
  cliente_denominacion: string
  cliente_direccion?: string

  // Montos
  fecha_emision: string // DD-MM-YYYY (formato Nubefact)
  moneda: 'PEN' | 'USD'
  tipo_cambio: number
  porcentaje_igv: number
  total_gravada: number
  total_exonerada: number
  total_igv: number
  total: number

  // Items
  items: Array<{
    unidad_de_medida: string
    codigo: string
    descripcion: string
    cantidad: number
    valor_unitario: number
    precio_unitario: number
    subtotal: number
    tipo_de_igv: number // 1=Gravado, 2=Exonerado, 8=Exonerado, 9=Inafecto
    igv: number // Total IGV de la línea
    total: number // Total de la línea
  }>

  // Nota de Crédito (opcional)
  tipo_nota_credito?: string
  motivo_nota_credito?: string
  comprobante_referencia_tipo?: string
  comprobante_referencia_serie?: string
  comprobante_referencia_numero?: number
}

// =====================================================
// CONFIGURACIÓN
// =====================================================

async function getNubefactConfig(): Promise<NubefactConfig> {
  // Token y URL vienen de variables de entorno (seguridad)
  const token = process.env.NUBEFACT_TOKEN
  const mode = process.env.NUBEFACT_MODE || 'demo'
  const api_url = process.env.NUBEFACT_API_URL
  const envRuc = process.env.NUBEFACT_RUC

  if (!token) {
    throw new Error(
      'Token de NubeFact no configurado. ' +
      'Agrega NUBEFACT_TOKEN en el archivo .env.local'
    )
  }

  if (!api_url) {
    throw new Error(
      'URL de NubeFact no configurada. ' +
      'Agrega NUBEFACT_API_URL en el archivo .env.local'
    )
  }

  // RUC puede venir de .env o de BD
  const config = await getHotelConfig()
  const ruc = envRuc || config.ruc

  if (!ruc || ruc === '20000000001') {
    throw new Error(
      'Debe configurar el RUC real del hotel en Configuración'
    )
  }

  const modo_produccion = mode === 'production'

  logger.info('Configuración NubeFact obtenida', {
    ruc,
    modo: mode,
    api_url
  })

  return {
    token,
    ruc,
    modo_produccion,
    api_url
  }
}

// =====================================================
// MAPEO DE CÓDIGOS SUNAT
// =====================================================

function mapearTipoDocumento(tipo: string): string {
  const mapeo: Record<string, string> = {
    'DNI': '1',
    'RUC': '6',
    'PASAPORTE': '7',
    'CE': '4',
    'CARNET_EXTRANJERIA': '4'
  }
  return mapeo[tipo] || '1'
}

// Mapeo según documentación NubeFact (NO CÓDIGOS SUNAT DIRECTOS)
// 1 = FACTURA
// 2 = BOLETA
// 3 = NOTA DE CRÉDITO
// 4 = NOTA DE DÉBITO
function mapearTipoComprobante(tipo: string): number {
  const mapeo: Record<string, number> = {
    'FACTURA': 1,
    'BOLETA': 2,
    'NOTA_CREDITO': 3,
    'NOTA_DEBITO': 4
  }
  return mapeo[tipo] || 2
}

function mapearMoneda(moneda: string): number {
  return moneda === 'USD' ? 2 : 1
}

// =====================================================
// ENVIAR COMPROBANTE A NUBEFACT
// =====================================================

export async function enviarComprobanteNubefact(
  input: NubefactComprobanteInput
): Promise<NubefactResponse> {
  try {
    const config = await getNubefactConfig()

    // Construir payload según especificación NubeFact
    const payload = {
      operacion: 'generar_comprobante',
      tipo_de_comprobante: mapearTipoComprobante(input.tipo_comprobante),
      serie: input.serie,
      numero: input.numero,
      sunat_transaction: 1, // 1 = enviar a SUNAT inmediatamente

      // Emisor (NubeFact lo obtiene del RUC configurado)
      // No es necesario enviar nombre_comercial, dirección, etc.

      // Receptor
      cliente_tipo_de_documento: mapearTipoDocumento(input.cliente_tipo_documento),
      cliente_numero_de_documento: input.cliente_numero_documento,
      cliente_denominacion: input.cliente_denominacion,
      cliente_direccion: input.cliente_direccion || '',

      // Fechas y moneda
      fecha_de_emision: input.fecha_emision,
      moneda: mapearMoneda(input.moneda),
      tipo_de_cambio: input.tipo_cambio,

      // Montos
      porcentaje_de_igv: input.porcentaje_igv,
      total_gravada: input.total_gravada,
      total_exonerada: input.total_exonerada,
      total_inafecta: 0,
      total_igv: input.total_igv,
      total: input.total,

      // Flags de envío
      enviar_automaticamente_a_la_sunat: true,
      enviar_automaticamente_al_cliente: false,

      // Items
      items: input.items.map(item => ({
        unidad_de_medida: item.unidad_de_medida,
        codigo: item.codigo,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        valor_unitario: item.valor_unitario,
        precio_unitario: item.precio_unitario,
        subtotal: item.subtotal,
        tipo_de_igv: item.tipo_de_igv,
        igv: item.igv,
        total: item.total
      }))
    }

    // ---------------------------------------------------------
    // VALIDACIÓN CRÍTICA: Campos exclusivos de Nota de Crédito
    // ---------------------------------------------------------
    // Nubefact rechaza Boletas/Facturas que tengan campos de NC aunque sean nulos/vacíos.
    // Solo agregamos estos campos SI Y SOLO SI es NOTA_CREDITO.

    if (input.tipo_comprobante === 'NOTA_CREDITO') {
      if (!input.comprobante_referencia_tipo || !input.comprobante_referencia_serie || !input.comprobante_referencia_numero) {
        throw new Error('Nota de Crédito requiere documento de referencia completo')
      }

      // Mapear tipo de documento modificado: 1=Factura, 2=Boleta
      const tipoDocModificado = input.comprobante_referencia_tipo === 'FACTURA' ? 1 : 2

      // Parsear tipo de nota de crédito a entero (ej: "07" -> 7)
      const tipoNotaCredito = input.tipo_nota_credito ? parseInt(input.tipo_nota_credito.toString()) : 1

      Object.assign(payload, {
        // Campos obligatorios según Doc V1
        tipo_de_nota_de_credito: tipoNotaCredito,
        documento_que_se_modifica_tipo: tipoDocModificado,
        documento_que_se_modifica_serie: input.comprobante_referencia_serie,
        documento_que_se_modifica_numero: input.comprobante_referencia_numero,

        // Motivo no es un campo estándar en el root del JSON para NC según doc V1, 
        // pero suele ir en 'observaciones' o si la API lo soporta.
        // La doc dice 'motivo' solo para Anulaciones (generar_anulacion), no para generar_comprobante tipo 3.
        // Sin embargo, es buena práctica ponerlo en observaciones.
        observaciones: input.motivo_nota_credito || 'Nota de Crédito'
      })
    } else {
      // Para Boletas y Facturas, nos aseguramos de que NO existan estos campos
      // (Aunque el objeto payload inicial no los tiene, esto es doble seguridad)
      // No hacemos nada, el payload base está limpio.
    }

    logger.info('Enviando comprobante a NubeFact', {
      tipo: input.tipo_comprobante,
      serie: input.serie,
      numero: input.numero,
      total: input.total
    })

    // Enviar a NubeFact (la URL ya es completa con el endpoint)
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Payload Nubefact', { payload })
    }

    const response = await fetch(config.api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.token
      },
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    if (!response.ok) {
      logger.error('Error de NubeFact', {
        status: response.status,
        data
      })

      return {
        success: false,
        errors: data.errors || data.mensaje || 'Error desconocido de NubeFact',
        mensaje: 'Error al enviar a SUNAT vía NubeFact'
      }
    }

    // Respuesta exitosa (HTTP 200)
    // PERO: Puede ser rechazada por SUNAT (regla de negocio)

    const aceptada = data.aceptada_por_sunat === true

    // Un rechazo real tiene un código de respuesta de SUNAT (ej: "2399") o un error SOAP explícito.
    // Si 'aceptada_por_sunat' es false pero no hay código de error, es un estado PENDIENTE/EN COLA.
    const tieneErrorSunat = !!(data.sunat_responsecode || data.sunat_soap_error)
    const tieneErrorNubefact = !!(data.errors && !data.sunat_description) // Error de validación previo a SUNAT

    const esRechazoReal = !aceptada && (tieneErrorSunat || tieneErrorNubefact)
    const esPendiente = !aceptada && !esRechazoReal

    logger.info('Respuesta Nubefact recibida', {
      hash: data.hash,
      aceptado: aceptada,
      es_rechazo: esRechazoReal,
      es_pendiente: esPendiente,
      sunat_code: data.sunat_responsecode
    })

    if (esRechazoReal) {
      // RECHAZO CONFIRMADO
      return {
        success: false,
        mensaje: data.sunat_description || data.errors || 'Comprobante RECHAZADO por SUNAT',
        errors: data.sunat_note || data.sunat_responsecode || data.errors,
        codigo_sunat: data.sunat_responsecode
      }
    }

    // SI ES ACEPTADA O PENDIENTE -> SUCCESS
    // Nota: Si es pendiente, el success es true porque el envío fue exitoso, 
    // pero el estado_sunat en BD quedará como PENDIENTE (manejado por quien llama a esta función).
    return {
      success: true,
      mensaje: esPendiente ? 'Comprobante ENVIADO a SUNAT (En Proceso)' : (data.sunat_description || 'Comprobante enviado correctamente'),
      enlace: data.enlace,
      enlace_pdf: data.enlace_del_pdf,
      enlace_del_cdr: data.enlace_del_cdr,
      hash: data.codigo_hash,
      codigo_sunat: data.sunat_responsecode,
      aceptada_por_sunat: aceptada // Retornamos el valor real para que la BD sepa si guardar ACEPTADO o PENDIENTE
    }

  } catch (error: any) {
    logger.error('Error al conectar con NubeFact', {
      error: error.message
    })

    return {
      success: false,
      errors: error.message,
      mensaje: 'Error de conexión con NubeFact'
    }
  }
}

// =====================================================
// CONSULTAR ESTADO DE COMPROBANTE
// =====================================================

export async function consultarEstadoNubefact(
  tipo_comprobante: string,
  serie: string,
  numero: number
): Promise<NubefactResponse> {
  try {
    const config = await getNubefactConfig()

    const payload = {
      operacion: 'consultar_comprobante',
      tipo_de_comprobante: mapearTipoComprobante(tipo_comprobante),
      serie,
      numero
    }

    const response = await fetch(config.api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.token  // Sin prefijo Bearer - según doc Nubefact
      },
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    // Usar la misma lógica de "Pendiente vs Rechazo"
    const aceptada = data.aceptada_por_sunat !== false
    const esPendiente = !aceptada && !data.sunat_description && !data.errors

    return {
      success: true, // La consulta en sí fue exitosa
      mensaje: data.sunat_description || (esPendiente ? 'En Proceso' : 'Estado consultado'),
      aceptada_por_sunat: aceptada,
      codigo_sunat: data.sunat_responsecode,
      enlace_del_cdr: data.enlace_del_cdr,
      enlace: data.enlace,
      enlace_pdf: data.enlace_del_pdf // Corregido: campo correcto según doc Nubefact
    }

  } catch (error: any) {
    logger.error('Error al consultar estado en NubeFact', {
      error: error.message
    })

    return {
      success: false,
      errors: error.message
    }
  }
}

// =====================================================
// GENERAR ANULACIÓN (COMUNICACIÓN DE BAJA)
// =====================================================

/**
 * Genera una comunicación de baja para anular un comprobante.
 * IMPORTANTE: Este proceso es ASÍNCRONO en SUNAT.
 * 
 * Flujo:
 * 1. Enviar solicitud de anulación
 * 2. Nubefact devuelve ticket_numero
 * 3. Esperar 1-10 minutos
 * 4. Consultar estado con consultarAnulacionNubefact()
 * 
 * Plazo: Máximo 7 días desde emisión del comprobante
 */
export async function generarAnulacionNubefact(
  tipo_comprobante: string,
  serie: string,
  numero: number,
  motivo: string = 'ERROR DEL SISTEMA'
): Promise<NubefactAnulacionResponse> {
  try {
    const config = await getNubefactConfig()

    const payload = {
      operacion: 'generar_anulacion',
      tipo_de_comprobante: mapearTipoComprobante(tipo_comprobante),
      serie,
      numero,
      motivo,
      codigo_unico: `ANULAR-${serie}-${numero}`  // Para evitar duplicados
    }

    logger.info('Enviando solicitud de anulación a NubeFact', {
      tipo: tipo_comprobante,
      serie,
      numero,
      motivo
    })

    const response = await fetch(config.api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.token
      },
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    if (!response.ok) {
      logger.error('Error al solicitar anulación en NubeFact', {
        status: response.status,
        data
      })

      return {
        success: false,
        errors: data.errors || data.mensaje || 'Error al solicitar anulación',
        mensaje: 'Error al enviar anulación a SUNAT vía NubeFact'
      }
    }

    logger.info('Anulación enviada a SUNAT', {
      ticket: data.sunat_ticket_numero,
      enlace: data.enlace
    })

    return {
      success: true,
      mensaje: 'Solicitud de anulación enviada. Consultar estado en 5-10 minutos.',
      ticket_numero: data.sunat_ticket_numero,
      enlace: data.enlace,
      enlace_del_pdf: data.enlace_del_pdf,
      enlace_del_xml: data.enlace_del_xml,
      enlace_del_cdr: data.enlace_del_cdr
    }

  } catch (error: any) {
    logger.error('Error al conectar con NubeFact para anulación', {
      error: error.message
    })

    return {
      success: false,
      errors: error.message,
      mensaje: 'Error de conexión con NubeFact'
    }
  }
}

// =====================================================
// CONSULTAR ESTADO DE ANULACIÓN
// =====================================================

/**
 * Consulta el estado de una comunicación de baja.
 * Usar después de llamar a generarAnulacionNubefact().
 * 
 * Estados posibles de SUNAT:
 * - aceptada_por_sunat: true → Comprobante anulado exitosamente
 * - aceptada_por_sunat: false → Anulación rechazada
 * - aceptada_por_sunat: null/undefined → Aún en proceso
 */
export async function consultarAnulacionNubefact(
  tipo_comprobante: string,
  serie: string,
  numero: number
): Promise<NubefactAnulacionResponse> {
  try {
    const config = await getNubefactConfig()

    const payload = {
      operacion: 'consultar_anulacion',  // Diferente de consultar_comprobante
      tipo_de_comprobante: mapearTipoComprobante(tipo_comprobante),
      serie,
      numero
    }

    logger.info('Consultando estado de anulación en NubeFact', {
      tipo: tipo_comprobante,
      serie,
      numero
    })

    const response = await fetch(config.api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.token
      },
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    if (!response.ok) {
      logger.error('Error al consultar anulación en NubeFact', {
        status: response.status,
        data
      })

      return {
        success: false,
        errors: data.errors || 'Error al consultar anulación'
      }
    }

    // Determinar estado
    const aceptada = data.aceptada_por_sunat === true
    const rechazada = data.aceptada_por_sunat === false && data.sunat_description
    const enProceso = data.aceptada_por_sunat === undefined || data.aceptada_por_sunat === null

    let mensaje = 'Estado desconocido'
    if (aceptada) mensaje = 'Comprobante ANULADO exitosamente por SUNAT'
    if (rechazada) mensaje = `Anulación RECHAZADA: ${data.sunat_description}`
    if (enProceso) mensaje = 'Anulación EN PROCESO - SUNAT aún no responde'

    logger.info('Estado de anulación consultado', {
      aceptada,
      rechazada,
      enProceso,
      sunat_description: data.sunat_description
    })

    return {
      success: true,
      mensaje,
      aceptada_por_sunat: aceptada,
      sunat_description: data.sunat_description,
      sunat_responsecode: data.sunat_responsecode,
      enlace_del_cdr: data.enlace_del_cdr,
      enlace: data.enlace,
      enlace_del_pdf: data.enlace_del_pdf
    }

  } catch (error: any) {
    logger.error('Error al consultar anulación en NubeFact', {
      error: error.message
    })

    return {
      success: false,
      errors: error.message
    }
  }
}

