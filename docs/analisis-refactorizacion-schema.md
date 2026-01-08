# 🔍 ANÁLISIS DETALLADO: Refactorización del Schema según Documento de Requerimientos

**Fecha:** 7 de Enero 2026  
**Analista:** Sistema  
**Documento de referencia:** `DOCUMENTO_DE_REQUERIMIENTOS_DEL_SISTEMA_PMS.md` v2.1

---

## 📖 CONTEXTO

El documento de requerimientos establece una **filosofía arquitectónica clara** en la sección 6.1:

> "La Base de Datos debe ser el guardián de la INTEGRIDAD, pero el Backend debe ser el dueño de la LÓGICA DE NEGOCIO"

Este análisis identifica todos los elementos del schema actual que **violan esta filosofía** y propone correcciones alineadas con el documento.

---

## 🚨 HALLAZGOS CRÍTICOS

### **1. TRIGGERS QUE DEBEN ELIMINARSE**

#### ❌ `sincronizar_estado_habitacion()`

**Ubicación actual:** `20260101022650_initial_schema.sql` líneas 420-446

**Problema:**
```sql
-- TRIGGER ACTUAL (INCORRECTO)
CREATE OR REPLACE FUNCTION sincronizar_estado_habitacion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado = 'CHECKED_IN' AND (OLD.estado IS DISTINCT FROM 'CHECKED_IN') THEN
        UPDATE public.habitaciones
        SET estado_ocupacion = 'OCUPADA', estado_limpieza = 'LIMPIA'
        WHERE id = NEW.habitacion_id;
        NEW.huesped_presente := true;
        NEW.check_in_real := now();
    END IF;
    -- ...
END;
$$ language 'plpgsql';
```

**¿Por qué es un problema según el documento?**

1. **Lógica de negocio oculta** (sección 6.3.1):
   - No es testeable con unit tests
   - No puede agregar logs de auditoría
   - No puede personalizar mensajes de error
   - Dificulta el debugging

2. **Viola el principio de explicititud:**
   ```typescript
   // ❌ ANTES: "Magia negra"
   await supabase.from('reservas').update({ estado: 'CHECKED_IN' });
   // ¿Qué pasó con la habitación? 🤷 (trigger oculto)

   // ✅ AHORA: Explícito y testeable
   await checkIn(reservaId, habitacionId);
   // En checkIn() vemos claramente:
   // 1. Validar habitación
   // 2. Actualizar reserva
   // 3. Actualizar habitación
   // 4. Registrar auditoría
   ```

3. **No permite control fino:**
   - No puedes agregar validaciones personalizadas por tipo de reserva
   - No puedes integrar con sistemas externos (PMS, cerraduras digitales)
   - No puedes enviar notificaciones

**Decisión del documento (sección 6.3.1, tabla de decisiones):**

| Trigger | Decisión | Razón |
|---------|----------|-------|
| `sincronizar_estado_habitacion()` | **❌ ELIMINAR** | Lógica de negocio → debe ser explícita en backend |

**Acción requerida:**
- ✅ Eliminar trigger `trg_gestion_estados_reserva`
- ✅ Eliminar función `sincronizar_estado_habitacion()`
- ✅ Implementar lógica explícita en `lib/actions/checkin.ts` y `lib/actions/checkout.ts`

---

#### ❌ `validar_checkin_habitacion()`

**Ubicación actual:** `20260101022650_initial_schema.sql` líneas 448-466

**Problema:**
```sql
-- TRIGGER ACTUAL (INCORRECTO)
CREATE OR REPLACE FUNCTION validar_checkin_habitacion()
RETURNS TRIGGER AS $$
DECLARE
    estado_actual_limpieza text;
    estado_actual_servicio text;
BEGIN
    IF NEW.estado = 'CHECKED_IN' AND (OLD.estado IS DISTINCT FROM 'CHECKED_IN') THEN
        SELECT estado_limpieza::text, estado_servicio::text 
        INTO estado_actual_limpieza, estado_actual_servicio
        FROM public.habitaciones 
        WHERE id = NEW.habitacion_id;
        
        IF estado_actual_servicio != 'OPERATIVA' THEN
            RAISE EXCEPTION 'No se puede hacer Check-in: La habitación está en %', estado_actual_servicio;
        END IF;
        
        IF estado_actual_limpieza != 'LIMPIA' THEN
            RAISE EXCEPTION 'No se puede hacer Check-in: La habitación está SUCIA o EN LIMPIEZA';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';
```

