# Módulo de Facturación - Documentación Técnica

## 📋 Resumen Ejecutivo

Se ha implementado el **Módulo completo de Facturación** con arquitectura profesional lista para integración con NubeFact (SUNAT). Incluye mock funcional para desarrollo sin dependencia del servicio real.

---

## 🏗️ Arquitectura Implementada

### 1. **Vista SQL Inteligente** (`vw_historial_comprobantes`)

**Ubicación:** [supabase/migrations/20260101022650_initial_schema.sql](c:\app-hotel\supabase\migrations\20260101022650_initial_schema.sql) (líneas 491-540)

**Lógica de Negocio:**
La vista resuelve el problema de "¿De quién es este comprobante?" mediante contexto inteligente:

```sql
CASE 
    -- Caso A: Nota de Crédito → Muestra: "Anula a F001-00000023"
    WHEN c.tipo_comprobante = 'NOTA_CREDITO' THEN ...
    
    -- Caso B: Venta Normal → Muestra: "Hab 201 (Hospedado)"
    WHEN c.reserva_id IS NOT NULL THEN ...
    
    -- Caso C: Sin contexto
    ELSE 'Sin contexto'
END as contexto
```

**Campos Retornados:**
- `numero_completo`: Serie-Número con formato (ej: "B001-00000023")
- `contexto`: Texto dinámico según tipo de comprobante
- `cliente_nombre`, `cliente_doc`: Snapshot inmutable (datos fiscales)
- `estado_sunat`: PENDIENTE | ACEPTADO | RECHAZADO | ANULADO
- `emisor_nombre`: Usuario que emitió el comprobante

---

### 2. **Server Actions** (`lib/actions/comprobantes.ts`)

#### **Funciones Implementadas:**

**a) `getHistorialComprobantes(filtros)`**
- Consulta la vista `vw_historial_comprobantes`
- Filtros: tipo_comprobante, estado_sunat, fechas, búsqueda por texto
- Retorna array de comprobantes con contexto

**b) `getDetalleComprobante(comprobante_id)`**
- Obtiene cabecera del comprobante (tabla `comprobantes`)
- Obtiene items (tabla `comprobante_detalles`)
- JOIN con `reservas` y `habitaciones` para contexto
- Retorna: `{ comprobante, detalles[] }`

**c) `getEstadisticasFacturacion(fecha_desde?, fecha_hasta?)`**
- Calcula KPIs: Total Boletas, Total Facturas, Pendientes SUNAT, Anuladas
- Suma monto total vendido (excluye anulados)

**d) `emitirComprobante(input)`**
- **Algoritmo de Cobro Flexible:**
  1. Busca turno de caja activo automáticamente
  2. Obtiene correlativo atómico (previene duplicados)
  3. Genera **snapshot inmutable** (cliente, precio, fecha)
  4. Inserta en `comprobantes` (cabecera) + `comprobante_detalles` (items)
  5. TODO: Integrar con NubeFact para envío a SUNAT

**e) `anularComprobante(comprobante_id, motivo)`**
- Valida que estado sea ACEPTADO
- Marca como ANULADO
- TODO: Generar Nota de Crédito en SUNAT

---

### 3. **Página: Historial de Ventas** (`/facturacion`)

**Ubicación:** [app/(dashboard)/facturacion/page.tsx](c:\app-hotel\app\(dashboard)\facturacion\page.tsx)

**Componentes:**

#### **a) Tarjetas de Estadísticas (KPIs)**
```tsx
<EstadisticasFacturacion />
```
- Boletas Emitidas
- Facturas Emitidas
- Pendientes SUNAT (alerta visual)
- Monto Total Vendido

#### **b) Tabla de Comprobantes**
```tsx
<HistorialVentasTable />
```
**Ubicación:** [app/(dashboard)/facturacion/components/historial-ventas-table.tsx](c:\app-hotel\app\(dashboard)\facturacion\components\historial-ventas-table.tsx)

**Características:**
- **Filtros avanzados:** Tipo, Estado SUNAT, Búsqueda por texto
- **Columnas:**
  1. **Emisión:** Fecha + Hora
  2. **Documento:** Badge (Boleta/Factura) + Número completo
  3. **Cliente:** Nombre + Doc fiscal
  4. **Contexto:** "Hab 201 (Hospedado)" o "Anula a F001-23"
  5. **Estado SUNAT:** Badge con colores (Verde=Aceptado, Amarillo=Pendiente, Rojo=Rechazado/Anulado)
  6. **Total:** Monto + Moneda
  7. **Acción:** Botón "Ver" (abre Sheet)

