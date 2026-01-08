# Módulo de Cajas - Documentación Técnica

## 📋 Resumen Ejecutivo

Se ha implementado el **Módulo completo de Cajas** con arquitectura basada en control de turnos y auditoría financiera. Incluye gestión de sesión activa (RECEPCION) y vistas administrativas (ADMIN) para cierre forzoso.

---

## 🏗️ Arquitectura Implementada

### 1. **Server Actions** (`lib/actions/cajas.ts`)

#### **Funciones de Historial:**

**a) `getCierresPasados(filtros?)`**
- Obtiene todos los turnos cerrados
- Filtros opcionales: fecha_desde, fecha_hasta, caja_id, usuario_id
- Calcula estado: CUADRADA | FALTANTE | SOBRANTE
- Retorna array de `CierrePasado`

**b) `getDetalleTurnoCerrado(turnoId)`**
- Obtiene cabecera del turno cerrado
- Obtiene lista de movimientos (JOIN con usuarios)
- Calcula estadísticas usando función SQL `calcular_movimientos_turno`
- Retorna: `DetalleTurno`

#### **Funciones de Sesión Activa:**

**c) `getTurnoActivo(userId?)`**
- Si no se proporciona userId, obtiene el del usuario actual
- Busca turno abierto por usuario
- Calcula estadísticas en tiempo real
- Retorna: `DetalleTurno | null`

**d) `getTodosLosTurnosActivos()` (SOLO ADMIN)**
- Verifica que el usuario tenga rol ADMIN
- Obtiene todos los turnos abiertos
- Retorna array de `DetalleTurno`

**e) `abrirCaja(input)`**
- Valida que el usuario NO tenga turno abierto
- Inserta nuevo registro en `caja_turnos` con estado 'ABIERTA'
- Parámetros: caja_id, monto_apertura, monto_apertura_usd
- Revalida página `/cajas`

**f) `cerrarCaja(input)`**
- Valida que el turno sea del usuario actual
- Actualiza estado a 'CERRADA'
- Guarda monto_cierre_declarado (lo que contó)
- Guarda monto_cierre_sistema (lo calculado automáticamente)
- Diferencia = declarado - sistema

**g) `forzarCierreCaja(input)` (SOLO ADMIN)**
- Permite al ADMIN cerrar el turno de otro usuario
- Útil cuando el recepcionista se olvida de cerrar
- Mismo algoritmo que cerrarCaja pero sin validación de usuario

**h) `registrarMovimiento(input)`**
- Valida que el usuario tenga turno abierto
- Valida monto > 0
- Valida motivo >= 5 caracteres
- Inserta en `caja_movimientos`
- Tipos: INGRESO | EGRESO

**i) `getCajasDisponibles()`**
- Obtiene cajas activas SIN turno abierto
- Filtra las que ya tienen un usuario en ellas
- Retorna array de `Caja`

---

### 2. **Página: Sesión Activa** (`/cajas`)

**Ubicación:** [app/(dashboard)/cajas/page.tsx](c:\app-hotel\app\(dashboard)\cajas\page.tsx)

#### **Lógica de Permisos:**

**Rol RECEPCION:**
- Consulta: `getTurnoActivo()` (solo su turno)
- Si NO tiene turno → Botón gigante "Abrir Caja"
- Si tiene turno → Widget de Caja Activa

**Rol ADMIN:**
- Consulta: `getTodosLosTurnosActivos()`
- Ve una grilla con todas las cajas abiertas de todos los usuarios
- Puede hacer "Cierre Forzoso" de cualquier turno

#### **Widget de Caja Activa:**

**KPIs (4 tarjetas):**
1. **Saldo Inicial:** `monto_apertura`
2. **Flujo Neto:** `total_ingresos_pen - total_egresos_pen`
   - Badge verde/rojo según positivo/negativo
   - Muestra detalle de ingresos y egresos
3. **Total Esperado:** `monto_apertura + flujo_neto` (Verde)
   - Lo que el sistema cree que hay en caja
4. **USD (Opcional):** Manejo de dólares

**Botones de Acción:**
- `[Registrar Movimiento]` → Abre dialog
- `[Cerrar Turno]` → Abre dialog de cierre

**Lista de Movimientos Recientes:**
- Últimas 10 transacciones
- Formato: Motivo, Hora, Usuario, Monto
- Colores: Verde (INGRESO), Rojo (EGRESO)