**¿Por qué es un problema según el documento?**

1. **Mensajes de error no amigables** (sección 6.2.2):
   - Texto genérico de BD
   - No puede personalizar por idioma
   - No puede enviar códigos de error estructurados
   - Frontend recibe un error SQL genérico

2. **Backend pierde control sobre UX:**
   ```typescript
   // ❌ ANTES: Error feo de BD
   Error: No se puede hacer Check-in: La habitación está EN_LIMPIEZA
   // Usuario no sabe qué hacer

   // ✅ AHORA: Error estructurado con acción
   {
     error: 'Habitación requiere limpieza',
     message: 'La habitación 201 está siendo limpiada. Por favor, espere a que housekeeping termine o seleccione otra habitación.',
     code: 'HABITACION_EN_LIMPIEZA',
     actions: ['ESPERAR', 'CAMBIAR_HABITACION']
   }
   ```

3. **No permite lógica condicional:**
   - No puedes permitir check-in con "advertencia" (solo bloqueo duro)
   - No puedes enviar notificación a housekeeping
   - No puedes ofrecer cambio automático de habitación

**Decisión del documento (sección 6.3.1, tabla de decisiones):**

| Trigger | Decisión | Razón |
|---------|----------|-------|
| `validar_checkin_habitacion()` | **❌ ELIMINAR** | Validación → debe dar feedback claro al usuario |

**Acción requerida:**
- ✅ Eliminar trigger `trg_validar_checkin`
- ✅ Eliminar función `validar_checkin_habitacion()`
- ✅ Implementar validaciones explícitas en `lib/actions/checkin.ts` con mensajes estructurados

---

### **2. TRIGGERS QUE DEBEN MANTENERSE** ✅

#### ✅ `proteger_comprobante_inmutable()`

**Ubicación actual:** `20260101022650_initial_schema.sql` líneas 559-572

**¿Por qué mantenerlo?**

Según el documento (sección 6.3.1):

> "Mantener proteger_comprobante_inmutable(): Seguridad de datos → última línea de defensa"

**Razón:** Si un programador junior comete un error en el backend y manda un `UPDATE` a una factura emitida, o si alguien entra directo a la BD por consola, este trigger **impide el delito tributario**.

**Ejemplo de protección:**
```sql
-- ❌ Intento de modificar factura emitida
UPDATE comprobantes SET total_venta = 50.00 WHERE id = '...';
-- ERROR: ⛔ PROHIBIDO: No se pueden modificar datos fiscales de un comprobante emitido.

-- ✅ Solo permite actualizar metadatos
UPDATE comprobantes SET estado_sunat = 'ACEPTADO', hash_cpe = '...' WHERE id = '...';
-- OK (campos permitidos)
```

**Acción:** ✅ **MANTENER SIN CAMBIOS**

---

#### ✅ `obtener_siguiente_correlativo()`

**Ubicación actual:** `20260101022650_initial_schema.sql` líneas 399-416

**¿Por qué mantenerlo?**

Según el documento (sección 6.3.1):

> "Mantener obtener_siguiente_correlativo(): Atomicidad crítica → evita race conditions"

**Razón:** Si dos recepcionistas hacen clic en "Facturar" al mismo milisegundo, el código (Node.js/Next.js) podría leer el número `100` para ambos, generando un duplicado. La base de datos bloquea la fila y garantiza secuencialidad (`100` y `101`). Esto es crítico para SUNAT.