**Lógica de Negocio:**
- ⚠️ **Alerta Pendientes Antiguos:** Si `estado=PENDIENTE` y pasaron >5 minutos, muestra icono amarillo con tooltip "Más de 5 minutos pendiente"
- **Refresh Automático:** Al cerrar Sheet, recarga la tabla para reflejar cambios

---

### 4. **Sheet de Detalle** (`ComprobanteDetailSheet`)

**Ubicación:** [components/facturacion/comprobante-detail-sheet.tsx](c:\app-hotel\components\facturacion\comprobante-detail-sheet.tsx)

**Secciones:**

#### **a) Cabecera**
- Tipo de Comprobante (grande)
- Estado SUNAT (Badge con color)
- Número completo con formato

#### **b) Información General**
- Fecha de Emisión (formato largo)
- Datos del Cliente (Snapshot inmutable):
  * Razón Social / Nombre
  * Tipo + Número de Documento
  * Dirección (si existe)
- Contexto de Venta:
  * Código de Reserva
  * Habitación + Piso

#### **c) Detalle de Items** (Tabla)
Columns: Cantidad | Descripción | P. Unitario | Subtotal

**IMPORTANTE:** Estos datos son **inmutables**. Se muestran tal cual se guardaron, NO se recalculan.

#### **d) Resumen Tributario**
```
Op. Gravadas:   S/ 100.00
Op. Exoneradas: S/ 0.00
Op. Inafectas:  S/ 0.00
IGV (18%):      S/ 18.00
─────────────────────────
TOTAL:          S/ 118.00
```

**CRÍTICO:** Estos valores vienen directos de la BD (`comprobantes`). NO se recalculan en frontend (evita errores de redondeo de JavaScript).

#### **e) Información SUNAT** (si existe)
- Hash CPE (comprobante electrónico)
- Botón para descargar XML

#### **f) Botonera de Acciones**
- **Imprimir:** Genera PDF (TODO: implementar)
- **Anular:** Solo visible si `estado_sunat = ACEPTADO`
  * Muestra AlertDialog de confirmación
  * Advierte que generará Nota de Crédito

---

### 5. **Mock de NubeFact** (`lib/services/nubefact-mock.ts`)

**Ubicación:** [lib/services/nubefact-mock.ts](c:\app-hotel\lib\services\nubefact-mock.ts)

**Propósito:** Simular respuestas de la API de NubeFact para desarrollo sin depender del servicio real.

#### **Funciones:**

**a) `enviarComprobante(datos)`**
Simula el envío a SUNAT con probabilidades reales:
- 90% → Éxito (retorna hash, XML URL, PDF URL)
- 8% → Error de Validación (RUC inválido, IGV incorrecto, etc.)
- 2% → Error de Servicio (Timeout, servicio caído)

**b) `anularComprobante(comprobante_original, motivo)`**
Simula generación de Nota de Crédito:
- 95% → Éxito
- 5% → Error ("Ya fue anulado previamente")

**c) `consultarEstado(serie, numero)`**
Consulta estado actual en SUNAT:
- 95% → ACEPTADO
- 3% → PENDIENTE
- 2% → RECHAZADO

#### **Configuración del Mock:**
```typescript
NubefactMockConfig = {
  forceError: false,      // Forzar siempre errores
  forceSuccess: false,    // Forzar siempre éxito
  customDelay: null,      // Delay personalizado (ms)
  debug: true             // Logs en consola
}
```

#### **Logger Integrado:**
```
[NUBEFACT MOCK] 📤 Enviando comprobante... { tipo: 'BOLETA', serie: 'B001', numero: 23 }
[NUBEFACT MOCK] ✅ Comprobante aceptado { hash: 'AbC123...' }
```

---

## 🔄 Flujo de Cobro Flexible

**Escenario 1: Cobro en Check-in**
1. Recepcionista hace check-in del huésped
2. Sistema pregunta: "¿Desea cobrar ahora?"
3. Si SÍ → Llama a `emitirComprobante()` + `registrarPago()`
4. Genera Boleta/Factura + Registra pago en tabla `pagos`

**Escenario 2: Cobro en Check-out**
1. Recepcionista hace check-out
2. Sistema valida: ¿Saldo pendiente > 0?
3. Si SÍ → Bloquea y pide cobrar primero
4. Si NO → Permite check-out