#### **Vista ADMIN: Todos los Turnos Activos:**
- Grid 2 columnas con cards
- Cada card muestra:
  * Nombre de caja + Usuario
  * Badge "🟢 Activo Xh Ym"
  * Monto apertura vs Total actual
  * Flujo (Ingresos/Egresos)
  * Botón "Cierre Forzoso" (destructive)

---

### 3. **Página: Historial de Cierres** (`/cajas/historial`)

**Ubicación:** [app/(dashboard)/cajas/historial/page.tsx](c:\app-hotel\app\(dashboard)\cajas\historial\page.tsx)

#### **KPIs (5 tarjetas):**
1. **Total Cierres:** Cantidad de turnos cerrados
2. **Cuadradas (Verde):** Cierres donde diferencia = 0
   - % del total
3. **Faltantes (Rojo):** Cierres con diferencia < 0
   - Suma total de lo faltante
4. **Sobrantes (Azul):** Cierres con diferencia > 0
   - Suma total de lo sobrante
5. **Balance Neto:** Sobrantes - Faltantes

#### **Tabla de Historial:**

**Ubicación:** [app/(dashboard)/cajas/historial/components/historial-cierres-table.tsx](c:\app-hotel\app\(dashboard)\cajas\historial\components\historial-cierres-table.tsx)

**Columnas:**
1. **Fecha Cierre:** dd/MM/yyyy + HH:mm
2. **Caja / Usuario:** Nombre de caja + responsable
3. **Apertura:** Monto inicial
4. **Sistema (Teórico):** Lo que debería haber
5. **Real (Físico):** Lo que contaron
6. **Estado:** Badge con color
   - 🟢 CUADRADA (verde)
   - 🔴 FALTANTE (rojo)
   - 🔵 SOBRANTE (azul)
7. **Diferencia:** Real - Sistema
   - Color según signo (verde=0, rojo=negativo, azul=positivo)
8. **Acción:** Botón "Ver" (ojo) → Abre Sheet

**Características:**
- Buscador por caja, usuario o estado
- Ordenado por fecha de cierre (más reciente primero)

---

### 4. **Sheet de Detalle** (`TurnoDetailSheet`)

**Ubicación:** [components/cajas/turno-detail-sheet.tsx](c:\app-hotel\components\cajas\turno-detail-sheet.tsx)

#### **Secciones:**

**a) Header:**
- Nombre de caja
- Badge de estado (CUADRADA/FALTANTE/SOBRANTE)
- Usuario + Fecha de cierre

**b) Resumen Financiero (4 tarjetas):**
1. **Saldo Inicial:** `monto_apertura`
2. **Flujo Neto:** Con detalle de ingresos/egresos
3. **Total Esperado:** Calculado (verde)
4. **Diferencia:** Real vs Sistema
   - Color dinámico según estado

**c) Lista de Movimientos:**
- Tabla con: Hora, Tipo, Motivo, Monto
- Badge verde (INGRESO) / rojo (EGRESO)
- Muestra categoría y comprobante_referencia si existen
- Si no hay movimientos: mensaje con icono Receipt

**d) Información del Turno:**
- Fecha/hora de apertura
- Fecha/hora de cierre
- Responsable

---

### 5. **Dialogs (Componentes de Interacción)**

#### **a) AbrirCajaDialog** (`components/cajas/abrir-caja-dialog.tsx`)

**Trigger:** Botón "Abrir Caja" (cuando no hay turno)

**Formulario:**
- Select: Cajas disponibles (sin turno abierto)
- Input: Monto Inicial PEN (requerido)
- Input: Monto Inicial USD (opcional)

**Validaciones:**
- Verifica que el usuario NO tenga turno abierto
- Monto PEN > 0

**Comportamiento:**
- Al confirmar → Llama a `abrirCaja()`
- Toast de éxito
- Refresca página → Muestra widget activo

---

#### **b) CerrarCajaDialog** (`components/cajas/cerrar-caja-dialog.tsx`)

**Trigger:** Botón "Cerrar Turno" | "Cierre Forzoso" (ADMIN)

**Props:**
- `turnoId`: ID del turno a cerrar
- `totalEsperadoPen`: Monto que el sistema calcula
- `totalEsperadoUsd`: Monto USD esperado
- `esAdmin`: Boolean (cambia UI y función)

**Formulario:**
- Input: Dinero Contado PEN (requerido)
  - Muestra "Esperado: S/ X.XX"
  - Calcula diferencia en tiempo real
  - Border rojo (FALTANTE) / azul (SOBRANTE)
- Input: Dinero Contado USD (opcional)
- Advertencia visual si hay diferencia

