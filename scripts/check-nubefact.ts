
// Script para verificar conexión con Nubefact
// Ejecutar con: npx tsx scripts/check-nubefact.ts

import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// Cargar variables de entorno desde .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath))
    for (const k in envConfig) {
        process.env[k] = envConfig[k]
    }
} else {
    console.log('⚠️ No se encontró .env.local, usando variables de entorno del sistema')
}

async function checkNubefact() {
    const API_URL = process.env.NUBEFACT_API_URL
    const TOKEN = process.env.NUBEFACT_TOKEN
    const RUC = process.env.NUBEFACT_RUC // Opcional si se usa el payload

    console.log('\n--- VERIFICACIÓN DE CONEXIÓN NUBEFACT ---')
    console.log('URL:', API_URL)
    console.log('Token:', TOKEN ? (TOKEN.substring(0, 10) + '...') : 'NO DEFINIDO')
    console.log('RUC (env):', RUC || 'No definido en env')

    if (!API_URL || !TOKEN) {
        console.error('❌ Error: Faltan credenciales en .env.local')
        return
    }

    try {
        // Intentaremos hacer un request inválido adrede (sin payload) para ver si responde 400 (Bad Request)
        // Si responde 401 es error de Token.
        // Si responde 404 es URL mal.
        // Si responde 200... raro sin payload.

        console.log('\nEnviando petición de prueba a Nubefact...')
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                operacion: "consultar_comprobante", // Operación dummy
                tipo_de_comprobante: 1,
                serie: "TEST",
                numero: 1,
                sunat_transaction: 1,
                cliente_tipo_de_documento: "6",
                cliente_numero_de_documento: "20600695771",
                cliente_denominacion: "TEST",
                cliente_direccion: "TEST",
                fecha_de_emision: "14-01-2026",
                moneda: 1,
                porcentaje_de_igv: 18,
                total_gravada: 100,
                total_igv: 18,
                total: 118,
                items: []
            })
        })

        const status = response.status
        const text = await response.text()

        console.log(`\nRespuesta HTTP: ${status}`)
        console.log('Cuerpo:', text.substring(0, 500)) // Primeros 500 chars

        if (status === 200 || status === 201) {
            console.log('✅ Conexión exitosa con Nubefact (Credenciales válidas)')
        } else if (status === 401) {
            console.error('❌ Error 401: Token inválido o no autorizado.')
        } else if (status === 403) {
            console.error('❌ Error 403: Acceso denegado (IP bloqueada o plan inactivo).')
        } else {
            console.warn(`⚠️ Respuesta inesperada (${status}). Revise el mensaje de error.`)
        }

    } catch (error: any) {
        console.error('❌ Error de red / conexión:', error.message)
        if (error.cause) console.error('Causa:', error.cause)
    }
}

checkNubefact()
