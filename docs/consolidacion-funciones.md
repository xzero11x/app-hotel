# 🔧 Consolidación de Funciones Duplicadas

**Fecha:** 2026-01-07  
**Problema:** Funciones duplicadas causaban inconsistencias y bugs  
**Solución:** Centralizar cada acción en UN SOLO lugar

---

## 📋 Problema Identificado

Existían **funciones duplicadas** para las mismas acciones, causando:
- ❌ **Inconsistencias**: Una versión funcionaba, otra no
- ❌ **Bugs ocultos**: `checkInRapido()` NO validaba habitación limpia
- ❌ **Código "Frankenstein"**: Difícil mantener y debugear
- ❌ **Confusión**: No sabías cuál función usar

### Ejemplo del Problema

```typescript
// ❌ ANTES - 2 funciones para lo mismo:

// Versión 1: rack.ts (SIN validaciones)
export async function checkInRapido(reservaId: string) {
  await supabase
    .from('reservas')
    .update({ estado: 'CHECKED_IN' })
    .eq('id', reservaId)
  // ❌ NO valida habitación LIMPIA
  // ❌ NO valida habitación OPERATIVA
  // ❌ NO tiene rollback
}

// Versión 2: checkin.ts (CON validaciones)
export async function realizarCheckin(reserva_id: string) {
  // ✅ Valida habitación LIMPIA
  // ✅ Valida habitación OPERATIVA
  // ✅ Actualiza explícitamente
  // ✅ Rollback si falla
  // ✅ Errores estructurados
}
```

**Resultado:** El rack usaba la versión bugueada, el modal la correcta.

---

## ✅ Solución Implementada

### Principio: **Una Acción = Una Función**

Cada acción del sistema tiene **UNA SOLA función** en su archivo especializado:

| Acción | Archivo Único | Función |
|--------|---------------|---------|
| Check-in | `lib/actions/checkin.ts` | `realizarCheckin()` |
| Check-out | `lib/actions/checkout.ts` | `realizarCheckout()` |
| Cancelar | `lib/actions/reservas.ts` | `cancelarReserva()` |
| Registrar pago | `lib/actions/pagos.ts` | `registrarPago()` |
| Obtener pagos | `lib/actions/pagos.ts` | `getPagosByReserva()` |

---

## 🔥 Cambios Realizados

### 1. **Check-in Consolidado** ✅

**ELIMINADO:**
```typescript
// ❌ lib/actions/rack.ts
export async function checkInRapido(reservaId: string) { ... }
```

**CONSOLIDADO EN:**
```typescript
// ✅ lib/actions/checkin.ts
export async function realizarCheckin(reserva_id: string) {
  // 1️⃣ Validar estado RESERVADA
  // 2️⃣ Validar habitación LIMPIA + OPERATIVA
  // 3️⃣ Actualizar reserva
  // 4️⃣ Actualizar habitación
  // 5️⃣ Rollback si falla
  // 6️⃣ Errores estructurados con códigos
}
```

**USADO POR:**
- ✅ `rack/context-menu/reservation-context-menu.tsx`
- ✅ `reservas/reservation-detail-sheet.tsx`

---

### 2. **Cancelar Reserva Consolidado** ✅

**ELIMINADO:**
```typescript
// ❌ lib/actions/rack.ts
export async function cancelarReserva(reservaId: string) {
  // Solo cambiaba estado a CANCELADA
  // ❌ NO liberaba habitación si estaba CHECKED_IN
}
```

**CONSOLIDADO EN:**
```typescript
// ✅ lib/actions/reservas.ts
export async function cancelarReserva(reservaId: string, motivo?: string) {
  // 1️⃣ Validar que se pueda cancelar
  // 2️⃣ Actualizar estado + notas
  // 3️⃣ Si estaba CHECKED_IN: liberar habitación
  // 4️⃣ Errores estructurados
}
```

**USADO POR:**
- ✅ `rack/context-menu/reservation-context-menu.tsx`

---

### 3. **Obtener Pagos Consolidado** ✅

**ELIMINADO:**
```typescript
// ❌ lib/actions/ocupaciones.ts
export async function getPagosDeReserva(reserva_id: string) {
  // Versión con formateo de comprobantes
}
```

**CONSOLIDADO EN:**
```typescript
// ✅ lib/actions/pagos.ts
export async function getPagosByReserva(reserva_id: string): Promise<Pago[]> {
  // Versión canónica con tipo correcto
}
```

**USADO POR:**
- ✅ `reservas/reservation-detail-sheet.tsx`

---

### 4. **Funciones Legacy Marcadas** ⚠️

```typescript
// ✅ lib/actions/checkin.ts
export async function registrarPagoLegacy(data: any) {
  console.warn('⚠️ registrarPagoLegacy está deprecada. Usa lib/actions/pagos.ts')
  return { error: 'Esta función está deprecada. Usa lib/actions/pagos.ts' }
}
```

**Razón:** Evitar uso accidental de funciones viejas.

---

## 📦 Estructura Final

