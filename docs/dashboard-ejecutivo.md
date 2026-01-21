# Dashboard Ejecutivo - Sistema PMS Hotel

## 📊 Descripción

Dashboard de métricas empresariales diseñado **exclusivamente para el rol ADMIN** (Dueño/Gerente).

Proporciona una vista consolidada del rendimiento del negocio con métricas clave de la industria hotelera.

---

## 🔐 Control de Acceso

### Restricción por Rol
- **ADMIN**: Acceso completo al dashboard con todas las métricas
- **RECEPCION**: Redirige a vista con accesos rápidos a sus funciones
- **HOUSEKEEPING**: Redirige a vista con acceso a limpieza

**Implementación**: Validación en el servidor con `getUser()` y verificación de `rol`.

---

## 📈 Métricas Principales

### 1. **Ingresos del Mes**
- Monto total de pagos recibidos en el mes actual
- **Comparativa**: Crecimiento vs mes anterior (%)
- **Color**: Verde si positivo, Rojo si negativo
- **Fórmula**: `SUM(pagos.monto WHERE fecha_pago IN mes_actual)`

### 2. **Ocupación Actual**
- Porcentaje de habitaciones ocupadas en este momento
- **Formato**: `XX%` + cantidad ocupadas/totales
- **Fórmula**: `(habitaciones_ocupadas / habitaciones_totales) * 100`

### 3. **ADR (Average Daily Rate)**
- Tarifa promedio por noche vendida
- **Métrica estándar**: Indicador clave en industria hotelera
- **Fórmula**: `Total_ingresos_hospedaje / Total_noches_vendidas`
- **Uso**: Mide el precio promedio de venta

### 4. **RevPAR (Revenue Per Available Room)**
- Ingreso por habitación disponible (ocupada o no)
- **Métrica estándar**: Combina ocupación y tarifa
- **Fórmula**: `Ingresos_mes / (Total_habitaciones * Días_del_mes)`
- **Uso**: Mide eficiencia de generación de ingresos

### 5. **Ingresos Hoy**
- Pagos recibidos en el día actual
- **Tiempo real**: Actualización según datos actuales
- **Fórmula**: `SUM(pagos.monto WHERE fecha_pago = hoy)`

### 6. **Por Cobrar**
- Saldo pendiente de todas las reservas activas
- **Alerta**: Color naranja para visibilidad
- **Cantidad**: Número de reservas con saldo > 0
- **Fórmula**: `SUM(total_estimado - total_pagado WHERE saldo > 0)`

### 7. **Actividad del Día**
- **Check-ins**: Llegadas programadas para hoy
- **Check-outs**: Salidas programadas para hoy
- **Formato**: Números grandes con códigos de color

### 8. **Pipeline (Reservas Futuras)**
- Reservas confirmadas con fecha de entrada futura
- **Indicador**: Proyección de ocupación
- **Estado**: Solo reservas con estado = 'RESERVADA'

---

## 📊 Gráficas Interactivas

### 1. **Tendencia de Ingresos (30 días)**
- **Tipo**: Área + Línea dual-axis
- **Datos**:
  - **Eje izquierdo**: Ingresos diarios (S/)
  - **Eje derecho**: Ocupación diaria (%)
- **Visualización**: Área verde para ingresos, línea azul punteada para ocupación
- **Uso**: Identificar patrones, días pico, temporada baja

### 2. **Ingresos por Canal de Venta**
- **Tipo**: Barra horizontal
- **Datos**:
  - Monto total por canal
  - Cantidad de reservas
  - Porcentaje del total
- **Orden**: Descendente por monto
- **Uso**: Identificar canales más rentables (Directo, OTAs, Agencias)

### 3. **Resumen de Facturación SUNAT**
- **Total Facturado**: Suma de todos los comprobantes del mes
- **Desglose**:
  - Boletas (B2C)
  - Facturas (B2B)
- **Alertas**: Comprobantes pendientes de envío a SUNAT
- **Métrica adicional**: Ocupación del mes

---

## 🎯 Arquitectura Técnica

### Server Actions
**Archivo**: `lib/actions/dashboard.ts`

```typescript
// Funciones principales
getDashboardMetrics() → DashboardMetrics
getIngresosPorCanal() → IngresosPorCanal[]
getTendenciaIngresos() → TendenciaIngresos[]
getResumenFacturacion() → ResumenFacturacion
```

### Componentes

1. **Page (Server Component)**: `app/(dashboard)/page.tsx`
   - Validación de rol
   - Carga paralela de datos con `Promise.all()`
   - SSR completo

2. **Client Component**: `app/(dashboard)/dashboard-client.tsx`
   - Renderizado de gráficas con Recharts
   - Formato de moneda con `Intl.NumberFormat`
   - Responsive design

### Librerías de Gráficas
- **Recharts**: Ya instalada en el proyecto
- **Componentes**:
  - `AreaChart`: Tendencia de ingresos
  - `BarChart`: Ingresos por canal
  - `ResponsiveContainer`: Auto-ajuste responsivo

---

## 🚀 Optimizaciones Implementadas

### Performance
1. **Carga Paralela**: `Promise.all()` para 4 queries simultáneas
2. **Server-Side Rendering**: Datos pre-calculados en servidor
3. **Índices de BD**: Queries optimizadas con índices en fechas
4. **Cálculos en Memoria**: No GENERATED columns pesadas