**Ejemplo de protección:**
```typescript
// ❌ SIN la función (race condition posible)
const { data } = await supabase
  .from('series_comprobante')
  .select('correlativo_actual')
  .eq('serie', 'B001')
  .single();

const nuevo = data.correlativo_actual + 1; // ⚠️ Dos requests leen "100"

await supabase
  .from('series_comprobante')
  .update({ correlativo_actual: nuevo }) // ⚠️ Ambos escriben "101"
  .eq('serie', 'B001');

// ✅ CON la función (atómico)
const nuevo = await supabase.rpc('obtener_siguiente_correlativo', { p_serie: 'B001' });
// PostgreSQL garantiza: Request 1 → 101, Request 2 → 102
```

**Acción:** ✅ **MANTENER SIN CAMBIOS**

---

### **3. CAMPO GENERATED INNECESARIO**

#### ❌ Campo `total_estimado` en tabla `reservas`

**Ubicación actual:** `20260101022650_initial_schema.sql` líneas 223-227

**Problema:**
```sql
total_estimado numeric(12,2) GENERATED ALWAYS AS (
    precio_pactado * GREATEST(1, EXTRACT(DAY FROM (fecha_salida - fecha_entrada)))
) STORED
```

**¿Por qué es un problema según el documento?**

1. **Responsabilidad del backend** (sección 6.2.2):
   > "Backend es RESPONSABLE de: Cálculos complejos (pricing, cuentas)"

2. **Costos innecesarios:**
   - **Ocupa espacio en disco** (se guarda físicamente con STORED)
   - **Ralentiza INSERT/UPDATE** (debe recalcular en cada cambio)
   - **No es flexible** (cambiar fórmula requiere ALTER TABLE)

3. **Backend puede calcularlo fácilmente:**
   ```typescript
   // Backend (Next.js Server Action)
   const noches = Math.max(1, 
     Math.floor((fecha_salida.getTime() - fecha_entrada.getTime()) / (1000 * 60 * 60 * 24))
   );
   const total_estimado = precio_pactado * noches;
   ```

**Ejemplo de por qué es problemático:**

Imagina que mañana decides que las reservas de más de 7 noches tienen descuento progresivo:
```typescript
// Nueva lógica
if (noches >= 7) {
  total_estimado = precio_pactado * noches * 0.9; // 10% descuento
}
```

Si el campo es GENERATED, tendrías que:
1. Hacer ALTER TABLE (downtime)
2. Modificar la fórmula en SQL (no puedes usar IF complejo)
3. Reiniciar aplicación

Si es calculado en backend:
1. Cambias una línea de código
2. Deploy sin downtime
3. Listo

**Acción requerida:**
- ✅ Eliminar campo `total_estimado GENERATED`
- ✅ Calcular en backend en `lib/actions/reservas.ts`

---

### **4. VISTAS DEMASIADO COMPLEJAS**

#### ⚠️ Vista `vw_reservas_con_deuda`

**Ubicación actual:** `20260101022650_initial_schema.sql` líneas 598-642

**Problema:**
```sql
CREATE OR REPLACE VIEW public.vw_reservas_con_deuda AS
SELECT 
    -- Cálculos financieros CON SUBCONSULTAS CORRELACIONADAS ⚠️
    r.precio_pactado * GREATEST(1, EXTRACT(DAY FROM (r.fecha_salida - r.fecha_entrada))::numeric) as total_estimado,
    COALESCE((SELECT SUM(p.monto) FROM public.pagos p WHERE p.reserva_id = r.id), 0) as total_pagado,
    (r.precio_pactado * GREATEST(1, EXTRACT(DAY FROM (r.fecha_salida - r.fecha_entrada))::numeric)) - 
    COALESCE((SELECT SUM(p.monto) FROM public.pagos p WHERE p.reserva_id = r.id), 0) as saldo_pendiente,
    -- ...
FROM public.reservas r
JOIN public.habitaciones h ON r.habitacion_id = h.id
-- ...
```

**¿Por qué es un problema?**

1. **Subconsultas correlacionadas** → **O(n²) complexity**:
   - Por cada fila de `reservas`, ejecuta `SELECT SUM(...)` en `pagos`
   - Si tienes 1000 reservas, ejecuta 1000 queries adicionales
   - No aprovecha índices correctamente

2. **Lógica de negocio en la vista:**
   - Cálculo de `total_estimado` duplicado (ya identificamos que debe estar en backend)
   - Cálculo de `saldo_pendiente` (también debe estar en backend)