```
lib/actions/
  ├── checkin.ts          ✅ Todo sobre check-in
  │   └── realizarCheckin()
  │
  ├── checkout.ts         ✅ Todo sobre check-out
  │   └── realizarCheckout()
  │
  ├── reservas.ts         ✅ Gestión de reservas (NUEVO)
  │   ├── cancelarReserva()
  │   ├── calcularTotalEstimado()
  │   └── calcularNoches()
  │
  ├── pagos.ts            ✅ Todo sobre pagos
  │   ├── registrarPago()
  │   ├── getPagosByReserva()
  │   └── getSaldoPendiente()
  │
  ├── rack.ts             ✅ Solo funciones específicas del rack
  │   ├── getRackHabitaciones()
  │   ├── getRackReservas()
  │   ├── getRackKPIs()
  │   ├── buscarGlobal()
  │   ├── getAlertasRack()
  │   ├── marcarHabitacionLimpia()
  │   └── cambiarEstadoHabitacion()
  │
  └── ocupaciones.ts      ✅ Solo queries de vista
      ├── getOcupacionesActuales()
      └── getDetalleReserva()
```

---

## 🎯 Beneficios

### Antes (❌)
- 2+ funciones para la misma acción
- Comportamientos diferentes
- Bugs ocultos
- Difícil mantener
- Confusión al desarrollar

### Ahora (✅)
- **1 función** por acción
- **1 comportamiento** consistente
- **Validaciones completas** en todos lados
- **Errores estructurados** uniformes
- **Fácil de debugear** y mantener

---

## 🧪 Validación

### Checklist de Consolidación

- [x] **Check-in**: Solo `realizarCheckin()` en `checkin.ts`
- [x] **Check-out**: Solo `realizarCheckout()` en `checkout.ts`
- [x] **Cancelar**: Solo `cancelarReserva()` en `reservas.ts` (nuevo)
- [x] **Pagos**: Solo `registrarPago()` en `pagos.ts`
- [x] **Obtener pagos**: Solo `getPagosByReserva()` en `pagos.ts`
- [x] **Legacy marcado**: `registrarPagoLegacy()` con warning
- [x] **Comentarios**: Notas en código sobre consolidación
- [x] **0 errores TypeScript**: Verificado

### Componentes Actualizados

- [x] `rack/context-menu/reservation-context-menu.tsx`
  - Usa `realizarCheckin()` ✅
  - Usa `cancelarReserva()` ✅
  - Usa `registrarPago()` ✅
  
- [x] `reservas/reservation-detail-sheet.tsx`
  - Usa `realizarCheckin()` ✅
  - Usa `realizarCheckout()` ✅
  - Usa `getPagosByReserva()` ✅

---

## 📚 Guía para Nuevas Funcionalidades

### Regla de Oro: **DRY (Don't Repeat Yourself)**

Si necesitas una nueva acción:

1. **¿Ya existe?** → Busca primero en actions
2. **¿Dónde va?** → Archivo temático (checkin, pagos, etc.)
3. **Una sola vez** → Crea UNA función con validaciones completas
4. **Úsala everywhere** → Importa desde todos lados

### Ejemplo: Agregar "Cambiar Habitación"

```typescript
// ✅ CORRECTO - Una función en reservas.ts
// lib/actions/reservas.ts
export async function cambiarHabitacion(
  reserva_id: string, 
  nueva_habitacion_id: string
) {
  // 1. Validar estado
  // 2. Validar nueva habitación disponible
  // 3. Actualizar reserva
  // 4. Liberar habitación vieja
  // 5. Ocupar habitación nueva
  // 6. Return estructurado
}

// Usar desde:
// - rack context menu
// - modal de edición
// - cualquier otro lugar
```

```typescript
// ❌ INCORRECTO - Múltiples versiones
// lib/actions/rack.ts
export async function moverReservaRapido() { ... }

// lib/actions/reservas.ts
export async function cambiarHabitacion() { ... }

// lib/actions/ocupaciones.ts  
export async function reasignarHabitacion() { ... }
```

---

## 🔍 Cómo Detectar Duplicados

### Búsqueda Preventiva

```bash
# Buscar funciones con nombres similares
grep -r "export async function.*checkin" lib/actions/
grep -r "export async function.*pago" lib/actions/
grep -r "export async function.*cancelar" lib/actions/
```

### Señales de Alerta 🚨

- Misma acción con nombres ligeramente diferentes
- Comentarios "rápido", "legacy", "v2", "temp"
- Código copiado-pegado con pequeñas modificaciones
- Imports desde múltiples archivos para lo mismo

---

## 💡 Lecciones Aprendidas

1. **Centralizar temprano**: No esperar a que haya bugs
2. **Nombrar consistente**: `realizarAccion()`, no `accionRapido()`
3. **Validar completo**: Mejor una función robusta que 3 débiles
4. **Documentar decisiones**: Comentarios explican por qué
5. **Testing uniforme**: Una función = un set de tests

---

## ✅ Estado Final

**Sistema consolidado y limpio:**
- ✅ 0 funciones duplicadas
- ✅ 1 función por acción
- ✅ Validaciones completas
- ✅ Errores estructurados
- ✅ 0 errores TypeScript
- ✅ Comportamiento consistente

**No más Frankenstein. Solo arquitectura limpia.** 🎉