**Flujo:**
1. Usuario ingresa monto contado
2. Sistema calcula diferencia
3. Muestra alerta si hay descuadre
4. Botón "Cerrar Caja"
5. **AlertDialog de confirmación** (si hay diferencia)
6. Llama a `cerrarCaja()` o `forzarCierreCaja()`
7. Toast de éxito
8. Redirect a `/cajas/historial`

---

#### **c) RegistrarMovimientoDialog** (`components/cajas/registrar-movimiento-dialog.tsx`)

**Trigger:** Botón "Registrar Movimiento"

**Formulario:**
- **ToggleGroup:** INGRESO (verde) | EGRESO (rojo)
- Select: Categoría (dinámico según tipo)
  * INGRESO: Propina, Venta Directa, Reembolso, Ajuste, Otro
  * EGRESO: Compra Útiles, Propina Staff, Gastos Menores, Reembolso Cliente, Ajuste, Otro
- Select: Moneda (PEN | USD)
- Input: Monto (requerido, > 0)
- Textarea: Motivo (requerido, >= 5 caracteres)
- Input: Comprobante Referencia (opcional)

**Validaciones:**
- Monto > 0
- Motivo >= 5 caracteres

**Comportamiento:**
- Valida que el usuario tenga turno abierto
- Llama a `registrarMovimiento()`
- Toast con descripción del movimiento
- Refresca página → Actualiza lista de movimientos

---

## 🔄 Flujos de Usuario

### **Flujo Normal: Recepcionista**

1. **Inicio de Turno:**
   - Entra a `/cajas`
   - No tiene turno → Ve botón "Abrir Caja"
   - Click → Dialog
   - Selecciona caja + cuenta dinero inicial
   - Confirma → Turno activo

2. **Durante el Turno:**
   - Ve widget con KPIs en tiempo real
   - Registra movimientos manuales (propinas, gastos)
   - Los pagos de reservas se registran automáticamente

3. **Fin de Turno:**
   - Click "Cerrar Turno"
   - Cuenta dinero físico en caja
   - Ingresa monto
   - Sistema calcula diferencia
   - Si hay descuadre → Muestra alerta
   - Confirma → Turno cerrado

4. **Auditoría:**
   - Va a `/cajas/historial`
   - Ve su turno con badge de estado
   - Click "Ver" → Sheet con detalle completo

---

### **Flujo ADMIN: Cierre Forzoso**

**Escenario:** Recepcionista se fue a su casa y dejó caja abierta

1. ADMIN entra a `/cajas`
2. Ve grilla con todos los turnos activos
3. Identifica el turno de "Juan Pérez" (hace 8h abierto)
4. Click "Cierre Forzoso"
5. Va físicamente a contar el dinero de esa caja
6. Ingresa monto contado
7. Confirma cierre
8. Sistema actualiza `caja_turnos`:
   ```sql
   UPDATE caja_turnos
   SET estado = 'CERRADA'
   SET fecha_cierre = NOW()
   SET monto_cierre_declarado = [Lo que contó ADMIN]
   SET monto_cierre_sistema = [Cálculo automático]
   WHERE id = [turno_id]
   ```
9. Turno cerrado → Próximo recepcionista puede abrir su caja

---

## 📊 Lógica de Negocio

### **Cálculo de Estado de Cierre:**

```typescript
const sistema = monto_cierre_sistema || 0
const declarado = monto_cierre_declarado || 0
const diferencia = declarado - sistema

let estado: EstadoCierre = 'CUADRADA'
if (diferencia < 0) estado = 'FALTANTE'
else if (diferencia > 0) estado = 'SOBRANTE'
```

**Interpretación:**
- **CUADRADA:** El dinero físico coincide con el sistema (∆ = 0)
- **FALTANTE:** Falta dinero (∆ < 0)
  * Posible causa: Egreso no registrado
- **SOBRANTE:** Sobra dinero (∆ > 0)
  * Posible causa: Ingreso no registrado

---

### **Cálculo de Estadísticas (en tiempo real):**

Usa la función SQL `calcular_movimientos_turno(p_turno_id)`:

```sql
SELECT
  COALESCE(SUM(CASE WHEN tipo = 'INGRESO' AND moneda = 'PEN' THEN monto ELSE 0 END), 0) as total_ingresos_pen,
  COALESCE(SUM(CASE WHEN tipo = 'INGRESO' AND moneda = 'USD' THEN monto ELSE 0 END), 0) as total_ingresos_usd,
  COALESCE(SUM(CASE WHEN tipo = 'EGRESO' AND moneda = 'PEN' THEN monto ELSE 0 END), 0) as total_egresos_pen,
  COALESCE(SUM(CASE WHEN tipo = 'EGRESO' AND moneda = 'USD' THEN monto ELSE 0 END), 0) as total_egresos_usd
FROM caja_movimientos
WHERE caja_turno_id = p_turno_id
```