3. **Según el documento (sección 4.5):**
   > "Las vistas deben ser OPTIMIZADAS y SIMPLES, no contener lógica de negocio compleja"

**Solución propuesta:**

```sql
-- VISTA SIMPLIFICADA (solo JOINs básicos)
CREATE OR REPLACE VIEW public.vw_reservas_con_datos_basicos AS
SELECT 
    r.id,
    r.codigo_reserva,
    r.estado,
    r.fecha_entrada,
    r.fecha_salida,
    r.check_in_real,
    r.check_out_real,
    r.precio_pactado,
    r.huesped_presente,
    
    -- Habitación
    h.numero as habitacion_numero,
    h.piso as habitacion_piso,
    th.nombre as tipo_habitacion,
    
    -- Huésped titular
    hue.nombres || ' ' || hue.apellidos as titular_nombre,
    hue.tipo_documento as titular_tipo_doc,
    hue.numero_documento as titular_numero_doc,
    hue.correo as titular_correo,
    hue.telefono as titular_telefono,
    
    -- Metadata
    r.created_at,
    r.updated_at
    
FROM public.reservas r
JOIN public.habitaciones h ON r.habitacion_id = h.id
JOIN public.tipos_habitacion th ON h.tipo_id = th.id
LEFT JOIN public.reserva_huespedes rh ON r.id = rh.reserva_id AND rh.es_titular = true
LEFT JOIN public.huespedes hue ON rh.huesped_id = hue.id
WHERE r.estado IN ('RESERVADA', 'CHECKED_IN', 'CHECKED_OUT');
```

**Backend calcula los montos:**
```typescript
// lib/actions/ocupaciones.ts
export async function getOcupacionesConDeuda() {
  const { data: reservas } = await supabase
    .from('vw_reservas_con_datos_basicos')
    .select('*');
  
  // Calcular montos en backend (una sola query de pagos)
  const reservasIds = reservas.map(r => r.id);
  const { data: pagos } = await supabase
    .from('pagos')
    .select('reserva_id, monto')
    .in('reserva_id', reservasIds);
  
  // Map en memoria
  const pagosPorReserva = pagos.reduce((acc, p) => {
    acc[p.reserva_id] = (acc[p.reserva_id] || 0) + p.monto;
    return acc;
  }, {});
  
  return reservas.map(r => ({
    ...r,
    total_estimado: calcularTotal(r.precio_pactado, r.fecha_entrada, r.fecha_salida),
    total_pagado: pagosPorReserva[r.id] || 0,
    saldo_pendiente: calcularTotal(...) - (pagosPorReserva[r.id] || 0),
  }));
}
```

**Beneficios:**
- ✅ Vista simple y rápida (solo JOINs)
- ✅ Una sola query de pagos (batch) en lugar de N subconsultas
- ✅ Lógica de cálculo en backend (testeable, mantenible)
- ✅ Mejor performance: O(n) en lugar de O(n²)

**Acción requerida:**
- ✅ Reemplazar `vw_reservas_con_deuda` con `vw_reservas_con_datos_basicos`
- ✅ Mover cálculos a `lib/actions/ocupaciones.ts`

---

#### ⚠️ Vista `vw_historial_comprobantes` - Lógica de Presentación

**Ubicación actual:** `20260101022650_initial_schema.sql` (creada después de línea 642 en comentarios)

**Problema:**
```sql
-- Contexto inteligente con CASE y subconsultas
CASE 
    WHEN c.tipo_comprobante = 'NOTA_CREDITO' AND c.nota_credito_ref_id IS NOT NULL THEN
        'Anula a ' || (
            SELECT ref.serie || '-' || LPAD(ref.numero::text, 8, '0')
            FROM public.comprobantes ref
            WHERE ref.id = c.nota_credito_ref_id
        )
    WHEN c.reserva_id IS NOT NULL THEN
        'Hab ' || (
            SELECT h.numero 
            FROM public.reservas r
            JOIN public.habitaciones h ON r.habitacion_id = h.id
            WHERE r.id = c.reserva_id
        ) || ' (' || ...
    ELSE 'Sin contexto'
END as contexto,
```

