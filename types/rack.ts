export type RackHabitacion = {
  id: string
  numero: string
  piso: string
  tipo_id: string
  categoria_id: string
  estado_ocupacion: string
  estado_limpieza: string
  estado_servicio: string
  tipos_habitacion: {
    nombre: string
    capacidad_personas: number
  }
  categorias_habitacion: {
    nombre: string
  }
}

export type RackReserva = {
  id: string
  codigo_reserva: string
  habitacion_id: string
  fecha_entrada: string
  fecha_salida: string
  estado: string
  precio_pactado: number | null
  saldo_pendiente: number
  huesped_presente: boolean
  notas: string | null
  huespedes: {
    nombres: string
    apellidos: string
    tipo_documento: string
    numero_documento: string
  } | null
  canales_venta: {
    nombre: string
  } | null
  habitaciones: {
    numero: string
  } | null
}

export type RackKPIs = {
  llegadas: number
  salidas: number
  sucias: number
  ocupadas: number
}