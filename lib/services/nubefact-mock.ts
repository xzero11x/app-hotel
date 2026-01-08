/**
 * MOCK DE NUBEFACT - SIMULADOR PARA DESARROLLO
 * 
 * Este servicio simula las respuestas de la API de NubeFact para no depender
 * del servicio real durante el desarrollo y pruebas.
 * 
 * En producción, este archivo debe ser reemplazado por la integración real con NubeFact.
 */

export type NubefactResponse = {
  success: boolean
  mensaje: string
  enlace?: string
  enlace_pdf?: string
  hash?: string
  codigo_sunat?: string
  errors?: string
}

export type EmisionComprobante = {
  tipo_comprobante: 'BOLETA' | 'FACTURA' | 'NOTA_CREDITO'
  serie: string
  numero: number
  
  // Cliente
  cliente_tipo_documento: string
  cliente_numero_documento: string
  cliente_denominacion: string
  cliente_direccion?: string
  
  // Montos
  moneda: 'PEN' | 'USD'
  total: number
  subtotal: number
  igv: number
  
  // Items
  items: Array<{
    descripcion: string
    cantidad: number
    precio_unitario: number
    subtotal: number
  }>
}

/**
 * Simula el envío de un comprobante a NubeFact
 */
export async function enviarComprobante(datos: EmisionComprobante): Promise<NubefactResponse> {
  // Simular delay de red (200-800ms)
  const delay = Math.random() * 600 + 200
  await new Promise(resolve => setTimeout(resolve, delay))

  // Simular respuestas aleatorias con probabilidades reales:
  // 90% éxito, 8% error validación, 2% error servicio
  const random = Math.random()

  if (random < 0.90) {
    // ÉXITO - Comprobante aceptado
    const hash = generateMockHash()
    const numero_completo = `${datos.serie}-${datos.numero.toString().padStart(8, '0')}`
    
    return {
      success: true,
      mensaje: 'Comprobante enviado correctamente a SUNAT',
      enlace: `https://mock-nubefact.com/xml/${numero_completo}.xml`,
      enlace_pdf: `https://mock-nubefact.com/pdf/${numero_completo}.pdf`,
      hash: hash,
      codigo_sunat: '0' // Código 0 = Aceptado por SUNAT
    }
  } else if (random < 0.98) {
    // ERROR DE VALIDACIÓN (cliente, montos, etc.)
    const errores = [
      'El RUC del cliente no existe en SUNAT',
      'El monto del IGV no coincide con el subtotal',
      'La serie no está autorizada para emitir comprobantes',
      'El número de documento del cliente es inválido'
    ]
    
    return {
      success: false,
      mensaje: 'Error de validación',
      errors: errores[Math.floor(Math.random() * errores.length)]
    }
  } else {
    // ERROR DE SERVICIO (timeout, servicio caído, etc.)
    return {
      success: false,
      mensaje: 'Error de conexión con SUNAT',
      errors: 'Timeout al conectar con los servidores de SUNAT. Por favor, intente nuevamente.'
    }
  }
}

/**
 * Simula la anulación de un comprobante (Nota de Crédito)
 */
export async function anularComprobante(
  comprobante_original: { serie: string; numero: number; tipo: string },
  motivo: string
): Promise<NubefactResponse> {
  // Simular delay
  await new Promise(resolve => setTimeout(resolve, 300))

  const random = Math.random()

  if (random < 0.95) {
    // ÉXITO
    const hash = generateMockHash()
    
    return {
      success: true,
      mensaje: 'Nota de Crédito generada correctamente',
      enlace: `https://mock-nubefact.com/xml/NC-${comprobante_original.serie}-${comprobante_original.numero}.xml`,
      enlace_pdf: `https://mock-nubefact.com/pdf/NC-${comprobante_original.serie}-${comprobante_original.numero}.pdf`,
      hash: hash,
      codigo_sunat: '0'
    }
  } else {
    // ERROR
    return {
      success: false,
      mensaje: 'Error al generar Nota de Crédito',
      errors: 'El comprobante original ya fue anulado previamente'
    }
  }
}

/**
 * Simula la consulta de estado de un comprobante en SUNAT
 */
export async function consultarEstado(serie: string, numero: number): Promise<{
  estado: 'ACEPTADO' | 'PENDIENTE' | 'RECHAZADO'
  mensaje: string
}> {
  await new Promise(resolve => setTimeout(resolve, 200))

  // Simular que el 95% están aceptados
  const random = Math.random()
  
  if (random < 0.95) {
    return {
      estado: 'ACEPTADO',
      mensaje: 'Comprobante aceptado por SUNAT'
    }
  } else if (random < 0.98) {
    return {
      estado: 'PENDIENTE',
      mensaje: 'Comprobante en cola de procesamiento SUNAT'
    }
  } else {
    return {
      estado: 'RECHAZADO',
      mensaje: 'Comprobante rechazado por inconsistencias'
    }
  }
}

/**
 * Genera un hash ficticio (para simular el hash CPE de SUNAT)
 */
function generateMockHash(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let hash = ''
  for (let i = 0; i < 40; i++) {
    hash += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return hash
}

/**
 * Configuración del mock (para simular diferentes escenarios)
 */
export const NubefactMockConfig = {
  // Cambiar a true para simular siempre errores
  forceError: false,
  
  // Cambiar a true para simular siempre éxito
  forceSuccess: false,
  
  // Delay personalizado (ms)
  customDelay: null as number | null,
  
  // Habilitar logs en consola
  debug: true
}

// Logger para debugging
function log(mensaje: string, datos?: any) {
  if (NubefactMockConfig.debug) {
    console.log(`[NUBEFACT MOCK] ${mensaje}`, datos || '')
  }
}

// Wrapper con logging
export async function enviarComprobanteConLog(datos: EmisionComprobante): Promise<NubefactResponse> {
  log('📤 Enviando comprobante...', {
    tipo: datos.tipo_comprobante,
    serie: datos.serie,
    numero: datos.numero,
    cliente: datos.cliente_denominacion,
    total: datos.total
  })
  
  const response = await enviarComprobante(datos)
  
  if (response.success) {
    log('✅ Comprobante aceptado', { hash: response.hash })
  } else {
    log('❌ Error en comprobante', { error: response.errors })
  }
  
  return response
}