**¿Por qué es un problema?**

1. **Lógica de presentación en la BD:**
   - Texto hardcodeado ("Anula a", "Hab") no puede traducirse
   - No puede personalizar por rol de usuario
   - Formato rígido

2. **Subconsultas ineficientes:**
   - Una por cada comprobante con nota_credito_ref_id
   - Una por cada comprobante con reserva_id
   - Degrada performance

3. **Según el documento:**
   > "El backend debe manejar la 'orquestación' y presentación de datos"

**Solución propuesta:**

```sql
-- VISTA SIMPLIFICADA (solo datos crudos)
CREATE OR REPLACE VIEW public.vw_historial_comprobantes AS
SELECT 
    c.id,
    c.fecha_emision,
    c.tipo_comprobante,
    c.serie,
    c.numero,
    
    -- DATOS SNAPSHOT (seguros)
    c.receptor_razon_social as cliente_nombre,
    c.receptor_tipo_doc,
    c.receptor_nro_doc as cliente_doc,
    c.moneda,
    c.op_gravadas,
    c.monto_igv,
    c.total_venta,
    c.estado_sunat,
    c.xml_url,
    c.cdr_url,
    
    -- IDs para referencias (backend hace JOINs si necesita)
    c.reserva_id,
    c.nota_credito_ref_id,
    ct.usuario_id,
    u.nombres || ' ' || COALESCE(u.apellidos, '') as emisor_nombre,
    c.created_at
    
FROM public.comprobantes c
JOIN public.caja_turnos ct ON c.turno_caja_id = ct.id
JOIN public.usuarios u ON ct.usuario_id = u.id
ORDER BY c.fecha_emision DESC, c.numero DESC;
```

**Backend formatea el contexto:**
```typescript
// components/facturacion/historial-table.tsx
function formatContexto(comprobante) {
  if (comprobante.tipo_comprobante === 'NOTA_CREDITO' && comprobante.nota_credito_ref_id) {
    // Hacer query adicional solo si se despliega el detalle
    const ref = await getComprobanteRef(comprobante.nota_credito_ref_id);
    return `Anula a ${ref.serie}-${ref.numero.toString().padStart(8, '0')}`;
  }
  
  if (comprobante.reserva_id) {
    const reserva = await getReservaBasica(comprobante.reserva_id);
    return `Hab ${reserva.habitacion_numero} (${reserva.estado})`;
  }
  
  return 'Sin contexto';
}
```

**Beneficios:**
- ✅ Vista rápida (sin subconsultas)
- ✅ Formateo flexible en frontend (i18n, personalización)
- ✅ Lazy loading de detalles (solo cuando se necesita)

**Acción requerida:**
- ✅ Simplificar `vw_historial_comprobantes`
- ✅ Mover formateo de contexto a frontend/backend

---

### **5. CONSTRAINT FALTANTE**

#### ❌ Tabla `tarifas` - Falta CHECK

**Según el documento (sección 3.2.4):**

```sql
**Constraint adicional:**
CHECK (precio_minimo <= precio_base)
```

**Estado actual:** ❌ **NO EXISTE**

**¿Por qué es importante?**

Sin este constraint, un usuario podría crear una tarifa ilógica:
```sql
INSERT INTO tarifas (
  tipo_habitacion_id,
  categoria_habitacion_id,
  nombre_tarifa,
  precio_base,
  precio_minimo
) VALUES (
  '...',
  '...',
  'Tarifa Rota',
  100.00,  -- precio base
  150.00   -- precio mínimo ⚠️ MAYOR que el base (ILÓGICO)
);
-- Sin CHECK: ✅ Se inserta sin problema
-- Con CHECK: ❌ ERROR inmediato
```

**Consecuencia:** Sistema permite negociar hasta S/ 150 cuando el precio sugerido es S/ 100 (absurdo comercial).

**Acción requerida:**
```sql
ALTER TABLE tarifas 
ADD CONSTRAINT check_precio_minimo_valido 
CHECK (precio_minimo <= precio_base);
```

---