Luego en TypeScript:

```typescript
const flujo_neto_pen = total_ingresos_pen - total_egresos_pen
const flujo_neto_usd = total_ingresos_usd - total_egresos_usd
const total_esperado_pen = monto_apertura + flujo_neto_pen
const total_esperado_usd = monto_apertura_usd + flujo_neto_usd
```

---

## 🎯 Ventajas de esta Arquitectura

1. **Control por Turnos:** Cada usuario tiene su propio turno, evita conflictos
2. **Auditoría Completa:** Cada movimiento queda registrado con usuario y timestamp
3. **Detección de Descuadres:** Badge visual inmediato (verde/rojo/azul)
4. **Multimoneda:** Soporte para PEN y USD en paralelo
5. **Cierre Forzoso:** ADMIN puede intervenir si es necesario
6. **Inmutabilidad:** Los turnos cerrados no se pueden modificar
7. **Trazabilidad:** Cada movimiento tiene categoría, motivo y referencia opcional

---

## ✅ Checklist de Implementación

- [x] Server actions: getCierresPasados, getTurnoActivo, abrirCaja, cerrarCaja, forzarCierreCaja, registrarMovimiento
- [x] Página Sesión Activa (/cajas) con permisos por rol
- [x] Widget de Caja Activa con 4 KPIs
- [x] Vista ADMIN: Grilla de todos los turnos activos
- [x] Página Historial de Cierres con 5 KPIs
- [x] Tabla de historial con filtro y búsqueda
- [x] Sheet de Detalle de Turno (reutilizable)
- [x] Dialog: Abrir Caja
- [x] Dialog: Cerrar Caja (con cierre forzoso)
- [x] Dialog: Registrar Movimiento
- [x] Integración en Sidebar (ya existía)
- [x] Cálculo de estado (CUADRADA/FALTANTE/SOBRANTE)
- [x] Alertas visuales para descuadres
- [x] Soporte multimoneda (PEN + USD)

---

## 🚀 Próximos Pasos (Opcionales)

### 1. **Impresión de Arqueo**
- Botón "Imprimir" en Sheet de Detalle
- Genera PDF con resumen del turno
- Logo del hotel + QR de auditoría

### 2. **Alertas de Descuadres Recurrentes**
- Notificar al ADMIN si un usuario tiene > 3 faltantes
- Dashboard de métricas por usuario

### 3. **Exportación de Reportes**
- Excel con historial de cierres (filtrado por fechas)
- Resumen mensual de movimientos

### 4. **Integración con Módulo de Facturación**
- Al emitir comprobante, automáticamente registrar ingreso en caja
- Link desde comprobante al movimiento de caja

### 5. **Notificaciones en Tiempo Real**
- WebSocket para alertar al ADMIN si hay turno abierto > 12 horas

---

## 📝 Notas Técnicas

### **Tabla: caja_turnos**
- Campos críticos: `estado`, `monto_cierre_sistema`, `monto_cierre_declarado`
- Estado puede ser: 'ABIERTA' | 'CERRADA'
- `monto_cierre_sistema` se calcula automáticamente al cerrar
- `monto_cierre_declarado` es lo que el usuario ingresa

### **Tabla: caja_movimientos**
- Constraint: `monto > 0`
- Constraint: `motivo >= 5 caracteres`
- Tipo: 'INGRESO' | 'EGRESO'
- Moneda: 'PEN' | 'USD'
- Categoría: Opcional (para reportes)
- comprobante_referencia: Link opcional a factura

### **Función SQL: calcular_movimientos_turno**
- Usa COALESCE para evitar NULL
- CASE para separar PEN y USD
- CASE para separar INGRESO y EGRESO
- Retorna 4 valores: total_ingresos_pen, total_ingresos_usd, total_egresos_pen, total_egresos_usd

---

## 📚 Referencias

- [Documentación Supabase - RPC Functions](https://supabase.com/docs/guides/database/functions)
- [Next.js 15 - Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Radix UI - Dialog Component](https://www.radix-ui.com/docs/primitives/components/dialog)
- [Radix UI - Sheet Component](https://www.radix-ui.com/docs/primitives/components/sheet)