### User Experience
1. **Feedback Visual**: Iconos de tendencia (↑↓) con colores
2. **Tooltips Informativos**: Hover en gráficas muestra detalle
3. **Responsive**: Mobile-first, grid adaptativo
4. **Loading States**: Suspense automático de Next.js

### Error Handling
1. **Try-Catch**: Todas las funciones tienen manejo de errores
2. **Valores por Defecto**: Retorna 0s en caso de fallo
3. **Logger Estructurado**: Errores registrados con contexto

---

## 🎨 Diseño Visual

### Paleta de Colores
- **Verde** (#10b981): Ingresos, check-ins, tendencias positivas
- **Azul** (#3b82f6): Ocupación, check-outs, métricas secundarias
- **Naranja** (#f97316): Alertas, pendientes, saldos
- **Rojo** (#ef4444): Tendencias negativas, descensos

### Layout
- **Grid Responsivo**: 1 columna (móvil) → 2 (tablet) → 4 (desktop)
- **Cards Shadcn**: Consistencia con resto del sistema
- **Espaciado**: `gap-3 sm:gap-4` para densidad visual

---

## 📱 Responsive Design

### Breakpoints
```css
Base:    < 640px   (Móvil)
sm:      640px+    (Tablet pequeña)
md:      768px+    (Tablet)
lg:      1024px+   (Laptop)
xl:      1280px+   (Desktop)
```

### Adaptaciones
1. **Grid KPIs**: 1 col → 2 col → 4 col
2. **Gráficas**: Full width en móvil, 2 columnas en desktop
3. **Texto**: `text-2xl` → `text-3xl` según tamaño
4. **Padding**: `p-3` → `p-4` → `p-8` progresivo

---

## 📊 Fórmulas de Negocio

### ADR (Average Daily Rate)
```
ADR = Total Ingresos Hospedaje / Total Noches Vendidas

Ejemplo:
- Ingresos del mes: S/ 30,000
- Noches vendidas: 150
- ADR = S/ 200 por noche
```

### RevPAR (Revenue Per Available Room)
```
RevPAR = Ingresos Totales / (Habitaciones × Días)
    O
RevPAR = ADR × Tasa de Ocupación

Ejemplo:
- Ingresos: S/ 30,000
- 20 habitaciones × 30 días = 600 hab-días
- RevPAR = S/ 50 por habitación disponible
```

### Tasa de Ocupación
```
Ocupación = (Noches Vendidas / Noches Disponibles) × 100

Ejemplo:
- Noches vendidas: 150
- Habitaciones: 20
- Días del mes: 30
- Total disponible: 600 (20 × 30)
- Ocupación = (150/600) × 100 = 25%
```

---

## 🔧 Mantenimiento

### Agregar Nueva Métrica

1. **Agregar Server Action** en `lib/actions/dashboard.ts`:
```typescript
export async function getMiNuevaMetrica() {
  const supabase = await createClient()
  // ... lógica
  return resultado
}
```

2. **Actualizar Type**:
```typescript
export type DashboardMetrics = {
  // ... existentes
  mi_nueva_metrica: number
}
```

3. **Cargar en Page**:
```typescript
const [metrics, nuevaMetrica] = await Promise.all([
  getDashboardMetrics(),
  getMiNuevaMetrica()
])
```

4. **Mostrar en Client Component**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Mi Nueva Métrica</CardTitle>
  </CardHeader>
  <CardContent>
    {nuevaMetrica}
  </CardContent>
</Card>
```

---

## 🎓 Glosario Hotelero

- **ADR**: Tarifa promedio por noche vendida
- **RevPAR**: Ingreso por habitación disponible
- **Ocupación**: % de habitaciones vendidas vs disponibles
- **Pipeline**: Reservas futuras confirmadas
- **Canal de Venta**: Origen de la reserva (Directo, Booking, etc.)
- **Check-in**: Registro de entrada del huésped
- **Check-out**: Registro de salida del huésped
- **Walk-in**: Cliente sin reserva previa

---

## ✅ Checklist de Validación

- [x] Restricción de acceso por rol
- [x] Carga de datos en paralelo
- [x] Métricas ADR y RevPAR calculadas
- [x] Gráfica de tendencia con dual-axis
- [x] Ingresos por canal con porcentajes
- [x] Resumen de facturación SUNAT
- [x] Comparativa mes actual vs anterior
- [x] Alertas visuales (por cobrar, pendientes)
- [x] Responsive design completo
- [x] Error handling con valores por defecto
- [x] Logger estructurado
- [x] Format de moneda en PEN

---

## 🚀 Próximas Mejoras

1. **Filtros de Fecha**: Selector de rango personalizado
2. **Exportar a PDF**: Generar reporte ejecutivo
3. **Comparativas**: Año anterior, mismo mes
4. **Proyecciones**: Machine Learning para forecast
5. **Alertas Automáticas**: Email si métricas bajan
6. **Dashboard Móvil**: App nativa con push notifications
7. **Drill-Down**: Click en gráfica para ver detalle
8. **Benchmarking**: Comparar con promedios del sector

---

## 📚 Referencias

- **Industry Standards**: [STR Global](https://str.com/data-insights)
- **Hotel Metrics**: [Hotel Tech Report](https://hoteltechreport.com/news/hotel-metrics)
- **Recharts Docs**: [recharts.org](https://recharts.org/)
- **Next.js Patterns**: [nextjs.org/docs](https://nextjs.org/docs)