### **6. ÍNDICES FALTANTES**

Según el documento (sección 7.1 - Rendimiento):

| Operación | Tiempo Máximo |
|-----------|---------------|
| Búsqueda de reserva | < 1 segundo |
| Carga de historial de facturación (primeros 100) | < 2 segundos |

**Índices que FALTAN:**

```sql
-- 1. Búsqueda de reservas por código (muy frecuente)
CREATE INDEX idx_reservas_codigo ON reservas(codigo_reserva);

-- 2. Filtrar reservas por estado (dashboard)
CREATE INDEX idx_reservas_estado ON reservas(estado);

-- 3. Filtrar reservas por fecha de entrada (llegadas del día)
CREATE INDEX idx_reservas_fecha_entrada ON reservas(fecha_entrada);

-- 4. Historial de comprobantes por fecha (reportes mensuales)
CREATE INDEX idx_comprobantes_fecha_emision ON comprobantes(fecha_emision DESC);

-- 5. Historial de turnos por usuario
CREATE INDEX idx_caja_turnos_usuario ON caja_turnos(usuario_id);

-- 6. Suma de pagos por reserva (cálculo de deuda)
CREATE INDEX idx_pagos_reserva ON pagos(reserva_id);
```

**Impacto actual SIN índices:**

```sql
-- Query lenta (SEQUENTIAL SCAN)
SELECT * FROM reservas WHERE codigo_reserva = 'A3F7K9M2';
-- Tiempo: ~500ms en 10,000 registros

-- Con índice (INDEX SCAN)
-- Tiempo: ~5ms
```

**Acción requerida:**
- ✅ Crear todos los índices listados

---

### **7. TIPO `TICKET_INTERNO` INNECESARIO**

**Ubicación actual:** `20260101022650_initial_schema.sql` línea 26

```sql
CREATE TYPE tipo_comprobante_enum AS ENUM ('BOLETA', 'FACTURA', 'NOTA_CREDITO', 'TICKET_INTERNO');
```

**Problema:** El documento **NUNCA menciona** `TICKET_INTERNO`. Solo habla de:
- BOLETA (sección 4.4.1)
- FACTURA (sección 4.4.1)
- NOTA_CREDITO (sección 4.4.2)

**¿Cuándo se usa `TICKET_INTERNO`?**

Revisando el código...

No se usa en ningún lado. Es un valor "por si acaso" que nunca se implementó.

**Decisión:**

Opción A: **Eliminarlo** (limpieza estricta)
```sql
-- Requiere verificar que NO exista ningún comprobante con ese tipo
ALTER TYPE tipo_comprobante_enum RENAME TO tipo_comprobante_enum_old;
CREATE TYPE tipo_comprobante_enum AS ENUM ('BOLETA', 'FACTURA', 'NOTA_CREDITO');
ALTER TABLE comprobantes 
  ALTER COLUMN tipo_comprobante TYPE tipo_comprobante_enum 
  USING tipo_comprobante::text::tipo_comprobante_enum;
DROP TYPE tipo_comprobante_enum_old;
```

Opción B: **Mantenerlo** (pragmático, evita complejidad)
- No ocupa espacio
- Podría usarse en el futuro para ventas internas sin CPE

**Recomendación:** **Opción B** (mantener). No vale la pena el riesgo de la migración.

---

## 📋 RESUMEN EJECUTIVO

### Cambios CRÍTICOS (Alta Prioridad)

| # | Cambio | Tipo | Justificación | Archivo Afectado |
|---|--------|------|---------------|------------------|
| 1 | Eliminar trigger `sincronizar_estado_habitacion` | DELETE | Lógica de negocio debe ser explícita (doc 6.3.1) | SQL Migration |
| 2 | Eliminar trigger `validar_checkin_habitacion` | DELETE | Validaciones con mensajes amigables en backend (doc 6.3.1) | SQL Migration |
| 3 | Eliminar campo `total_estimado` GENERATED | ALTER TABLE | Cálculos en backend (doc 6.2.2) | SQL Migration |
| 4 | Agregar CHECK en tabla `tarifas` | ALTER TABLE | Integridad de datos (doc 3.2.4) | SQL Migration |

