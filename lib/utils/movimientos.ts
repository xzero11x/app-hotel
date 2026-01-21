export type TipoMovimiento = 'INGRESO' | 'EGRESO'
export type MonedaMovimiento = 'PEN' | 'USD'
export type CategoriaMovimiento =
  | 'GASTO_OPERATIVO'
  | 'GASTO_EMERGENCIA'
  | 'DOTACION_SENCILLO'
  | 'RETIRO_ADMINISTRATIVO'  // Retiro de dueño/gerencia
  | 'AJUSTE'
  | 'OTRO'

export const CATEGORIAS_MOVIMIENTO: CategoriaMovimiento[] = [
  'GASTO_OPERATIVO',
  'GASTO_EMERGENCIA',
  'DOTACION_SENCILLO',
  'RETIRO_ADMINISTRATIVO',
  'AJUSTE',
  'OTRO'
]

export const CATEGORIA_LABELS: Record<CategoriaMovimiento, string> = {
  'GASTO_OPERATIVO': 'Gasto Operativo',
  'GASTO_EMERGENCIA': 'Gasto de Emergencia',
  'DOTACION_SENCILLO': 'Dotación de Sencillo',
  'RETIRO_ADMINISTRATIVO': '💼 Retiro Administrativo (Dueño/Gerencia)',
  'AJUSTE': 'Ajuste',
  'OTRO': 'Otro'
}

/**
 * Obtener categorías disponibles
 */
export function getCategoriasMovimiento(): CategoriaMovimiento[] {
  return CATEGORIAS_MOVIMIENTO
}

/**
 * Obtener label amigable de una categoría
 */
export function getCategoriaLabel(categoria: CategoriaMovimiento | null): string {
  return categoria ? CATEGORIA_LABELS[categoria] : 'Sin categoría'
}