**Escenario 3: Cobro Intermedio**
1. Desde Sheet de Detalle de Reserva (Tab "Estado de Cuenta")
2. Botón "➕ AGREGAR PAGO"
3. Abre Dialog → Monto, Método, etc.
4. Llama a `registrarPago()` → Emite comprobante automáticamente

---

## 📊 Integración con Sidebar

**Ubicación:** [components/app-sidebar.tsx](c:\app-hotel\components\app-sidebar.tsx)

Agregado ítem:
```tsx
{
  title: 'Facturación',
  url: '/facturacion',
  icon: Receipt,
}
```

Posición: Entre "Ocupaciones" y "Cajas"

---

## 🚀 Próximos Pasos (Pendientes de Implementar)

### 1. **Integración Real con NubeFact**
- [ ] Reemplazar `nubefact-mock.ts` por cliente real
- [ ] Implementar `enviarComprobante()` con API de NubeFact
- [ ] Guardar `hash_cpe`, `xml_url`, `cdr_url` reales
- [ ] Actualizar `estado_sunat` según respuesta

### 2. **Generación de PDF**
- [ ] Implementar función `generarPDF(comprobante_id)`
- [ ] Template profesional con logo del hotel
- [ ] Incluir QR para validación SUNAT
- [ ] Botón "Imprimir" funcional en Sheet

### 3. **Cobro Automático desde Reservas**
- [ ] Agregar botón "Cobrar" en Sheet de Detalle de Reserva
- [ ] Calcular `saldo_pendiente` automáticamente
- [ ] Emitir comprobante al momento del pago

### 4. **Reintentos de Envío**
- [ ] Job que detecta comprobantes `PENDIENTE` >5 minutos
- [ ] Reintenta envío a SUNAT automáticamente
- [ ] Notifica al usuario si falla tras 3 intentos

### 5. **Notas de Crédito**
- [ ] Implementar `anularComprobante()` completo
- [ ] Generar nuevo comprobante tipo NOTA_CREDITO
- [ ] Vincular con `nota_credito_ref_id`
- [ ] Enviar a SUNAT

---

## ✅ Checklist de Implementación

- [x] Vista SQL `vw_historial_comprobantes` con columna `contexto`
- [x] Server actions: `getHistorialComprobantes`, `getDetalleComprobante`, `getEstadisticasFacturacion`
- [x] Página `/facturacion` con KPIs y tabla
- [x] Filtros avanzados (Tipo, Estado, Búsqueda)
- [x] Sheet de Detalle completo con 5 secciones
- [x] Mock de NubeFact con probabilidades reales
- [x] Integración en Sidebar
- [x] Alerta visual para pendientes >5 minutos
- [x] Tooltips y badges con colores según estado
- [ ] Generación de PDF (pendiente)
- [ ] Integración real con NubeFact (pendiente)
- [ ] Cobro desde Sheet de Reserva (pendiente)
- [ ] Sistema de reintentos (pendiente)

---

## 📝 Notas Técnicas

### **Snapshot Pattern (Inmutabilidad)**
Los datos fiscales (`cliente_nombre`, `cliente_doc`, `precio`, etc.) se copian al momento de emitir el comprobante. Si el huésped cambia su nombre en su perfil, el comprobante mantiene el dato original. **Esto es legalmente obligatorio.**

### **Correlativo Atómico**
La función SQL `obtener_siguiente_correlativo(p_serie)` usa `UPDATE ... RETURNING` para garantizar que dos usuarios no obtengan el mismo número si cobran a la vez.

### **Contexto Dinámico**
La columna `contexto` se calcula en tiempo de consulta (VIEW). No se guarda en la tabla. Esto permite que siempre muestre el estado actual de la habitación sin necesidad de actualizaciones manuales.

---

## 🎯 Ventajas de esta Arquitectura

1. **DRY:** Vista SQL centraliza lógica de contexto
2. **Performance:** Consultas optimizadas con JOINs en la vista
3. **Inmutabilidad:** Snapshot garantiza integridad fiscal
4. **Desarrollo Ágil:** Mock permite trabajar sin NubeFact
5. **UX Profesional:** Sheet lateral mantiene contexto de la tabla
6. **Escalabilidad:** Fácil agregar nuevos tipos de comprobantes

---

## 📚 Referencias

- [Documentación NubeFact](https://nubefact.com/api)
- [Normativa SUNAT - Comprobantes Electrónicos](https://www.sunat.gob.pe/)
- [Radix UI - Sheet Component](https://www.radix-ui.com/docs/primitives/components/sheet)