### Cambios IMPORTANTES (Media Prioridad)

| # | Cambio | Tipo | Justificación | Archivo Afectado |
|---|--------|------|---------------|------------------|
| 5 | Simplificar vista `vw_reservas_con_deuda` | REPLACE VIEW | Performance O(n²) → O(n) (doc 4.5) | SQL Migration + Backend |
| 6 | Simplificar vista `vw_historial_comprobantes` | REPLACE VIEW | Lógica de presentación en frontend (doc 4.5) | SQL Migration + Frontend |
| 7 | Agregar 6 índices faltantes | CREATE INDEX | Performance < 1s (doc 7.1) | SQL Migration |

### Cambios OPCIONALES (Baja Prioridad)

| # | Cambio | Tipo | Justificación | Archivo Afectado |
|---|--------|------|---------------|------------------|
| 8 | Eliminar `TICKET_INTERNO` de enum | ALTER TYPE | Limpieza (no en documento) | Recomendado: NO hacer |

---

## 🔄 MIGRACIÓN PROPUESTA

Se creará archivo: `supabase/migrations/20260107000002_refactor_schema.sql`

**Contenido:**

1. ✅ DROP triggers innecesarios
2. ✅ ALTER TABLE reservas (eliminar GENERATED)
3. ✅ ALTER TABLE tarifas (agregar CHECK)
4. ✅ REPLACE vistas simplificadas
5. ✅ CREATE índices faltantes
6. ✅ Verificaciones finales

---

## ⚠️ IMPACTO EN CÓDIGO EXISTENTE

### Backend (Server Actions)

**Archivos que DEBEN modificarse:**

1. `lib/actions/checkin.ts`:
   - ✅ Implementar lógica de sincronización de estados
   - ✅ Agregar validaciones explícitas
   - ✅ Manejar errores estructurados

2. `lib/actions/checkout.ts`:
   - ✅ Implementar cambio de estados explícito
   - ✅ Agregar logs de auditoría

3. `lib/actions/ocupaciones.ts`:
   - ✅ Reemplazar llamada a `vw_reservas_con_deuda`
   - ✅ Calcular totales en backend

4. `lib/actions/reservas.ts`:
   - ✅ Calcular `total_estimado` en cada query
   - ✅ Helper function `calcularTotal()`

### Frontend (Componentes)

**Archivos que DEBEN modificarse:**

1. `components/facturacion/historial-table.tsx`:
   - ✅ Formatear contexto en frontend
   - ✅ Lazy load de detalles

---

## ✅ CHECKLIST DE VALIDACIÓN POST-MIGRACIÓN

### Base de Datos
- [ ] Triggers eliminados correctamente
- [ ] Función `proteger_comprobante_inmutable` sigue activa
- [ ] Función `obtener_siguiente_correlativo` sigue activa
- [ ] CHECK constraint en `tarifas` funciona
- [ ] Vistas simplificadas retornan datos correctos
- [ ] Índices creados y activos

### Backend
- [ ] Check-in funciona sin trigger
- [ ] Check-out funciona sin trigger
- [ ] Validaciones muestran mensajes claros
- [ ] Cálculo de `total_estimado` funciona
- [ ] Ocupaciones muestra deudas correctamente

### Frontend
- [ ] Dashboard de habitaciones carga < 2s
- [ ] Búsqueda de reservas < 1s
- [ ] Historial de facturación carga < 2s
- [ ] Contexto de comprobantes se muestra correctamente

### Performance
- [ ] Query de reservas por código usa índice
- [ ] Query de comprobantes por fecha usa índice
- [ ] Vista ocupaciones es más rápida que antes

---

## 📚 REFERENCIAS

- Documento de Requerimientos v2.1, Sección 6: Arquitectura y Decisiones Técnicas
- Documento de Requerimientos v2.1, Sección 6.3.1: Triggers a mantener/eliminar
- Documento de Requerimientos v2.1, Sección 4.5: Vistas Optimizadas
- Documento de Requerimientos v2.1, Sección 7.1: Requerimientos de Performance

---

**Fin del análisis**
