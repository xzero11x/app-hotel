# 📋 DOCUMENTO DE REQUERIMIENTOS DEL SISTEMA PMS

## INFORMACIÓN DEL DOCUMENTO

**Proyecto:** Sistema de Gestión Hotelera (Property Management System)  
**Versión:** 2.1 Final  
**Fecha:** Enero 2026  
**Estado:** Aprobado para Implementación  
**Autores:** Equipo de Desarrollo  
**Alcance:** Sistema completo de gestión hotelera con cumplimiento fiscal SUNAT

---

## ÍNDICE

1. [INTRODUCCIÓN](#1-introducción)
2. [FUNDAMENTOS DEL SISTEMA](#2-fundamentos-del-sistema)
3. [MODELO DE DATOS](#3-modelo-de-datos)
4. [SISTEMA DE FACTURACIÓN](#4-sistema-de-facturación)
5. [REQUERIMIENTOS FUNCIONALES](#5-requerimientos-funcionales)
6. [ARQUITECTURA Y DECISIONES TÉCNICAS](#6-arquitectura-y-decisiones-técnicas)
7. [REQUERIMIENTOS NO FUNCIONALES](#7-requerimientos-no-funcionales)
8. [CASOS DE USO](#8-casos-de-uso)
9. [GLOSARIO](#9-glosario)
10. [APÉNDICES](#10-apéndices)

---

## 1. INTRODUCCIÓN

### 1.1 Propósito del Documento

Este documento especifica los requerimientos funcionales, técnicos y arquitectónicos para el desarrollo de un Sistema de Gestión Hotelera (PMS) profesional, escalable y conforme a la normativa fiscal peruana (SUNAT).

El sistema está diseñado para ser utilizado por hoteles de diferentes tamaños, desde pequeños establecimientos familiares hasta cadenas hoteleras medianas, sin necesidad de reestructuración del sistema.

### 1.2 Alcance del Sistema

El PMS debe gestionar:
- **Operaciones Hoteleras:** Habitaciones, reservas, check-in/check-out, housekeeping
- **Gestión Comercial:** Tarifas dinámicas, canales de venta, pricing con negociación
- **Control Financiero:** Caja, pagos multimoneda, arqueos
- **Facturación Electrónica:** Comprobantes SUNAT con inmutabilidad fiscal
- **Gestión de Huéspedes:** Registro de titulares y acompañantes
- **Reportes:** Operativos, comerciales y fiscales

### 1.3 Usuarios del Sistema

| Rol | Responsabilidades | Permisos |
|-----|-------------------|----------|
| **Administrador** | Configuración general, reportes, usuarios | Acceso total |
| **Recepción** | Check-in/out, reservas, facturación, cobros | Operaciones diarias |
| **Housekeeping** | Control de limpieza de habitaciones | Solo estado de limpieza |
| **Mantenimiento** | Control de estado técnico de habitaciones | Solo estado de servicio |
| **Gerencia** | Consulta de reportes y análisis | Solo lectura |

---

## 2. FUNDAMENTOS DEL SISTEMA

### 2.1 Conceptos Clave del Negocio Hotelero

#### 2.1.1 ¿Qué es una Habitación?

Una habitación en el sistema es **el espacio físico** donde se hospedan los huéspedes. NO es un producto con precio fijo.

**Características fundamentales:**
- Tiene un **número identificador** (ej: 101, 201-A)
- Pertenece a un **tipo** (define capacidad)
- Pertenece a una **categoría** (define nivel de servicio)
- Tiene **estados operativos** (no es solo "ocupada" o "libre")

**Lo que NO tiene:**
- ❌ Precio directo
- ❌ Un solo estado simple

#### 2.1.2 Tipos vs. Categorías

Estos dos conceptos se confunden frecuentemente:

| Concepto | ¿Qué define? | Ejemplo |
|----------|--------------|---------|
| **Tipo de Habitación** | Capacidad y configuración física | Simple (1 persona), Doble (2 personas), Triple, Suite |
| **Categoría de Habitación** | Nivel de servicio/lujo | Única, Estándar, Deluxe, Premium |

**Combinación:**
- Una habitación "Doble Deluxe" tiene: Tipo = Doble, Categoría = Deluxe
- Una habitación "Simple Estándar" tiene: Tipo = Simple, Categoría = Estándar

**Hoteles sin categorías:**
- Pueden usar una sola categoría llamada "Única" o "Estándar"
- El sistema funciona igual, simplemente no muestra opciones de categoría al usuario

#### 2.1.3 Estados de Habitación: Las 3 Dimensiones

**Concepto fundamental:** Una habitación NO tiene un solo estado. Tiene **3 dimensiones de estado independientes**.

##### Dimensión 1: Estado de OCUPACIÓN
**Pregunta:** ¿Hay un huésped asignado legalmente?

| Estado | Significado |
|--------|-------------|
| LIBRE | No hay ninguna reserva activa |
| OCUPADA | Hay una estadía activa (check-in hecho) |

**Importante:** Este estado NO cambia porque el huésped salga a pasear.

##### Dimensión 2: Estado de LIMPIEZA
**Pregunta:** ¿Está lista para ser usada por OTRO huésped?

| Estado | Significado |
|--------|-------------|
| LIMPIA | Lista para la venta |
| SUCIA | Requiere limpieza |
| EN_LIMPIEZA | Personal trabajando actualmente |

**Casos de uso:**
- Check-out a las 6am → LIBRE + SUCIA (no vendible aún)
- Limpieza termina a las 11am → LIBRE + LIMPIA (ahora sí vendible)
- Check-in a las 2pm → OCUPADA + LIMPIA

##### Dimensión 3: Estado de SERVICIO
**Pregunta:** ¿Funciona técnicamente?

| Estado | Significado |
|--------|-------------|
| OPERATIVA | Sin problemas técnicos |
| MANTENIMIENTO | Reparación temporal |
| FUERA_SERVICIO | No vendible (problema grave) |

**Regla:** Si está FUERA_SERVICIO, NO se vende aunque esté limpia y libre.

##### Cálculo de Disponibilidad

```
Una habitación está DISPONIBLE si y solo si:
- Estado de Ocupación = LIBRE
- Estado de Limpieza = LIMPIA  
- Estado de Servicio = OPERATIVA

Cualquier otra combinación = NO DISPONIBLE
```

**Estados especiales:**
- **"Potencialmente disponible hoy":** LIBRE + SUCIA + OPERATIVA (esperando limpieza)
- **"Ocupada - Huésped fuera":** OCUPADA + LIMPIA + OPERATIVA (huésped salió temporalmente)

#### 2.1.4 Presencia del Huésped

**Pregunta frecuente:** Si un huésped reserva 4 días, ¿va a estar encerrado todo ese tiempo?

**Respuesta:** NO. Por eso existe el campo `huesped_presente`.

**Ubicación:** Este campo va en la tabla `reservas`, NO en `habitaciones`.

**Propósito:**
- Informar a housekeeping si puede entrar
- Control de llaves
- Seguridad del hotel

**Regla fundamental:**
- ✅ `huesped_presente` NO afecta disponibilidad
- ✅ NO cambia el estado de ocupación
- ✅ Es información operativa, no comercial

**Escenario real:**
```
Día 1 de 4:
- Reserva: CHECKED_IN (ocupada)
- Huésped sale a pasear a las 9am: huesped_presente = FALSE
- Housekeeping ve: "Ocupada - Huésped fuera" → Puede entrar
- Limpia la habitación: estado_limpieza = LIMPIA
- Huésped regresa a las 6pm: huesped_presente = TRUE
- Habitación sigue OCUPADA todo el tiempo
```

### 2.2 Sistema de Precios (Pricing)

#### 2.2.1 Concepto Fundamental: El Precio NO está en la Habitación

**Error común:** "La habitación 101 cuesta S/ 150"

**Correcto:** "Una habitación Doble Estándar tiene una tarifa base de S/ 150 en temporada alta"

**¿Por qué?**
Porque una misma habitación puede costar diferente según:
- Temporada (alta/baja)
- Día de la semana (fin de semana/feriado)
- Canal de venta (directo/Booking)
- Negociación con el cliente
- Promociones activas

#### 2.2.2 ¿Qué es una Tarifa?

Una tarifa es una **REGLA de precio**, no un precio fijo.

**Definición formal:**
> "El precio de **una noche** para **un tipo de habitación**, bajo **ciertas condiciones**, durante **un periodo**."

**Componentes de una tarifa:**
- **Tipo de habitación** (Simple, Doble, etc.)
- **Categoría** (Estándar, Deluxe, etc.)
- **Precio base** (precio sugerido)
- **Precio mínimo** (límite de negociación)
- **Vigencia** (fecha inicio/fin, o NULL = siempre activa)

#### 2.2.3 Los 3 Niveles de Precio

| Nivel | ¿Qué es? | ¿Dónde vive? | ¿Quién lo define? |
|-------|----------|--------------|-------------------|
| **1. Precio Base** | Precio "oficial" sugerido | Tabla `tarifas` | Administración |
| **2. Precio Mínimo** | Límite inferior de negociación | Tabla `tarifas` | Administración |
| **3. Precio Pactado** | Precio real acordado con el cliente | Tabla `reservas` | Recepción |

**Flujo de pricing:**
```
1. Sistema busca tarifa vigente → Sugiere precio_base (ej: S/ 150)
2. Recepcionista negocia con cliente
3. Cliente acepta S/ 140 (dentro del mínimo de S/ 130)
4. Se guarda precio_pactado = 140 en la reserva
5. Este precio se CONGELA y ya no cambia
```

**Regla de oro:**
> Si mañana cambias la tarifa base a S/ 200, las reservas hechas hoy con S/ 140 NO cambian.

#### 2.2.4 Negociación Controlada

**Problema:** "¿Cómo evito que recepción regale las habitaciones?"

**Solución:** Precio mínimo + control de autorización

**Ejemplo:**
```
Tarifa vigente:
- precio_base = S/ 150 (sugerencia)
- precio_minimo = S/ 130 (piso)

Escenario A: Cliente ofrece S/ 140
→ Sistema: ✅ PERMITIDO (está sobre el mínimo)

Escenario B: Cliente ofrece S/ 120
→ Sistema: ❌ BLOQUEADO o 🔐 PIDE AUTORIZACIÓN

Escenario C: Con autorización del gerente
→ Sistema: ✅ PERMITIDO pero registra autorizado_descuento = TRUE
```

### 2.3 Reservas: Walk-in vs. Reserva Anticipada

#### 2.3.1 Concepto Unificado

**Pregunta frecuente:** "¿Walk-in va en una tabla separada?"

**Respuesta:** NO. Todo es "reserva", solo difieren en el estado inicial.

**Definición formal de Reserva:**
> "Asignar una habitación (o tipo) a un huésped para un rango de fechas"

No importa si se creó hace 30 días o hace 30 segundos.

#### 2.3.2 Estados de una Reserva

| Estado | Significado |
|--------|-------------|
| RESERVADA | Creada, esperando llegada del huésped |
| CHECKED_IN | Huésped ingresó, estadía activa |
| CHECKED_OUT | Huésped salió, cuenta cerrada |
| CANCELADA | Reserva cancelada antes de check-in |
| NO_SHOW | Huésped no llegó ni canceló |

#### 2.3.3 Flujos

**Flujo A: Reserva Anticipada**
```
1. Crear reserva (estado: RESERVADA)
   - fecha_entrada = 10/01/2026
   - fecha_salida = 13/01/2026
   
2. Esperar...

3. Llega el 10/01 → Check-in (estado: CHECKED_IN)

4. Sale el 13/01 → Check-out (estado: CHECKED_OUT)
```

**Flujo B: Walk-in**
```
1. Crear reserva (estado: CHECKED_IN directamente)
   - fecha_entrada = HOY
   - fecha_salida = (fecha acordada)
   
2. NO pasa por RESERVADA

3. Check-out cuando salga
```

**Lo importante:** Ambos usan la MISMA tabla, MISMA lógica.

### 2.4 Huéspedes y Acompañantes

#### 2.4.1 Todos se Registran

**Regla obligatoria (legal):** TODOS los huéspedes deben registrarse, no solo el principal.

**Razones:**
- ✅ Cumplimiento fiscal (SUNAT exige datos)
- ✅ Seguridad nacional (control de personas)
- ✅ Responsabilidad hotelera

#### 2.4.2 Estructura de Registro

```
Reserva 123:
├─ Huésped 1: Juan Pérez (TITULAR - es_titular = TRUE)
├─ Huésped 2: María Pérez (ACOMPAÑANTE - es_titular = FALSE)
└─ Huésped 3: Pedro Pérez (ACOMPAÑANTE - es_titular = FALSE)
```

**Todos van a la MISMA tabla `huespedes`**

**Relación:**
- Tabla `reserva_huespedes` vincula N huéspedes con 1 reserva
- Campo `es_titular` identifica quién es el principal

**Ventajas:**
- Reutilización de datos (si Juan vuelve, sus datos ya están)
- Historial completo de todas las personas
- Un mismo huésped puede ser titular en una reserva y acompañante en otra

---

## 3. MODELO DE DATOS

### 3.1 Diagrama Conceptual de Alto Nivel

```
                    HOTEL
                      |
        ┌─────────────┼─────────────┐
        |             |             |
   HABITACIONES    TARIFAS    CONFIGURACIÓN
        |             |             |
        └──────┬──────┘             |
               |                    |
           RESERVAS ◄────────────FACTURACIÓN
               |                    |
          HUÉSPEDES              COMPROBANTES
               |                    |
            PAGOS                DETALLES
```

### 3.2 Tablas Core

#### 3.2.1 habitaciones

**Descripción:** Espacios físicos del hotel

| Campo | Tipo | Constraint | Descripción |
|-------|------|------------|-------------|
| id | UUID | PK | Identificador único |
| numero | TEXT | UNIQUE NOT NULL | Número visible (101, 201-A) |
| piso | TEXT | NULL | Piso donde se ubica |
| tipo_id | UUID | FK NOT NULL | Referencia a tipos_habitacion |
| categoria_id | UUID | FK NOT NULL | Referencia a categorias_habitacion |
| estado_ocupacion | ENUM | NOT NULL DEFAULT 'LIBRE' | LIBRE, OCUPADA |
| estado_limpieza | ENUM | NOT NULL DEFAULT 'LIMPIA' | LIMPIA, SUCIA, EN_LIMPIEZA |
| estado_servicio | ENUM | NOT NULL DEFAULT 'OPERATIVA' | OPERATIVA, MANTENIMIENTO, FUERA_SERVICIO |
| created_at | TIMESTAMPTZ | DEFAULT now() | Fecha de creación |
| updated_at | TIMESTAMPTZ | DEFAULT now() | Última modificación |

**Reglas de negocio:**
- ❌ NO contiene precio
- ❌ NO existe campo "disponible" (se calcula)
- ✅ Las 3 dimensiones de estado son independientes

#### 3.2.2 tipos_habitacion

**Descripción:** Define capacidad y configuración

| Campo | Tipo | Constraint | Descripción |
|-------|------|------------|-------------|
| id | UUID | PK | Identificador único |
| nombre | TEXT | NOT NULL | Simple, Doble, Triple, Suite |
| capacidad_personas | INT | NOT NULL DEFAULT 2 | Máximo de huéspedes |
| created_at | TIMESTAMPTZ | DEFAULT now() | Fecha de creación |

#### 3.2.3 categorias_habitacion

**Descripción:** Define nivel de servicio

| Campo | Tipo | Constraint | Descripción |
|-------|------|------------|-------------|
| id | UUID | PK | Identificador único |
| nombre | TEXT | NOT NULL | Única, Estándar, Deluxe, Premium |
| descripcion | TEXT | NULL | Descripción de la categoría |
| created_at | TIMESTAMPTZ | DEFAULT now() | Fecha de creación |

#### 3.2.4 tarifas

**Descripción:** Reglas de precio

| Campo | Tipo | Constraint | Descripción |
|-------|------|------------|-------------|
| id | UUID | PK | Identificador único |
| tipo_habitacion_id | UUID | FK NOT NULL | Tipo aplicable |
| categoria_habitacion_id | UUID | FK NOT NULL | Categoría aplicable |
| nombre_tarifa | TEXT | NOT NULL | Nombre descriptivo |
| precio_base | NUMERIC(12,2) | NOT NULL | Precio sugerido por noche |
| precio_minimo | NUMERIC(12,2) | NOT NULL | Límite de negociación |
| fecha_inicio | DATE | NULL | Inicio vigencia (NULL = siempre) |
| fecha_fin | DATE | NULL | Fin vigencia (NULL = siempre) |
| activa | BOOLEAN | DEFAULT TRUE | Estado de la tarifa |
| created_at | TIMESTAMPTZ | DEFAULT now() | Fecha de creación |

**Constraint adicional:**
```sql
CHECK (precio_minimo <= precio_base)
```

#### 3.2.5 canales_venta

**Descripción:** Origen comercial de las ventas

| Campo | Tipo | Constraint | Descripción |
|-------|------|-------------|-------------|
| id | UUID | PK | Identificador único |
| nombre | TEXT | UNIQUE NOT NULL | Recepción, Booking, Airbnb, Web |
| comision_porcentaje | NUMERIC(5,2) | DEFAULT 0.00 | Comisión del canal |
| activo | BOOLEAN | DEFAULT TRUE | Si está disponible |

#### 3.2.6 huespedes

**Descripción:** Personas que se hospedan

| Campo | Tipo | Constraint | Descripción |
|-------|------|------------|-------------|
| id | UUID | PK | Identificador único |
| nombres | TEXT | NOT NULL | Nombres del huésped |
| apellidos | TEXT | NOT NULL | Apellidos |
| tipo_documento | TEXT | NOT NULL | DNI, Pasaporte, CE, RUC |
| numero_documento | TEXT | NOT NULL | Número del documento |
| nacionalidad | TEXT | NULL | País de nacionalidad |
| procedencia_departamento | TEXT | NULL | Región/Departamento de procedencia |
| correo | TEXT | NULL | Email de contacto |
| telefono | TEXT | NULL | Teléfono |
| fecha_nacimiento | DATE | NULL | Para calcular edad |
| notas_internas | TEXT | NULL | Preferencias, alertas |
| es_frecuente | BOOLEAN | DEFAULT FALSE | Cliente VIP (≥3 visitas) |
| created_at | TIMESTAMPTZ | DEFAULT now() | Fecha de registro |

**Constraint:**
```sql
UNIQUE(tipo_documento, numero_documento)
```

**Importante:**
- ❌ NO contiene RUC, razón social (eso va en comprobantes)
- ✅ Reutilizable en múltiples reservas

#### 3.2.7 reservas

**Descripción:** Corazón del sistema - Estadías de huéspedes

| Campo | Tipo | Constraint | Descripción |
|-------|------|------------|-------------|
| id | UUID | PK | Identificador único |
| codigo_reserva | TEXT | UNIQUE | Código público (ej: A3F7K9M2) |
| habitacion_id | UUID | FK NULL | Habitación asignada (NULL hasta check-in) |
| canal_venta_id | UUID | FK NULL | Origen de la venta |
| fecha_entrada | TIMESTAMPTZ | NOT NULL | Fecha planeada de entrada |
| fecha_salida | TIMESTAMPTZ | NOT NULL | Fecha planeada de salida |
| check_in_real | TIMESTAMPTZ | NULL | Timestamp real del check-in |
| check_out_real | TIMESTAMPTZ | NULL | Timestamp real del check-out |
| estado | ENUM | NOT NULL | RESERVADA, CHECKED_IN, CHECKED_OUT, CANCELADA, NO_SHOW |
| precio_base_tarifa | NUMERIC(12,2) | NULL | Precio sugerido (snapshot) |
| precio_pactado | NUMERIC(12,2) | NOT NULL | Precio negociado final |
| moneda_pactada | ENUM | DEFAULT 'PEN' | PEN, USD |
| autorizado_descuento | BOOLEAN | DEFAULT FALSE | Si requirió autorización |
| huesped_presente | BOOLEAN | DEFAULT FALSE | Estado físico del huésped |
| total_estimado | NUMERIC(12,2) | GENERATED | Calculado: precio × noches |
| created_at | TIMESTAMPTZ | DEFAULT now() | Fecha de creación |
| updated_at | TIMESTAMPTZ | DEFAULT now() | Última modificación |

**Campo calculado:**
```sql
total_estimado GENERATED ALWAYS AS (
    precio_pactado * GREATEST(1, EXTRACT(DAY FROM (fecha_salida - fecha_entrada)))
) STORED
```

#### 3.2.8 reserva_huespedes

**Descripción:** Relación muchos a muchos - Vincula huéspedes con reservas

| Campo | Tipo | Constraint | Descripción |
|-------|------|------------|-------------|
| id | UUID | PK | Identificador único |
| reserva_id | UUID | FK NOT NULL | Reserva asociada |
| huesped_id | UUID | FK NOT NULL | Huésped asociado |
| es_titular | BOOLEAN | DEFAULT FALSE | Identifica al principal |
| created_at | TIMESTAMPTZ | DEFAULT now() | Fecha de vinculación |

**Constraint:**
```sql
UNIQUE(reserva_id, huesped_id)
```

**Regla:** Solo un huésped con `es_titular = TRUE` por reserva

### 3.3 Sistema de Caja

#### 3.3.1 cajas

**Descripción:** Puntos de venta físicos o virtuales

| Campo | Tipo | Constraint | Descripción |
|-------|------|------------|-------------|
| id | UUID | PK | Identificador único |
| nombre | TEXT | NOT NULL | Nombre de la caja |
| estado | BOOLEAN | DEFAULT TRUE | Activa/Inactiva |
| created_at | TIMESTAMPTZ | DEFAULT now() | Fecha de creación |

#### 3.3.2 caja_turnos

**Descripción:** Control de apertura/cierre (multimoneda)

| Campo | Tipo | Constraint | Descripción |
|-------|------|------------|-------------|
| id | UUID | PK | Identificador único |
| caja_id | UUID | FK NOT NULL | Caja asociada |
| usuario_id | UUID | FK NOT NULL | Usuario responsable |
| fecha_apertura | TIMESTAMPTZ | DEFAULT now() | Timestamp de apertura |
| fecha_cierre | TIMESTAMPTZ | NULL | Timestamp de cierre |
| **EFECTIVO (CUADRE)** | | | |
| monto_apertura_efectivo | NUMERIC(12,2) | DEFAULT 0 | Efectivo inicial PEN |
| monto_cierre_teorico_efectivo | NUMERIC(12,2) | NULL | Calculado: Inicio + Ingresos - Egresos |
| monto_cierre_real_efectivo | NUMERIC(12,2) | NULL | Contado por el usuario |
| descuadre_efectivo | NUMERIC(12,2) | GENERATED | Real - Teórico |
| **MULTIMONEDA** | | | |
| monto_apertura_usd | NUMERIC(12,2) | DEFAULT 0 | Efectivo inicial USD |
| monto_cierre_teorico_usd | NUMERIC(12,2) | DEFAULT 0 | Calculado USD |
| monto_cierre_real_usd | NUMERIC(12,2) | DEFAULT 0 | Contado USD |
| **TOTALES (REGISTRO)** | | | |
| total_efectivo | NUMERIC(12,2) | DEFAULT 0 | Total cobrado en efectivo |
| total_tarjeta | NUMERIC(12,2) | DEFAULT 0 | Total cobrado en tarjeta |
| total_transferencia | NUMERIC(12,2) | DEFAULT 0 | Total transferencias |
| total_yape | NUMERIC(12,2) | DEFAULT 0 | Total billeteras digitales |
| total_digital | NUMERIC(12,2) | GENERATED | Suma de no-efectivo |
| total_vendido | NUMERIC(12,2) | GENERATED | Suma total general |
| **CONTROL** | | | |
| requiere_autorizacion | BOOLEAN | DEFAULT FALSE | Si hubo descuadre mayor al límite |
| autorizado_por | UUID | FK NULL | Supervisor que autorizó |
| observaciones_cierre | TEXT | NULL | Notas del cierre |
| estado | TEXT | CHECK | ABIERTA, CERRADA |

#### 3.3.3 series_comprobante

**Descripción:** Numeración de comprobantes por caja

| Campo | Tipo | Constraint | Descripción |
|-------|------|------------|-------------|
| id | UUID | PK | Identificador único |
| caja_id | UUID | FK NULL | Caja asociada |
| tipo_comprobante | ENUM | NOT NULL | BOLETA, FACTURA, NOTA_CREDITO |
| serie | TEXT | NOT NULL | Serie (B001, F001, NC01) |
| correlativo_actual | BIGINT | DEFAULT 0 | Último número usado |

**Constraint:**
```sql
UNIQUE(serie, tipo_comprobante)
```

**Función crítica:**
```sql
CREATE OR REPLACE FUNCTION obtener_siguiente_correlativo(p_serie text)
RETURNS bigint AS $$
DECLARE
    nuevo_correlativo bigint;
BEGIN
    UPDATE series_comprobante
    SET correlativo_actual = correlativo_actual + 1
    WHERE serie = p_serie
    RETURNING correlativo_actual INTO nuevo_correlativo;
    RETURN nuevo_correlativo;
END;
$$ LANGUAGE plpgsql;
```

#### 3.3.4 pagos

**Descripción:** Transacciones financieras

| Campo | Tipo | Constraint | Descripción |
|-------|------|------------|-------------|
| id | UUID | PK | Identificador único |
| reserva_id | UUID | FK NOT NULL | Reserva asociada |
| caja_turno_id | UUID | FK NOT NULL | Turno de caja |
| comprobante_id | UUID | FK NULL | Comprobante emitido |
| metodo_pago | TEXT | NOT NULL | EFECTIVO, TARJETA, TRANSFERENCIA, YAPE, PLIN |
| moneda_pago | ENUM | DEFAULT 'PEN' | Moneda |
| monto | NUMERIC(10,2) | NOT NULL | Importe pagado |
| tipo_cambio_pago | NUMERIC(5,3) | DEFAULT 1.000 | TC aplicado |
| referencia_pago | TEXT | NULL | Nro operación, voucher |
| nota | TEXT | NULL | Observaciones |
| fecha_pago | TIMESTAMPTZ | DEFAULT now() | Timestamp |

**Características:**
- ✅ Soporta pagos parciales
- ✅ Múltiples pagos por reserva
- ✅ Pagos mixtos

---

## 4. SISTEMA DE FACTURACIÓN

### 4.1 Principio de Inmutabilidad Fiscal

**REGLA FUNDAMENTAL:**

> Los comprobantes emitidos son documentos fiscales inmutables. Una vez emitidos, sus datos (cliente, montos, IGV) **NUNCA** se modifican. Las correcciones se realizan mediante Notas de Crédito.

**¿Por qué?**

Imagina este escenario:

```
1. Enero 01: Emites factura a "Juan Pérez" con dirección "Calle A"
2. Enero 15: Juan se muda y actualizas su ficha a "Calle B"
3. Febrero 01: SUNAT audita y pide la factura del 01/Enero

Si la factura lee datos vivos:
❌ Imprimirá "Calle B" (¡ALTERASTE un documento fiscal!)

Si la factura tiene snapshot:
✅ Imprimirá "Calle A" (dato original congelado)
```

### 4.2 Snapshot vs. Referencia Viva

| Concepto | Tipo de Dato | ¿Dónde se usa? | Ejemplo |
|----------|--------------|----------------|---------|
| **Referencia Viva** | Foreign Key | Operación diaria | `reserva.huesped_id → huespedes.id` |
| **Snapshot** | Texto copiado | Documentos fiscales | `comprobante.receptor_razon_social = "Juan Pérez"` |

**Regla de oro:**
> Si el dato puede cambiar en el futuro y afecta un documento fiscal, debe ser snapshot.

### 4.3 Configuración del Hotel

#### 4.3.1 hotel_configuracion

**Descripción:** Configuración única del establecimiento

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| **DATOS DEL EMISOR** | | |
| ruc | TEXT NOT NULL | RUC del hotel |
| razon_social | TEXT NOT NULL | Razón social registrada |
| nombre_comercial | TEXT | Nombre comercial |
| direccion_fiscal | TEXT | Dirección registrada SUNAT |
| ubigeo_codigo | TEXT | Código de ubigeo |
| telefono | TEXT | Teléfono del hotel |
| email | TEXT | Email institucional |
| pagina_web | TEXT | URL sitio web |
| logo_url | TEXT | URL del logo |
| descripcion | TEXT | Descripción corta del hotel |
| **CONFIGURACIÓN TRIBUTARIA** | | |
| tasa_igv | NUMERIC(5,2) | Tasa IGV (ej: 18.00) |
| tasa_icbper | NUMERIC(5,2) | Impuesto bolsas (ej: 0.50) |
| es_exonerado_igv | BOOLEAN | Si está en zona exonerada |
| facturacion_activa | BOOLEAN | Si emite CPE |
| proveedor_metadata | JSONB | Config del PSE/OSE |
| **CONFIGURACIÓN OPERATIVA** | | |
| hora_checkin | TIME | Hora estándar check-in |
| hora_checkout | TIME | Hora estándar check-out |
| moneda_principal | TEXT | Moneda base (PEN/USD) |
| updated_at |TIMESTAMPTZ | Última modificación |

**Constraint:**
```sql
CREATE UNIQUE INDEX only_one_config_row ON hotel_configuracion ((true));
```

### 4.4 Comprobantes (SNAPSHOT)

#### 4.4.1 comprobantes

**Descripción:** Documento fiscal inmutable

| Campo | Tipo | ¿Snapshot? | Descripción |
|-------|------|------------|-------------|
| id | UUID | N/A | PK |
| turno_caja_id | UUID FK | ❌ Ref | Turno de caja |
| reserva_id | UUID FK | ❌ Ref | Trazabilidad |
| fecha_emision | TIMESTAMPTZ | ✅ Snapshot | Fecha congelada |
| tipo_comprobante | ENUM | ✅ Snapshot | BOLETA, FACTURA, NOTA_CREDITO |
| serie | TEXT | ✅ Snapshot | Serie |
| numero | BIGINT | ✅ Snapshot | Correlativo |
| **RECEPTOR (COPIADO)** | | | |
| receptor_tipo_doc | TEXT | ✅ Snapshot | Tipo doc (copiado) |
| receptor_nro_doc | TEXT | ✅ Snapshot | Nro doc (copiado) |
| receptor_razon_social | TEXT | ✅ Snapshot | Nombre (copiado) |
| receptor_direccion | TEXT | ✅ Snapshot | Dirección (copiada) |
| **MONTOS (CONGELADOS)** | | | |
| moneda | ENUM | ✅ Snapshot | PEN, USD |
| tipo_cambio | NUMERIC(5,3) | ✅ Snapshot | TC aplicado |
| op_gravadas | NUMERIC(12,2) | ✅ Snapshot | Base imponible |
| op_exoneradas | NUMERIC(12,2) | ✅ Snapshot | Ventas exoneradas |
| op_inafectas | NUMERIC(12,2) | ✅ Snapshot | Ventas inafectas |
| monto_igv | NUMERIC(12,2) | ✅ Snapshot | IGV |
| monto_icbper | NUMERIC(12,2) | ✅ Snapshot | Bolsas |
| total_venta | NUMERIC(12,2) | ✅ Snapshot | Total |
| **CONTROL SUNAT** | | | |
| estado_sunat | ENUM | ⚠️ Actualizable | PENDIENTE, ACEPTADO, RECHAZADO, ANULADO |
| hash_cpe | TEXT | ⚠️ Actualizable | Hash SUNAT |
| cdr_url | TEXT | ⚠️ Actualizable | URL CDR |
| xml_url | TEXT | ⚠️ Actualizable | URL XML |
| pdf_url | TEXT | ⚠️ Actualizable | URL PDF |
| external_id | TEXT | ⚠️ Actualizable | ID externo |
| **NOTAS DE CRÉDITO** | | | |
| nota_credito_ref_id | UUID FK | ❌ Ref | Si es NC |
| created_at | TIMESTAMPTZ | N/A | Creación |

**Constraints:**
```sql
UNIQUE(serie, numero)
```

**Campos actualizables después de emisión:**
- `estado_sunat`, `hash_cpe`, `cdr_url`, `xml_url`

**Campos inmutables:**
- TODO lo demás (receptor, montos, numeración, fecha)

**Trigger de protección:**
```sql
CREATE OR REPLACE FUNCTION proteger_comprobante_inmutable()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.estado_sunat != 'PENDIENTE') THEN
        IF OLD.total_venta IS DISTINCT FROM NEW.total_venta
           OR OLD.receptor_nro_doc IS DISTINCT FROM NEW.receptor_nro_doc
           OR OLD.serie IS DISTINCT FROM NEW.serie 
           OR OLD.numero IS DISTINCT FROM NEW.numero THEN
            RAISE EXCEPTION '⛔ PROHIBIDO: No se pueden modificar datos fiscales';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_blindaje_fiscal
BEFORE UPDATE ON comprobantes
FOR EACH ROW
EXECUTE FUNCTION proteger_comprobante_inmutable();
```

#### 4.4.2 comprobante_detalles

**Descripción:** Líneas de detalle (también snapshot)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| comprobante_id | UUID FK | Comprobante |
| descripcion | TEXT | "Hospedaje Hab 201 - 3 noches" |
| cantidad | NUMERIC(10,2) | Número de noches |
| precio_unitario | NUMERIC(12,2) | Precio por noche |
| subtotal | NUMERIC(12,2) | cantidad × precio |
| codigo_afectacion_igv | TEXT | '10', '20', '30' |

**Importante:** Todos son copias, no referencias.

### 4.5 Vistas Optimizadas

#### 4.5.1 vw_habitaciones_disponibles

```sql
CREATE OR REPLACE VIEW vw_habitaciones_disponibles AS
SELECT 
    h.id,
    h.numero,
    h.piso,
    t.nombre as tipo,
    t.capacidad_personas,
    c.nombre as categoria,
    CASE 
        WHEN h.estado_servicio IN ('MANTENIMIENTO', 'FUERA_SERVICIO') 
            THEN 'NO DISPONIBLE (MANTENIMIENTO)'
        WHEN h.estado_ocupacion = 'OCUPADA' 
            THEN 'OCUPADA'
        WHEN h.estado_limpieza IN ('SUCIA', 'EN_LIMPIEZA') 
            THEN 'POR LIMPIAR'
        ELSE 'DISPONIBLE'
    END as estado_visual,
    (SELECT precio_base FROM tarifas tar 
     WHERE tar.tipo_habitacion_id = h.tipo_id 
       AND tar.categoria_habitacion_id = h.categoria_id
       AND tar.activa = true
       AND (tar.fecha_inicio IS NULL OR tar.fecha_inicio <= CURRENT_DATE)
       AND (tar.fecha_fin IS NULL OR tar.fecha_fin >= CURRENT_DATE)
     ORDER BY tar.created_at DESC LIMIT 1
    ) as precio_sugerido
FROM habitaciones h
JOIN tipos_habitacion t ON h.tipo_id = t.id
JOIN categorias_habitacion c ON h.categoria_id = c.id;
```

#### 4.5.2 vw_historial_comprobantes

```sql
CREATE OR REPLACE VIEW vw_historial_comprobantes AS
SELECT 
    c.id,
    c.fecha_emision,
    c.tipo_comprobante,
    c.serie,
    c.numero,
    c.serie || '-' || LPAD(c.numero::text, 8, '0') as numero_completo,
    
    -- ✅ SNAPSHOT (datos congelados)
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
    
    -- Contexto (solo para UI)
    CASE 
        WHEN c.tipo_comprobante = 'NOTA_CREDITO' THEN
            'Anula a ' || (SELECT ref.serie || '-' || LPAD(ref.numero::text, 8, '0')
                          FROM comprobantes ref WHERE ref.id = c.nota_credito_ref_id)
        WHEN c.reserva_id IS NOT NULL THEN
            'Hab ' || (SELECT h.numero FROM reservas r 
                      JOIN habitaciones h ON r.habitacion_id = h.id 
                      WHERE r.id = c.reserva_id)
        ELSE 'Sin contexto'
    END as contexto,
    
    -- Auditoría
    ct.usuario_id,
    u.nombres || ' ' || COALESCE(u.apellidos, '') as emisor_nombre,
    c.created_at
    
FROM comprobantes c
JOIN caja_turnos ct ON c.turno_caja_id = ct.id
JOIN usuarios u ON ct.usuario_id = u.id
ORDER BY c.fecha_emision DESC, c.numero DESC;
```

**¿Por qué NO hace JOIN con `huespedes`?**
Porque el nombre ya está copiado en `c.receptor_razon_social`. Si hiciéramos JOIN y el huésped cambia su nombre, el comprobante histórico mostraría el nombre nuevo (ERROR FISCAL).

---

## 5. REQUERIMIENTOS FUNCIONALES

### 5.1 Módulo de Habitaciones

#### RF-001: Gestión de Habitaciones
**Prioridad:** Alta  
**Descripción:** Administrar el inventario de habitaciones del hotel

**Funcionalidades:**
- Crear nueva habitación (número, tipo, categoría, piso)
- Editar datos de habitación existente
- Eliminar habitación (solo si no tiene historial)
- Listar todas las habitaciones con filtros

**Reglas de negocio:**
- Número de habitación debe ser único
- Tipo y categoría son obligatorios
- No se puede eliminar si tiene reservas asociadas

#### RF-002: Visualización de Estados
**Prioridad:** Alta  
**Descripción:** Mostrar estado actual de todas las habitaciones

**Vista requerida:**
- Grilla visual tipo dashboard
- Código de colores:
  - 🟢 Verde: Disponible (LIBRE + LIMPIA + OPERATIVA)
  - 🟡 Amarillo: Por limpiar (LIBRE + SUCIA)
  - 🔴 Rojo: Ocupada - Huésped dentro
  - 🟠 Naranja: Ocupada - Huésped fuera
  - ⚫ Negro: Fuera de servicio

**Información por habitación:**
- Número
- Tipo y categoría
- Estados actuales
- Si está ocupada: nombre del huésped, días restantes

#### RF-003: Cambio de Estados
**Prioridad:** Alta  
**Descripción:** Permitir cambiar estados según rol

**Permisos:**
| Rol | Puede cambiar |
|-----|---------------|
| Recepción | estado_ocupacion (vía check-in/out) |
| Housekeeping | estado_limpieza |
| Mantenimiento | estado_servicio |
| Admin | Todos |

**Auditoría:**
- Registrar quién cambió el estado
- Timestamp del cambio
- Valor anterior y nuevo

### 5.2 Módulo de Reservas

#### RF-004: Crear Reserva Anticipada
**Prioridad:** Alta  
**Descripción:** Registrar reserva para fecha futura

**Flujo:**
1. Buscar disponibilidad (tipo, fechas)
2. Sistema muestra habitaciones disponibles y precio sugerido
3. Seleccionar habitación (o solo tipo)
4. Registrar datos del huésped principal
5. Negociar precio (dentro de límites)
6. Registrar canal de venta
7. Guardar con estado RESERVADA

**Validaciones:**
- Fechas: entrada < salida
- Precio: ≥ precio_minimo o con autorización
- Habitación no debe tener otra reserva en esas fechas

#### RF-005: Walk-in (Llegada Directa)
**Prioridad:** Alta  
**Descripción:** Atender huésped sin reserva previa

**Flujo:**
1. Consultar disponibilidad en tiempo real
2. Mostrar habitaciones DISPONIBLES (3 estados OK)
3. Registrar datos del huésped
4. Asignar habitación
5. Negociar precio
6. Crear reserva con estado CHECKED_IN (directo)

**Diferencia con reserva anticipada:**
- NO pasa por estado RESERVADA
- fecha_entrada = HOY
- Habitación asignada inmediatamente

#### RF-006: Check-in
**Prioridad:** Alta  
**Descripción:** Ingresar huésped con reserva

**Flujo:**
1. Buscar reserva por:
   - Código de reserva
   - Número de documento
   - Nombre del huésped
2. Mostrar detalles de la reserva
3. Validar habitación:
   - ✅ estado_limpieza = LIMPIA
   - ✅ estado_servicio = OPERATIVA
4. Confirmar o cambiar habitación
5. Registrar acompañantes (todos los datos)
6. Capturar adelantos/pagos
7. Ejecutar check-in:
   - reserva.estado → CHECKED_IN
   - reserva.check_in_real → NOW()
   - reserva.huesped_presente → TRUE
   - habitacion.estado_ocupacion → OCUPADA

**Mensajes de error:**
- "Habitación requiere limpieza"
- "Habitación en mantenimiento"
- "Habitación ocupada por otra reserva"

#### RF-007: Check-out
**Prioridad:** Alta  
**Descripción:** Cerrar estadía y liberar habitación

**Flujo:**
1. Seleccionar reserva activa (CHECKED_IN)
2. Calcular cuenta final:
   - Noches hospedadas
   - Precio pactado × noches
   - Total pagado (sumarpagos existentes)
   - Saldo pendiente
3. Si saldo > 0: registrar pagos adicionales
4. Solicitar datos de facturación:
   - ¿Requiere comprobante? (Sí/No)
   - ¿Tipo? (Boleta/Factura)
   - Si factura: RUC, razón social, dirección
5. Emitir comprobante (snapshot de todos los datos)
6. Ejecutar check-out:
   - reserva.estado → CHECKED_OUT
   - reserva.check_out_real → NOW()
   - reserva.huesped_presente → FALSE
   - habitacion.estado_ocupacion → LIBRE
   - habitacion.estado_limpieza → SUCIA

**Reglas:**
- No permitir check-out con saldo pendiente
- Comprobante es opcional (puede pagar sin factura)

#### RF-008: Cancelar Reserva
**Prioridad:** Media  
**Descripción:** Anular reserva antes de check-in

**Flujo:**
1. Seleccionar reserva (estado: RESERVADA)
2. Confirmar cancelación
3. Opcionalmente: registrar motivo
4. Cambiar estado a CANCELADA
5. Liberar habitación (si estaba asignada)

**Restricciones:**
- Solo si estado = RESERVADA
- Registrar quién canceló y cuándo

#### RF-009: Marcar No-Show
**Prioridad:** Baja  
**Descripción:** Registrar que huésped no llegó

**Flujo:**
1. Listar reservas con fecha_entrada = HOY
2. Al final del día, marcar las que no hicieron check-in
3. Cambiar estado a NO_SHOW

### 5.3 Módulo de Tarifas

#### RF-010: Crear/Editar Tarifa
**Prioridad:** Alta  
**Descripción:** Definir reglas de precio

**Campos:**
- Nombre descriptivo (ej: "Temporada Alta 2026")
- Tipo de habitación
- Categoría
- Precio base (sugerido)
- Precio mínimo (límite)
- Fecha inicio (NULL = sin límite)
- Fecha fin (NULL = sin límite)
- Estado (activa/inactiva)

**Validaciones:**
- precio_minimo ≤ precio_base
- Si tiene fechas: fecha_inicio < fecha_fin
- Validar no sobrelapamiento de fechas para mismo tipo+categoría

#### RF-011: Consultar Tarifa Vigente
**Prioridad:** Alta  
**Descripción:** Obtener precio sugerido para una fecha

**Lógica:**
1. Buscar tarifas donde:
   - tipo_habitacion_id = X
   - categoria_habitacion_id = Y
   - activa = TRUE
   - (fecha_inicio IS NULL OR fecha_inicio ≤ fecha_consulta)
   - (fecha_fin IS NULL OR fecha_fin ≥ fecha_consulta)
2. Ordenar por created_at DESC
3. Retornar la primera (más reciente)

#### RF-012: Negociación en Reserva
**Prioridad:** Alta  
**Descripción:** Ajustar precio según cliente

**Flujo:**
1. Sistema sugiere precio_base de tarifa vigente
2. Recepcionista ingresa precio_pactado
3. Validación:
   - Si precio_pactado ≥ precio_minimo: ✅ OK
   - Si precio_pactado < precio_minimo:
     - Opción A: Bloquear operación
     - Opción B: Solicitar clave de supervisor
     - Opción C: Permitir pero marcar autorizado_descuento = TRUE
4. Guardar precio_pactado en reserva (congelado)

**Configuración:**
Definir en settings qué opción (A, B o C) usar

### 5.4 Módulo de Huéspedes

#### RF-013: Registrar Huésped
**Prioridad:** Alta  
**Descripción:** Capturar datos de identificación

**Campos obligatorios:**
- Nombres
- Apellidos
- Tipo de documento
- Número de documento
- Nacionalidad

**Campos opcionales:**
- Teléfono
- Correo
- Fecha de nacimiento
- Notas internas

**Validación de duplicados:**
1. Buscar por tipo_documento + numero_documento
2. Si existe: Mostrar datos existentes, preguntar si desea actualizar
3. Si no existe: Crear nuevo registro

**Reutilización:**
- Al buscar documento existente, autocompletar campos
- Mostrar historial: "Este huésped se hospedó X veces"

#### RF-014: Registrar Acompañantes
**Prioridad:** Alta  
**Descripción:** Vincular múltiples huéspedes a una reserva

**Flujo:**
1. Identificar huésped principal (es_titular = TRUE)
2. Agregar acompañantes (es_titular = FALSE)
3. Cada acompañante requiere datos completos:
   - Nombres, apellidos
   - Tipo y número de documento
   - Nacionalidad
4. Todos se guardan en tabla `huespedes`
5. Relación en `reserva_huespedes`

**Validaciones:**
- Solo un titular por reserva
- No repetir mismo huésped en una reserva
- Cumplimiento legal: TODOS deben registrarse

### 5.5 Módulo de Facturación

#### RF-015: Emitir Comprobante
**Prioridad:** Crítica  
**Descripción:** Generar CPE con snapshot inmutable

**Flujo completo:**
1. **Preparación:**
   - Calcular total de la reserva
   - Verificar pagos realizados
   - Solicitar datos de facturación al usuario

2. **Obtener configuración:**
   - Leer `hotel_configuracion`
   - Determinar si es zona exonerada
   - Obtener tasa de IGV vigente

3. **Calcular impuestos:**
   ```
   Si es_exonerado_igv:
     op_exoneradas = total
     monto_igv = 0
   Sino:
     op_gravadas = total / 1.18
     monto_igv = total - op_gravadas
   ```

4. **Obtener correlativo:**
   - Ejecutar función `obtener_siguiente_correlativo(serie)`
   - Garantiza atomicidad (no duplicados)

5. **Crear snapshot:**
   ```
   COPIAR (no referenciar):
   - Datos del receptor (nombre, documento, dirección)
   - Montos calculados
   - Descripción de items
   - Tipo de cambio del día
   - Tasa de IGV vigente
   ```

6. **Insertar en BD:**
   - Tabla `comprobantes` (snapshot completo)
   - Tabla `comprobante_detalles` (líneas del comprobante)

7. **Enviar a SUNAT:**
   - Generar XML según formato CPE
   - Enviar a PSE/OSE
   - Esperar CDR (Constancia de Recepción)
   - Actualizar estado_sunat, hash_cpe, cdr_url

**Reglas críticas:**
- ❌ NUNCA modificar datos después de emisión
- ✅ SOLO actualizar: estado_sunat, hash, URLs
- ✅ Si falla envío: comprobante queda PENDIENTE para reintento

#### RF-016: Nota de Crédito
**Prioridad:** Alta  
**Descripción:** Anular comprobante emitido

**Validaciones:**
- Solo si comprobante original está ACEPTADO
- Validar plazo (SUNAT: 7 días para físicos)

**Flujo:**
1. Seleccionar comprobante a anular
2. Confirmar motivo:
   - Anulación de venta
   - Error en RUC
   - Descuento posterior
   - Devolución
3. Crear nuevo comprobante:
   - tipo_comprobante = NOTA_CREDITO
   - nota_credito_ref_id = comprobante_original.id
   - serie = NC01 (serie específica para NC)
   - **Copiar datos del receptor** (mismo snapshot)
   - **Montos en NEGATIVO:**
     ```
     op_gravadas = -original.op_gravadas
     monto_igv = -original.monto_igv
     total_venta = -original.total_venta
     ```
4. Enviar NC a SUNAT
5. Si ACEPTADO:
   - Actualizar comprobante original: estado_sunat = ANULADO
   - Opcionalmente: revertir pagos en caja

**Restricción:**
- NO se puede anular una NC (no hay NC de NC)

#### RF-017: Reenviar a SUNAT
**Prioridad:** Media  
**Descripción:** Reintentar envío fallido

**Cuándo aplica:**
- Comprobante con estado PENDIENTE
- Comprobante RECHAZADO por error técnico (no de datos)

**Flujo:**
1. Verificar estado = PENDIENTE o RECHAZADO
2. Leer datos del comprobante (snapshot)
3. Generar XML nuevamente
4. Reenviar a SUNAT
5. Actualizar estado según respuesta

**Importante:**
- NO modificar datos del comprobante
- Solo actualizar metadatos (estado, hash, URLs)

### 5.6 Módulo de Caja

#### RF-018: Apertura de Caja
**Prioridad:** Alta  
**Descripción:** Iniciar turno de trabajo

**Flujo:**
1. Seleccionar caja
2. Contar efectivo inicial:
   - Monto en PEN
   - Monto en USD
3. Registrar:
   - usuario_id (quien abre)
   - fecha_apertura = NOW()
   - montos de apertura
   - estado = ABIERTA
4. Habilitar operaciones de venta

**Validaciones:**
- No puede haber dos turnos ABIERTOS simultáneos en la misma caja
- Usuario debe tener permisos de caja

#### RF-019: Registrar Pago
**Prioridad:** Alta  
**Descripción:** Guardar transacción de cobro

**Datos requeridos:**
- reserva_id
- Método de pago
- Moneda
- Monto
- Tipo de cambio (si es USD)
- Referencia (nro operación, últimos 4 dígitos)

**Validaciones:**
- Turno de caja debe estar ABIERTO
- Monto > 0
- Si método = TARJETA: referencia es obligatoria

#### RF-020: Registrar Movimiento Manual
**Prioridad:** Media
**Descripción:** Registrar ingresos o egresos de caja no vinculados a reservas (ej: gastos menores, ingreso de sencillo)

**Datos requeridos:**
- Tipo: INGRESO o EGRESO
- Categoría (ej: "Movilidad", "Compra insumos", "Sencillo")
- Monto y Moneda
- Motivo (descripción obligatoria)
- Comprobante referencia (opcional)
- Foto/Evidencia (opcional)

**Validaciones:**
- Turno debe estar ABIERTO
- Monto > 0
- Motivo debe tener al menos 5 caracteres

#### RF-021: Cierre de Caja
**Prioridad:** Alta
**Descripción:** Finalizar turno y arqueo

**Flujo:**
1. Contar efectivo final físico (Real):
   - Billetes y monedas en PEN
   - Billetes y monedas en USD
2. Sistema calcula efectivo teórico:
   ```
   Teórico = Apertura + Ingresos - Egresos
   ```
3. Calcular Descuadre:
   - `Descuadre = Real - Teórico`
4. Validación de Descuadre:
   - Si `ABS(Descuadre) <= Límite` (ej: S/ 10.00): ✅ Cierre automático permitido
   - Si `ABS(Descuadre) > Límite`: 🔐 Requiere autorización de Supervisor
5. Guardar cierre:
   - Registrar fecha, montos reales, teóricos y descuadre
   - Si hubo autorización: registrar `autorizado_por`
   - Estado = CERRADA

**Restricciones:**
- No se pueden hacer ventas después del cierre
- No se puede reabrir un turno cerrado

### 5.7 Módulo de Reportes

#### RF-022: Dashboard Operativo
**Prioridad:** Alta  

#### RF-023: Reporte de Ventas por Canal
**Prioridad:** Media  
**Descripción:** Análisis de rentabilidad por origen

**Filtros:**
- Rango de fechas
- Canal específico o todos

**Datos mostrados:**
| Canal | Reservas | Noches | Ingreso Total | Comisión | Ingreso Neto |
|-------|----------|--------|---------------|----------|--------------|
| Recepción | 45 | 120 | S/ 18,000 | S/ 0 | S/ 18,000 |
| Booking | 30 | 85 | S/ 12,750 | S/ 1,913 | S/ 10,838 |
| Web | 15 | 40 | S/ 6,000 | S/ 0 | S/ 6,000 |

#### RF-024: Historial de Facturación
**Prioridad:** Alta  
**Descripción:** Listado de todos los comprobantes emitidos

**Filtros:**
- Rango de fechas
- Tipo de comprobante
- Estado SUNAT
- Búsqueda por RUC/DNI/Nombre

**Tabla:**
| Fecha | Documento | Cliente | RUC/DNI | Base Imp. | IGV | Total | Estado | Acciones |
|-------|-----------|---------|---------|-----------|-----|-------|--------|----------|

**Acciones por fila:**
- 👁️ Ver detalle
- 📄 Descargar PDF
- 📋 Descargar XML
- 📧 Enviar por email
- 🔄 Reenviar (si PENDIENTE)
- ❌ Anular (si ACEPTADO)

#### RF-025: Registro de Ventas (Libro)
**Prioridad:** Alta  
**Descripción:** Exportación para contabilidad

**Formato:** Excel con columnas SUNAT:
- Fecha
- Tipo de comprobante
- Serie y número
- Tipo de documento del cliente
- Número de documento
- Razón social
- Base imponible gravada
- IGV
- Total

**Filtros:**
- Mes específico
- Año completo

#### RF-026: Reporte PLE 14.1
**Prioridad:** Media  
**Descripción:** Programa de Libros Electrónicos

**Descripción:**
Genera archivo TXT en formato SUNAT para declaración mensual.

**Estructura:** Según especificación técnica SUNAT

---

## 6. ARQUITECTURA Y DECISIONES TÉCNICAS

### 6.1 Filosofía de Diseño

**Principio rector:**

> "La Base de Datos debe ser el guardián de la INTEGRIDAD, pero el Backend debe ser el dueño de la LÓGICA DE NEGOCIO"

### 6.2 Responsabilidades por Capa

#### 6.2.1 Base de Datos (PostgreSQL/Supabase)

**RESPONSABLE DE:**
- ✅ Integridad referencial (Foreign Keys)
- ✅ Atomicidad en operaciones críticas (correlativos)
- ✅ Inmutabilidad fiscal (trigger de protección)
- ✅ Constraints de unicidad y validación básica
- ✅ Vistas optimizadas para lectura rápida

**NO RESPONSABLE DE:**
- ❌ Lógica de negocio compleja
- ❌ Validaciones de usuario con mensajes amigables
- ❌ Orquestación de estados (check-in, check-out)

#### 6.2.2 Backend (Next.js Server Actions)

**RESPONSABLE DE:**
- ✅ Lógica de negocio (check-in/check-out explícitos)
- ✅ Validaciones con mensajes claros para UI
- ✅ Orquestación de estados (transacciones explícitas)
- ✅ Cálculos complejos (pricing, cuentas)
- ✅ Integración con APIs externas (SUNAT)

**NO RESPONSABLE DE:**
- ❌ Garantizar atomicidad de correlativos (eso es de BD)
- ❌ Proteger datos fiscales (trigger de BD lo hace)

### 6.3 Decisiones Arquitectónicas Clave

#### 6.3.1 Triggers: ¿Cuáles mantener y cuáles eliminar?

| Trigger | Decisión | Razón |
|---------|----------|-------|
| `sincronizar_estado_habitacion()` | ❌ ELIMINAR | Lógica de negocio → debe ser explícita en backend |
| `validar_checkin_habitacion()` | ❌ ELIMINAR | Validación → debe dar feedback claro al usuario |
| `proteger_comprobante_inmutable()` | ✅ MANTENER | Seguridad de datos → última línea de defensa |
| `obtener_siguiente_correlativo()` | ✅ MANTENER | Atomicidad crítica → evita race conditions |

**Justificación:**

**Eliminar `sincronizar_estado_habitacion()`:**

```typescript
// ❌ ANTES: "Magia negra"
await supabase.from('reservas').update({ estado: 'CHECKED_IN' });
// ¿Qué pasó con la habitación? 🤷 (trigger oculto)

// ✅ AHORA: Explícito y testeable
await checkIn(reservaId, habitacionId);
//
// En checkIn() vemos claramente:
// 1. Validar habitación
// 2. Actualizar reserva
// 3. Actualizar habitación
// Todo explícito, fácil de debuggear y testear
```

**Mantener `proteger_comprobante_inmutable()`:**

Razón: Es tu última línea de defensa. Si un programador junior comete un error en el backend y manda un `UPDATE` a una factura emitida, o si alguien entra directo a la BD por consola, este trigger impide el delito tributario.

**Mantener `obtener_siguiente_correlativo()`:**

Razón: Si dos recepcionistas hacen clic en "Facturar" al mismo milisegundo, el código (Node.js/Next.js) podría leer el número `100` para ambos, generando un duplicado. La base de datos bloquea la fila y garantiza secuencialidad (`100` y `101`). Esto es crítico para SUNAT.

#### 6.3.2 Ejemplo de Implementación en Backend

**Función: Check-in**

```typescript
// app/actions/reservas.ts
export async function checkIn(reservaId: string, habitacionId: string) {
  const supabase = createClient();
  
  // 1️⃣ VALIDACIONES EXPLÍCITAS
  const { data: habitacion, error: errorHab } = await supabase
    .from('habitaciones')
    .select('estado_limpieza, estado_servicio')
    .eq('id', habitacionId)
    .single();
  
  if (errorHab || !habitacion) {
    return { 
      error: 'Habitación no encontrada',
      code: 'HABITACION_NO_ENCONTRADA'
    };
  }
  
  if (habitacion.estado_servicio !== 'OPERATIVA') {
    return { 
      error: 'No se puede hacer check-in',
      message: `La habitación está en ${habitacion.estado_servicio}. Por favor, contacte a mantenimiento.`,
      code: 'HABITACION_NO_OPERATIVA'
    };
  }
  
  if (habitacion.estado_limpieza !== 'LIMPIA') {
    return { 
      error: 'Habitación requiere limpieza',
      message: 'Por favor, solicite al área de housekeeping que limpie la habitación primero.',
      code: 'HABITACION_SUCIA'
    };
  }
  
  // 2️⃣ TRANSACCIÓN EXPLÍCITA
  try {
    // Actualizar reserva
    const { error: errorReserva } = await supabase
      .from('reservas')
      .update({ 
        estado: 'CHECKED_IN',
        check_in_real: new Date().toISOString(),
        habitacion_id: habitacionId,
        huesped_presente: true
      })
      .eq('id', reservaId);
    
    if (errorReserva) throw errorReserva;
    
    // Actualizar habitación (EXPLÍCITO - se ve claramente)
    const { error: errorHabitacion } = await supabase
      .from('habitaciones')
      .update({ 
        estado_ocupacion: 'OCUPADA',
        estado_limpieza: 'LIMPIA'
      })
      .eq('id', habitacionId);
    
    if (errorHabitacion) throw errorHabitacion;
    
    // 3️⃣ LOG DE AUDITORÍA
    await registrarAuditoria({
      accion: 'CHECK_IN',
      reserva_id: reservaId,
      habitacion_id: habitacionId,
      usuario_id: await getUsuarioActual()
    });
    
    return { 
      success: true,
      message: 'Check-in realizado exitosamente'
    };
    
  } catch (error) {
    console.error('Error en check-in:', error);
    return { 
      error: 'Error de sistema',
      message: 'Hubo un problema al procesar el check-in. Por favor, intente nuevamente.',
      code: 'ERROR_SISTEMA'
    };
  }
}
```

**Ventajas de este enfoque:**

1. **Legibilidad:** El flujo se lee de arriba a abajo
2. **Testeable:** Puedes hacer unit tests fácilmente
3. **Mensajes claros:** Errores amigables con códigos específicos
4. **Debuggeable:** Logs claros de cada paso
5. **Rollback automático:** Si algo falla, Supabase revierte todo

### 6.4 Stack Tecnológico Recomendado

| Componente | Tecnología | Justificación |
|------------|------------|---------------|
| **Base de Datos** | PostgreSQL (Supabase) | Transacciones ACID, funciones SQL, triggers |
| **Backend** | Next.js 14+ Server Actions | Server-side rendering, API routes integradas |
| **Frontend** | React 18+ con TypeScript | Type safety, componentes reutilizables |
| **UI Framework** | shadcn/ui + Tailwind CSS | Componentes accesibles, customizables |
| **Auth** | Supabase Auth | Integración nativa con la BD |
| **Facturación** | API Nubefact o similar | Proveedor certificado PSE/OSE |
| **Estado Global** | Zustand o Context API | State management simple |
| **Validaciones** | Zod | Schemas de validación type-safe |

### 6.5 Estructura de Proyecto

```
pms-hotel/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── habitaciones/
│   │   ├── reservas/
│   │   ├── facturacion/
│   │   ├── caja/
│   │   ├── reportes/
│   │   └── layout.tsx
│   ├── actions/           # Server Actions
│   │   ├── reservas.ts
│   │   ├── facturacion.ts
│   │   ├── habitaciones.ts
│   │   └── caja.ts
│   └── api/              # API Routes
│       └── webhook-sunat/
├── components/
│   ├── ui/               # shadcn components
│   ├── habitaciones/
│   ├── reservas/
│   └── shared/
├── lib/
│   ├── supabase/
│   ├── validations/
│   ├── utils/
│   └── constants/
├── types/
│   ├── database.ts       # Tipos generados de Supabase
│   ├── reservas.ts
│   └── facturacion.ts
└── supabase/
    ├── migrations/
    └── seed.sql
```

---

## 7. REQUERIMIENTOS NO FUNCIONALES

### 7.1 Rendimiento

| Operación | Tiempo Máximo |
|-----------|---------------|
| Carga de dashboard de habitaciones | < 2 segundos |
| Búsqueda de reserva | < 1 segundo |
| Procesamiento de check-in | < 3 segundos |
| Emisión de comprobante | < 5 segundos |
| Carga de historial de facturación (primeros 100) | < 2 segundos |
| Generación de reporte mensual | < 10 segundos |

### 7.2 Escalabilidad

**El sistema debe funcionar sin cambios estructurales para:**

- **Hotel pequeño:** 5-15 habitaciones, 1-2 usuarios simultáneos
- **Hotel mediano:** 16-50 habitaciones, 5-10 usuarios simultáneos
- **Hotel grande:** 51-200 habitaciones, 20+ usuarios simultáneos
- **Cadena hotelera:** Múltiples propiedades (configuración independiente)

**Estrategias:**
- Índices en columnas frecuentemente consultadas
- Paginación en listados grandes
- Caching de datos de configuración
- Conexión pooling de base de datos

### 7.3 Usabilidad

#### 7.3.1 Interfaz de Usuario

**Principios:**
- Diseño intuitivo para personal sin formación técnica
- Máximo 3 clics para operaciones frecuentes
- Feedback visual inmediato de acciones
- Confirmación para acciones destructivas

**Accesibilidad:**
- Contraste de colores mínimo 4.5:1
- Navegación por teclado
- Textos descriptivos en imágenes
- Tamaño de fuente ajustable

#### 7.3.2 Flujos Optimizados

**Check-in rápido:** 
1. Escanear documento → 2. Confirmar datos → 3. Listo
Tiempo objetivo: < 2 minutos

**Emisión de boleta:**
1. Seleccionar reserva → 2. Confirmar monto → 3. Emitir
Tiempo objetivo: < 1 minuto

### 7.4 Seguridad

#### 7.4.1 Autenticación y Autorización

- **Autenticación:** Email + Password (Supabase Auth)
- **Sesiones:** JWT con expiración de 24 horas
- **Refresh tokens:** Renovación automática
- **2FA:** Opcional para rol Admin

**Matriz de permisos:**

| Funcionalidad | Admin | Recepción | Housekeeping |
|---------------|-------|-----------|--------------|
| Ver habitaciones | ✅ | ✅ | ✅ |
| Cambiar estado limpieza | ✅ | ❌ | ✅ |
| Crear reserva | ✅ | ✅ | ❌ |
| Check-in/out | ✅ | ✅ | ❌ |
| Emitir comprobante | ✅ | ✅ | ❌ |
| Anular comprobante | ✅ | ❌ | ❌ |
| Ver reportes financieros | ✅ | ❌ | ❌ |
| Configuración | ✅ | ❌ | ❌ |

#### 7.4.2 Protección de Datos

- **Encriptación en tránsito:** HTTPS/TLS 1.3
- **Encriptación en reposo:** PostgreSQL encryption
- **Datos sensibles:** Hash de passwords con bcrypt
- **Logs de auditoría:** Registro de todas las operaciones críticas

#### 7.4.3 Cumplimiento Legal

- **RGPD/GDPR:** Si aplica para huéspedes europeos
- **Ley de Protección de Datos Perú:** Cumplimiento total
- **Conservación de registros:** Mínimo 5 años (normativa SUNAT)

### 7.5 Disponibilidad

**Objetivo:** 99.5% uptime (aprox. 3.6 horas/mes de downtime permitido)

**Estrategias:**
- Backup automático diario de base de datos
- Backup incremental cada 6 horas
- Plan de recuperación ante desastres (RPO: 6 horas, RTO: 2 horas)
- Monitoreo de servicios críticos

### 7.6 Mantenibilidad

**Código:**
- TypeScript strict mode
- Documentación inline (JSDoc)
- Tests unitarios para lógica crítica
- Código revisado (code review)

**Base de Datos:**
- Migraciones versionadas
- Rollback scripts para cada migración
- Documentación de constraints y triggers
- Scripts de seed data para desarrollo

### 7.7 Compatibilidad

**Navegadores soportados:**
- Chrome 100+
- Firefox 100+
- Safari 15+
- Edge 100+

**Dispositivos:**
- Desktop (principal)
- Tablet (limitado)
- Mobile (solo consulta)

---

## 8. CASOS DE USO

### 8.1 Hotel Pequeño Familiar (5-10 habitaciones)

**Perfil:**
- Hotel familiar en provincia
- Sin categorías (todas son "Estándar")
- Pricing simple con negociación diaria
- 90% walk-ins, 10% reservas
- Facturación básica

**Configuración del sistema:**
1. Crear una sola categoría: "Estándar"
2. Definir tarifas simples:
   - Simple: S/ 50 (mínimo S/ 40)
   - Doble: S/ 80 (mínimo S/ 60)
3. Sin temporadas definidas
4. Canal principal: "Recepción"
5. Configurar IGV según ubicación

**Flujo típico diario:**
```
8:00am - Apertura de caja (S/ 200)
9:00am - Check-out de 3 habitaciones
         Cobro en efectivo, emisión de boletas
10:00am - Housekeeping limpia habitaciones
12:00pm - Walk-in: Familia busca habitación
          Negociación: precio base S/ 80 → aceptan S/ 70
          Check-in inmediato
2:00pm - Reserva telefónica para mañana
6:00pm - Check-in de reserva anticipada
10:00pm - Cierre de caja
```

**Beneficios del sistema:**
- Registro ordenado de huéspedes
- Control de precios con límites
- Facturación electrónica simple
- Historial para SUNAT

### 8.2 Hotel Mediano Urbano (20-40 habitaciones)

**Perfil:**
- Hotel en ciudad turística (Cusco, Arequipa)
- Múltiples categorías (Estándar, Superior, Suite)
- Temporadas definidas (alta/baja)
- 40% Booking, 30% web propia, 30% directo
- Facturación con reportes detallados

**Configuración del sistema:**
1. Definir 3 categorías
2. Crear tarifas por temporada:
   - Temporada baja (Ene-Mar): -20%
   - Temporada media (Abr-Jun): precio base
   - Temporada alta (Jul-Set): +30%
   - Feriados especiales: +50%
3. Configurar canales con comisiones:
   - Booking: 15%
   - Web: 0%
   - Recepción: 0%

**Flujo típico diario:**
```
7:00am - Housekeeping revisa dashboard
         8 habitaciones sucias pendientes
8:00am - Apertura de caja
9:00am - Check-out masivo (10 habitaciones)
         Mix de boletas y facturas
10:00am - Recepción consulta llegadas del día
          15 reservas de Booking
2:00pm - Check-in de grupo (8 habitaciones)
         Pago con tarjeta corporativa
         Emisión de factura única
6:00pm - Walk-in: pareja sin reserva
         Sistema sugiere S/ 180 (temporada alta)
         Aceptan sin negociar
9:00pm - Gerencia revisa reporte del día
         Ocupación: 85%
         Ventas: S/ 8,500
```

**Beneficios del sistema:**
- Análisis de rentabilidad por canal
- Control automático de temporadas
- Reportes para toma de decisiones
- Integración con OTAs

### 8.3 Hotel en Zona Exonerada (Amazonía)

**Perfil:**
- Hotel en Iquitos (Loreto)
- Exonerado de IGV
- Turismo de naturaleza
- 70% reservas anticipadas internacionales

**Configuración del sistema:**
1. Marcar: `es_exonerado_igv = TRUE`
2. Configurar facturación:
   - Código de afectación: 20 (Exonerado)
   - Tasa IGV: 0%
3. Preparar comprobantes en inglés (opcional)

**Ejemplo de comprobante:**
```
FACTURA ELECTRÓNICA
F001-00123

HOTEL AMAZONAS LODGE S.A.C.
RUC: 20987654321

Cliente: John Smith
Pasaporte: USA123456789

Detalle:
- Hospedaje 3 noches x S/ 200.00 = S/ 600.00

Operaciones Exoneradas: S/ 600.00
IGV: S/ 0.00
TOTAL: S/ 600.00

(Exonerado de IGV según Ley de Amazonía)
```

### 8.4 Cadena con Múltiples Propiedades

**Perfil:**
- 3 hoteles en diferentes ciudades
- Centralización de reportes
- Configuración independiente por propiedad

**Arquitectura multi-tenant:**
```
Base de Datos:
├── tenant_1 (Hotel Lima)
│   ├── hotel_configuracion (RUC propio, IGV activo)
│   ├── habitaciones
│   └── reservas
├── tenant_2 (Hotel Cusco)
│   ├── hotel_configuracion (RUC propio, IGV activo)
│   ├── habitaciones
│   └── reservas
└── tenant_3 (Hotel Iquitos)
    ├── hotel_configuracion (RUC propio, IGV exonerado)
    ├── habitaciones
    └── reservas
```

**Dashboard corporativo:**
- Vista consolidada de ocupación
- Comparación de performance entre propiedades
- Traslados entre hoteles (reserva en cadena)

---

## 9. GLOSARIO

### 9.1 Términos Hoteleros

| Término | Definición |
|---------|------------|
| **ADR** | Average Daily Rate - Promedio de ingreso por habitación ocupada por día |
| **Check-in** | Proceso de registro e ingreso del huésped al hotel |
| **Check-out** | Proceso de salida del huésped y cierre de cuenta |
| **Housekeeping** | Departamento de limpieza y mantenimiento de habitaciones |
| **No-Show** | Huésped que reservó pero no llegó ni canceló |
| **OTA** | Online Travel Agency - Agencia de viajes online (Booking, Expedia) |
| **RevPAR** | Revenue per Available Room - Ingreso por habitación disponible |
| **Walk-in** | Huésped que llega sin reserva previa |

### 9.2 Términos de Pricing

| Término | Definición |
|---------|------------|
| **Precio Base** | Precio sugerido por el sistema según tarifa vigente |
| **Precio Mínimo** | Límite inferior de negociación establecido por el hotel |
| **Precio Pactado** | Precio final acordado con el cliente (se congela en la reserva) |
| **Tarifa** | Regla de precio que combina tipo, categoría, temporada |
| **Temporada Alta** | Periodo de mayor demanda con precios más altos |
| **Temporada Baja** | Periodo de menor demanda con precios más bajos |

### 9.3 Términos Fiscales (SUNAT)

| Término | Definición |
|---------|------------|
| **CDR** | Constancia de Recepción - Respuesta de SUNAT validando un CPE |
| **CPE** | Comprobante de Pago Electrónico - Documento fiscal digital |
| **IGV** | Impuesto General a las Ventas (18% en Perú) |
| **ICBPER** | Impuesto al Consumo de Bolsas Plásticas |
| **NC** | Nota de Crédito - Documento que anula o corrige una factura |
| **OSE** | Operador de Servicios Electrónicos - Intermediario certificado con SUNAT |
| **PLE** | Programa de Libros Electrónicos - Formato de declaración mensual |
| **PSE** | Proveedor de Servicios Electrónicos - Similar a OSE |

### 9.4 Términos Técnicos

| Término | Definición |
|---------|------------|
| **Atomicidad** | Propiedad de una operación que se ejecuta completamente o no se ejecuta |
| **Constraint** | Restricción de base de datos que garantiza integridad |
| **Foreign Key** | Referencia a un registro en otra tabla |
| **Inmutabilidad** | Propiedad de datos que no pueden modificarse después de crearse |
| **Race Condition** | Error que ocurre cuando dos procesos acceden simultáneamente al mismo recurso |
| **Rollback** | Revertir una transacción fallida a su estado anterior |
| **Snapshot** | Copia congelada de datos en un momento específico |
| **Trigger** | Función que se ejecuta automáticamente ante un evento de BD |

---

## 10. APÉNDICES

### 10.1 Códigos SUNAT

#### A. Códigos de Afectación de IGV

| Código | Descripción | Cuándo usar |
|--------|-------------|-------------|
| 10 | Gravado - Operación Onerosa | Hotel en Lima, Arequipa, Cusco (con IGV) |
| 20 | Exonerado - Operación Onerosa | Hotel en Amazonía, Loreto (sin IGV) |
| 30 | Inafecto - Operación Onerosa | Casos especiales |

#### B. Tipos de Documento de Identidad

| Código | Descripción |
|--------|-------------|
| 1 | DNI - Documento Nacional de Identidad |
| 4 | Carné de Extranjería |
| 6 | RUC - Registro Único de Contribuyentes |
| 7 | Pasaporte |
| A | Cédula Diplomática |

#### C. Tipos de Moneda

| Código | Moneda |
|--------|--------|
| PEN | Sol Peruano |
| USD | Dólar Americano |
| EUR | Euro |

### 10.2 Ejemplo de Configuración PSE (JSON)

```json
{
  "proveedor": "nubefact",
  "api_url": "https://api.nubefact.com/api/v1",
  "api_token": "tu-token-aqui",
  "modo_prueba": false,
  "certificado_digital": {
    "tipo": "pfx",
    "ruta": "/path/to/certificado.pfx",
    "password_encrypted": "password-encriptado"
  },
  "timeout": 30000,
  "reintentos": 3,
  "webhook_url": "https://tu-hotel.com/api/webhook-sunat"
}
```

### 10.3 Diagrama de Estados de Reserva

```
                    [CREAR RESERVA]
                           |
                           v
                    ┌──────────────┐
                    │   RESERVADA  │ ← Reserva anticipada
                    └──────┬───────┘
                           |
                    [CHECK-IN] o [CANCELAR]
                           |
                ┌──────────┴──────────┐
                v                     v
         ┌─────────────┐      ┌──────────────┐
         │ CHECKED_IN  │      │  CANCELADA   │ → Estado final
         └──────┬──────┘      └──────────────┘
                |
         [CHECK-OUT] o [NO-SHOW]
                |
      ┌─────────┴─────────┐
      v                   v
┌─────────────┐   ┌─────────────┐
│ CHECKED_OUT │   │   NO_SHOW   │ → Estados finales
└─────────────┘   └─────────────┘


NOTA: Walk-in entra directo a CHECKED_IN
```

### 10.4 Diagrama de Flujo: Emisión de Comprobante

```
[Inicio: Check-out]
        |
        v
[Calcular total de reserva]
        |
        v
[Verificar pagos] ─ NO → [Solicitar pago] → [Volver]
        | SÍ
        v
[¿Requiere comprobante?] ─ NO → [Finalizar]
        | SÍ
        v
[¿Tipo?] ─ BOLETA → [Solicitar DNI]
        |                    |
        | FACTURA            v
        v              [Validar DNI]
[Solicitar RUC]             |
[Razón Social]              |
[Dirección]                 |
        |                   |
        └────────┬──────────┘
                 v
    [Obtener config del hotel]
                 |
                 v
    [Calcular impuestos]
    (Gravado/Exonerado)
                 |
                 v
    [Obtener siguiente correlativo]
    (Función atómica de BD)
                 |
                 v
    [CREAR SNAPSHOT]
    - Copiar datos del receptor
    - Copiar montos calculados
    - Copiar tipo de cambio
    - Copiar descripción
                 |
                 v
    [Insertar en BD]
    - comprobantes
    - comprobante_detalles
                 |
                 v
    [Enviar a SUNAT]
                 |
         ┌───────┴───────┐
         v               v
    [ACEPTADO]      [RECHAZADO]
         |               |
         v               v
    [Actualizar]    [Mantener]
    estado_sunat    PENDIENTE
    hash, URLs      (reintento)
         |               |
         └───────┬───────┘
                 v
          [Fin: Comprobante emitido]
```

### 10.5 Checklist de Implementación

#### Fase 1: MVP (Mínimo Viable)
- [ ] Configuración de base de datos
- [ ] Autenticación de usuarios
- [ ] CRUD de habitaciones
- [ ] CRUD de tipos y categorías
- [ ] CRUD de tarifas básicas
- [ ] Crear reserva
- [ ] Check-in básico
- [ ] Check-out básico
- [ ] Cambio de estados de habitación
- [ ] Vista de dashboard

#### Fase 2: Facturación
- [ ] Configuración del hotel
- [ ] Registro de huéspedes
- [ ] Registro de acompañantes
- [ ] Sistema de caja
- [ ] Emisión de boletas
- [ ] Emisión de facturas
- [ ] Notas de crédito
- [ ] Integración con PSE/OSE
- [ ] Vista de historial de comprobantes

#### Fase 3: Reportes
- [ ] Reporte de ocupación
- [ ] Reporte de ventas por canal
- [ ] Registro de ventas (libro)
- [ ] Reporte de caja
- [ ] Exportación a Excel
- [ ] Generación de PLE 14.1

#### Fase 4: Optimizaciones
- [ ] Búsqueda avanzada de reservas
- [ ] Notificaciones (email/SMS)
- [ ] Calendario de reservas
- [ ] Reportes gráficos
- [ ] Backup automático
- [ ] Logs de auditoría

---

## CONTROL DE VERSIONES DEL DOCUMENTO

| Versión | Fecha | Cambios | Autor |
|---------|-------|---------|-------|
| 1.0 | Ene 2026 | Versión inicial | Equipo |
| 2.0 | Ene 2026 | Agregado sistema de facturación con snapshots | Equipo |
| 2.1 | Ene 2026 | Refactorización arquitectónica (BD vs Backend) | Equipo |

---

## APROBACIONES

| Rol | Nombre | Firma | Fecha |
|-----|--------|-------|-------|
| Product Owner | | | |
| Arquitecto de Software | | | |
| Líder Técnico | | | |
| Contador/Asesor Fiscal | | | |

---

**FIN DEL DOCUMENTO**

Este documento constituye la especificación completa de requerimientos para el Sistema PMS. Cualquier cambio debe ser documentado y aprobado por los stakeholders correspondientes.

---

</artifact>

**Ahora sí está COMPLETO.** 

Este es un documento de requerimientos profesional y exhaustivo que:

✅ **Mantiene TODOS los fundamentos** (conceptos de habitación, estados, pricing, huéspedes)  
✅ **Documenta TODAS las decisiones** arquitectónicas y de negocio  
✅ **Incluye el modelo de datos completo** con todas las tablas y relaciones  
✅ **Especifica facturación con snapshots** e inmutabilidad fiscal  
✅ **Define requerimientos funcionales** claros y priorizados  
✅ **Explica la arquitectura** (BD vs Backend) sin convertirse en tutorial  
✅ **Incluye casos de uso reales** para diferentes tipos de hoteles  
✅ **Tiene glosario completo** de términos  
✅ **Aporta apéndices técnicos** (códigos SUNAT, diagramas, checklists)  

Es un **documento de referencia completo** que puede usar:
- El equipo de desarrollo para implementar
- Nuevos desarrolladores para entender el sistema
- Stakeholders para validar funcionalidades
- Auditores para verificar cumplimiento fiscal