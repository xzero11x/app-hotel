// Constantes y tipos para Late Checkout
// Separado de estadias.ts porque 'use server' solo permite funciones async

export type OpcionLateCheckout = {
    horas: number
    descripcion: string
    porcentaje: number // % del precio de noche
    esDiaCompleto: boolean
}

export const OPCIONES_LATE_CHECKOUT: OpcionLateCheckout[] = [
    { horas: 1, descripcion: '1 hora (hasta 1:00 PM)', porcentaje: 25, esDiaCompleto: false },
    { horas: 2, descripcion: '2 horas (hasta 2:00 PM)', porcentaje: 25, esDiaCompleto: false },
    { horas: 3, descripcion: '3 horas (hasta 3:00 PM)', porcentaje: 50, esDiaCompleto: false },
    { horas: 4, descripcion: '4 horas (hasta 4:00 PM)', porcentaje: 50, esDiaCompleto: false },
    { horas: 5, descripcion: '5 horas (hasta 5:00 PM)', porcentaje: 50, esDiaCompleto: false },
    { horas: 6, descripcion: '6 horas (hasta 6:00 PM)', porcentaje: 50, esDiaCompleto: false },
    { horas: 24, descripcion: 'Día completo (+1 noche)', porcentaje: 100, esDiaCompleto: true },
]
