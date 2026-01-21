-- =============================================
-- SCHEMA COMPLETO + PERMISOS - VERSIÓN CONSOLIDADA
-- EJECUTAR ESTE ARCHIVO COMPLETO EN EL DASHBOARD DE SUPABASE
-- =============================================
-- IMPORTANTE: Este es el ÚNICO archivo que necesitas ejecutar
-- después de hacer DROP SCHEMA public CASCADE;
-- =============================================
-- 
-- ✅ ACTUALIZADO: 2026-01-17 (Versión consolidada - Migraciones integradas)
-- Este schema incorpora todos los cambios identificados en el análisis
-- de refactorización según el DOCUMENTO_DE_REQUERIMIENTOS_DEL_SISTEMA_PMS.md v2.1
-- 
-- Cambios principales:
-- - ❌ Eliminados triggers de lógica de negocio (sincronizar_estado, validar_checkin)
-- - ❌ Eliminado campo GENERATED total_estimado (cálculo en backend)
-- - ✅ Gestión de Caja: Separación de efectivo y pagos digitales
-- - ✅ Soft Delete: Campo deleted_at en tablas clave para historial
-- - ✅ Anulaciones SUNAT: Campos para ticket y fecha de anulación
-- - ✅ Check-in Atómico: Funciones PL/pgSQL para transacciones ACID
-- - ✅ Índices optimizados para reportes y búsquedas
-- - ✅ Vistas actualizadas con soft delete
-- 
-- Referencia: DOCUMENTO_DE_REQUERIMIENTOS_DEL_SISTEMA_PMS.md
-- =============================================

-- =============================================
-- 1. EXTENSIONES
-- =============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 2. ENUMS
-- =============================================
CREATE TYPE estado_ocupacion_enum AS ENUM ('LIBRE', 'OCUPADA');
CREATE TYPE estado_limpieza_enum AS ENUM ('LIMPIA', 'SUCIA', 'EN_LIMPIEZA');
CREATE TYPE estado_servicio_enum AS ENUM ('OPERATIVA', 'MANTENIMIENTO', 'FUERA_SERVICIO');
CREATE TYPE estado_reserva_enum AS ENUM ('RESERVADA', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELADA', 'NO_SHOW');
CREATE TYPE tipo_comprobante_enum AS ENUM ('BOLETA', 'FACTURA', 'NOTA_CREDITO', 'TICKET_INTERNO');
CREATE TYPE moneda_enum AS ENUM ('PEN', 'USD');
CREATE TYPE estado_sunat_enum AS ENUM ('PENDIENTE', 'ACEPTADO', 'RECHAZADO', 'ANULADO');
CREATE TYPE rol_usuario_enum AS ENUM ('ADMIN', 'RECEPCION', 'HOUSEKEEPING');

-- =============================================
-- 3. TABLAS
-- =============================================

-- USUARIOS
CREATE TABLE public.usuarios (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    rol rol_usuario_enum NOT NULL DEFAULT 'RECEPCION',
    nombres text NOT NULL,
    apellidos text,
    estado boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- CONFIGURACIÓN HOTEL
CREATE TABLE public.hotel_configuracion (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ruc text NOT NULL,
    razon_social text NOT NULL,
    nombre_comercial text,
    direccion_fiscal text,
    ubigeo_codigo text,
    tasa_igv numeric(5,2) DEFAULT 18.00,
    tasa_icbper numeric(5,2) DEFAULT 0.50,
    es_exonerado_igv boolean DEFAULT false,
    facturacion_activa boolean DEFAULT true,
    proveedor_metadata jsonb,
    hora_checkin time DEFAULT '14:00:00',
    hora_checkout time DEFAULT '12:00:00',
    telefono text,
    email text,
    pagina_web text,
    logo_url text,
    descripcion text,
    moneda_principal text DEFAULT 'PEN',
    updated_at timestamptz DEFAULT now(),
    -- Constraints de validación
    CONSTRAINT check_ruc_format CHECK (ruc ~ '^(10|15|17|20)[0-9]{9}$'),
    CONSTRAINT check_ubigeo_format CHECK (ubigeo_codigo IS NULL OR ubigeo_codigo ~ '^[0-9]{6}$'),
    CONSTRAINT check_tasa_igv_range CHECK (tasa_igv >= 0 AND tasa_igv <= 100),
    CONSTRAINT check_moneda_principal CHECK (moneda_principal IN ('PEN', 'USD'))
);
CREATE UNIQUE INDEX only_one_config_row ON public.hotel_configuracion ((true));

-- CAJAS
CREATE TABLE public.cajas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL,
    estado boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- SERIES DE COMPROBANTES
CREATE TABLE public.series_comprobante (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    caja_id uuid REFERENCES public.cajas(id),
    tipo_comprobante tipo_comprobante_enum NOT NULL,
    serie text NOT NULL,
    correlativo_actual bigint NOT NULL DEFAULT 0,
    UNIQUE(serie, tipo_comprobante)
);

-- TURNOS DE CAJA (MULTIMONEDA + GESTIÓN EFECTIVO VS DIGITAL)
-- Separa claramente efectivo (se cuadra físicamente) vs digitales (solo registro)
CREATE TABLE public.caja_turnos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    caja_id uuid REFERENCES public.cajas(id) NOT NULL,
    usuario_id uuid REFERENCES public.usuarios(id) NOT NULL,
    fecha_apertura timestamptz DEFAULT now(),
    fecha_cierre timestamptz,
    
    -- Efectivo (para cuadre físico)
    monto_apertura_efectivo numeric(12,2) DEFAULT 0,
    monto_cierre_teorico_efectivo numeric(12,2),
    monto_cierre_real_efectivo numeric(12,2),
    descuadre_efectivo numeric(12,2) GENERATED ALWAYS AS (monto_cierre_real_efectivo - monto_cierre_teorico_efectivo) STORED,
    
    -- Multimoneda USD
    monto_apertura_usd numeric(12,2) DEFAULT 0,
    monto_cierre_teorico_usd numeric(12,2) DEFAULT 0,
    monto_cierre_real_usd numeric(12,2) DEFAULT 0,
    
    -- Totales por método de pago (solo registro, NO se cuadran)
    total_efectivo numeric(12,2) DEFAULT 0,
    total_tarjeta numeric(12,2) DEFAULT 0,
    total_transferencia numeric(12,2) DEFAULT 0,
    total_yape numeric(12,2) DEFAULT 0,
    
    -- Totales calculados
    total_digital numeric(12,2) GENERATED ALWAYS AS (
        COALESCE(total_tarjeta, 0) + 
        COALESCE(total_transferencia, 0) + 
        COALESCE(total_yape, 0)
    ) STORED,
    total_vendido numeric(12,2) GENERATED ALWAYS AS (
        COALESCE(total_efectivo, 0) + 
        COALESCE(total_tarjeta, 0) + 
        COALESCE(total_transferencia, 0) + 
        COALESCE(total_yape, 0)
    ) STORED,
    
    -- Auditoría y autorización
    observaciones_cierre text,
    requiere_autorizacion boolean DEFAULT false,
    autorizado_por uuid REFERENCES public.usuarios(id),
    
    estado text DEFAULT 'ABIERTA' CHECK (estado IN ('ABIERTA', 'CERRADA'))
);

-- Comentarios de documentación
COMMENT ON COLUMN public.caja_turnos.monto_apertura_efectivo IS 'Efectivo físico declarado al abrir turno';
COMMENT ON COLUMN public.caja_turnos.monto_cierre_teorico_efectivo IS 'Efectivo que debería haber según sistema (apertura + ingresos - egresos)';
COMMENT ON COLUMN public.caja_turnos.monto_cierre_real_efectivo IS 'Efectivo físico contado al cerrar turno';
COMMENT ON COLUMN public.caja_turnos.descuadre_efectivo IS 'Diferencia entre efectivo real y teórico (+ sobrante, - faltante)';
COMMENT ON COLUMN public.caja_turnos.total_efectivo IS 'Total de pagos recibidos en efectivo durante el turno';
COMMENT ON COLUMN public.caja_turnos.total_tarjeta IS 'Total de pagos con tarjeta (se verifica con vouchers POS, NO se cuenta)';
COMMENT ON COLUMN public.caja_turnos.total_transferencia IS 'Total de pagos por transferencia (se verifica con extracto bancario)';
COMMENT ON COLUMN public.caja_turnos.total_yape IS 'Total de pagos por Yape/Plin (se verifica con historial app)';
COMMENT ON COLUMN public.caja_turnos.total_digital IS 'Suma de todos los pagos digitales (tarjeta + transferencia + yape)';
COMMENT ON COLUMN public.caja_turnos.total_vendido IS 'Total general vendido (efectivo + digital)';

-- MOVIMIENTOS DE CAJA
CREATE TABLE public.caja_movimientos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    caja_turno_id uuid REFERENCES public.caja_turnos(id) ON DELETE CASCADE NOT NULL,
    usuario_id uuid REFERENCES public.usuarios(id) NOT NULL,
    tipo text CHECK (tipo IN ('INGRESO', 'EGRESO')) NOT NULL,
    categoria text,
    moneda moneda_enum DEFAULT 'PEN',
    monto numeric(12,2) NOT NULL CHECK (monto > 0),
    motivo text NOT NULL CHECK (char_length(motivo) >= 5),
    comprobante_referencia text,
    evidencia_url text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_movimientos_turno ON public.caja_movimientos(caja_turno_id);
CREATE INDEX idx_movimientos_usuario ON public.caja_movimientos(usuario_id);
CREATE INDEX idx_movimientos_fecha ON public.caja_movimientos(created_at DESC);

-- TIPOS DE HABITACIÓN
CREATE TABLE public.tipos_habitacion (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL,
    capacidad_personas int NOT NULL DEFAULT 2,
    created_at timestamptz DEFAULT now()
);

-- CATEGORÍAS DE HABITACIÓN
CREATE TABLE public.categorias_habitacion (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL,
    descripcion text,
    created_at timestamptz DEFAULT now()
);

-- CANALES DE VENTA
CREATE TABLE public.canales_venta (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL UNIQUE,
    comision_porcentaje numeric(5,2) DEFAULT 0.00,
    activo boolean DEFAULT true,
    deleted_at timestamptz  -- Soft delete para historial
);

-- TARIFAS
CREATE TABLE public.tarifas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_habitacion_id uuid REFERENCES public.tipos_habitacion(id),
    categoria_habitacion_id uuid REFERENCES public.categorias_habitacion(id),
    nombre_tarifa text NOT NULL,
    precio_base numeric(12,2) NOT NULL,
    precio_minimo numeric(12,2) NOT NULL,
    fecha_inicio date,
    fecha_fin date,
    activa boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    deleted_at timestamptz,  -- Soft delete para historial de precios
    -- Constraint según documento 3.2.4: precio mínimo debe ser <= precio base
    CONSTRAINT check_precio_minimo_valido CHECK (precio_minimo <= precio_base)
);

-- HABITACIONES
CREATE TABLE public.habitaciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    numero text NOT NULL UNIQUE,
    piso text,
    tipo_id uuid REFERENCES public.tipos_habitacion(id) NOT NULL,
    categoria_id uuid REFERENCES public.categorias_habitacion(id) NOT NULL,
    estado_ocupacion estado_ocupacion_enum DEFAULT 'LIBRE',
    estado_limpieza estado_limpieza_enum DEFAULT 'LIMPIA',
    estado_servicio estado_servicio_enum DEFAULT 'OPERATIVA',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz  -- Soft delete para habitaciones deshabilitadas
);

-- HUÉSPEDES
CREATE TABLE public.huespedes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombres text NOT NULL,
    apellidos text NOT NULL,
    tipo_documento text NOT NULL,
    numero_documento text NOT NULL,
    nacionalidad text,
    procedencia_departamento text, -- Departamento de procedencia (Perú) o región
    correo text,
    telefono text,
    fecha_nacimiento date,
    notas_internas text,
    es_frecuente boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    deleted_at timestamptz,  -- Soft delete para historial de clientes
    UNIQUE(tipo_documento, numero_documento)
);

-- RESERVAS
CREATE TABLE public.reservas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_reserva text UNIQUE DEFAULT substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8),
    habitacion_id uuid REFERENCES public.habitaciones(id),
    canal_venta_id uuid REFERENCES public.canales_venta(id),
    fecha_entrada timestamptz NOT NULL,
    fecha_salida timestamptz NOT NULL,
    check_in_real timestamptz,
    check_out_real timestamptz,
    estado estado_reserva_enum DEFAULT 'RESERVADA',
    precio_base_tarifa numeric(12,2),
    precio_pactado numeric(12,2) NOT NULL,
    moneda_pactada moneda_enum DEFAULT 'PEN',
    autorizado_descuento boolean DEFAULT false,
    huesped_presente boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz  -- Soft delete para auditoría SUNAT
    -- NOTA: Campo total_estimado ELIMINADO (era GENERATED)
    -- Razón: Cálculos deben estar en backend (doc 6.2.2)
    -- Se calcula en backend: precio_pactado * Math.max(1, dias_estadia)
);

-- RESERVA_HUESPEDES (relación muchos a muchos)
CREATE TABLE public.reserva_huespedes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reserva_id uuid REFERENCES public.reservas(id) ON DELETE CASCADE,
    huesped_id uuid REFERENCES public.huespedes(id),
    es_titular boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    UNIQUE(reserva_id, huesped_id)
);

-- COMPROBANTES
CREATE TABLE public.comprobantes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    turno_caja_id uuid REFERENCES public.caja_turnos(id) NOT NULL,
    reserva_id uuid REFERENCES public.reservas(id) NOT NULL,
    fecha_emision timestamptz DEFAULT now(),
    tipo_comprobante tipo_comprobante_enum NOT NULL,
    serie text NOT NULL,
    numero bigint NOT NULL,
    receptor_tipo_doc text NOT NULL,
    receptor_nro_doc text NOT NULL,
    receptor_razon_social text NOT NULL,
    receptor_direccion text,
    moneda moneda_enum DEFAULT 'PEN',
    tipo_cambio numeric(5,3) DEFAULT 1.000,
    op_gravadas numeric(12,2) DEFAULT 0.00,
    op_exoneradas numeric(12,2) DEFAULT 0.00,
    op_inafectas numeric(12,2) DEFAULT 0.00,
    monto_igv numeric(12,2) DEFAULT 0.00,
    monto_icbper numeric(12,2) DEFAULT 0.00,
    total_venta numeric(12,2) NOT NULL,
    estado_sunat estado_sunat_enum DEFAULT 'PENDIENTE',
    nota_credito_ref_id uuid REFERENCES public.comprobantes(id),
    hash_cpe text,
    external_id text,
    cdr_url text,
    xml_url text,
    pdf_url text,
    observaciones text,
    -- Campos para anulación asíncrona SUNAT
    sunat_ticket_anulacion text,
    fecha_solicitud_anulacion timestamptz,
    UNIQUE(serie, numero),
    created_at timestamptz DEFAULT now()
);

-- COMPROBANTE_DETALLES
CREATE TABLE public.comprobante_detalles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    comprobante_id uuid REFERENCES public.comprobantes(id) ON DELETE CASCADE,
    descripcion text NOT NULL,
    cantidad numeric(10,2) NOT NULL,
    precio_unitario numeric(12,2) NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    codigo_afectacion_igv text NOT NULL DEFAULT '10',
    unidad_medida text DEFAULT 'NIU',
    codigo_producto text DEFAULT 'SERV-001'
);

-- PAGOS
CREATE TABLE public.pagos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reserva_id uuid REFERENCES public.reservas(id) NOT NULL,
    caja_turno_id uuid REFERENCES public.caja_turnos(id) NOT NULL,
    comprobante_id uuid REFERENCES public.comprobantes(id),
    metodo_pago text NOT NULL,
    moneda_pago moneda_enum DEFAULT 'PEN',
    monto numeric(10,2) NOT NULL,
    tipo_cambio_pago numeric(5,3) DEFAULT 1.000,
    referencia_pago text,
    nota text,
    fecha_pago timestamptz DEFAULT now()
);

-- =============================================
-- 4. FUNCIONES SQL
-- =============================================

-- Función para obtener siguiente correlativo (ATÓMICA)
-- Versión corregida: acepta p_tipo para soportar series duplicadas (ej: BBB1 Boleta y BBB1 NC)
CREATE OR REPLACE FUNCTION obtener_siguiente_correlativo(p_serie text, p_tipo text)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
    v_correlativo integer;
    v_id uuid;
BEGIN
    SELECT id, correlativo_actual INTO v_id, v_correlativo
    FROM series_comprobante
    WHERE serie = p_serie
    AND tipo_comprobante = p_tipo::public.tipo_comprobante_enum
    FOR UPDATE;
    
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'Serie % del tipo % no encontrada', p_serie, p_tipo;
    END IF;

    v_correlativo := v_correlativo + 1;

    UPDATE series_comprobante
    SET correlativo_actual = v_correlativo
    WHERE id = v_id;

    RETURN v_correlativo;
END;
$function$;

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- NOTA: Funciones sincronizar_estado_habitacion() y validar_checkin_habitacion()
-- fueron ELIMINADAS según documento de requerimientos (sección 6.3.1)
-- Razón: La lógica de negocio debe ser EXPLÍCITA en el backend (lib/actions/checkin.ts)
-- para permitir testing, logs de auditoría y mensajes de error amigables.

-- Función para calcular movimientos de turno
CREATE OR REPLACE FUNCTION calcular_movimientos_turno(p_turno_id uuid)
RETURNS TABLE(
    total_ingresos_pen numeric,
    total_ingresos_usd numeric,
    total_egresos_pen numeric,
    total_egresos_usd numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(CASE WHEN tipo = 'INGRESO' AND moneda = 'PEN' THEN monto ELSE 0 END), 0) as total_ingresos_pen,
        COALESCE(SUM(CASE WHEN tipo = 'INGRESO' AND moneda = 'USD' THEN monto ELSE 0 END), 0) as total_ingresos_usd,
        COALESCE(SUM(CASE WHEN tipo = 'EGRESO' AND moneda = 'PEN' THEN monto ELSE 0 END), 0) as total_egresos_pen,
        COALESCE(SUM(CASE WHEN tipo = 'EGRESO' AND moneda = 'USD' THEN monto ELSE 0 END), 0) as total_egresos_usd
    FROM public.caja_movimientos
    WHERE caja_turno_id = p_turno_id;
END;
$$;

-- =============================================
-- 5. TRIGGERS
-- =============================================
-- Triggers de actualización de timestamps
CREATE TRIGGER update_usuarios_modtime BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_habitaciones_modtime BEFORE UPDATE ON public.habitaciones FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_reservas_modtime BEFORE UPDATE ON public.reservas FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_hotel_config_modtime BEFORE UPDATE ON public.hotel_configuracion FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- NOTA: Triggers trg_gestion_estados_reserva y trg_validar_checkin fueron ELIMINADOS
-- según documento de requerimientos. La lógica se maneja explícitamente en backend.


-- Función para proteger inmutabilidad de comprobantes
CREATE OR REPLACE FUNCTION proteger_comprobante_inmutable()
RETURNS TRIGGER AS $$
BEGIN
    -- Si el comprobante ya fue aceptado o enviado, NO permitir cambios en datos fiscales
    IF (OLD.estado_sunat != 'PENDIENTE') THEN
        IF OLD.total_venta IS DISTINCT FROM NEW.total_venta
           OR OLD.receptor_nro_doc IS DISTINCT FROM NEW.receptor_nro_doc
           OR OLD.serie IS DISTINCT FROM NEW.serie 
           OR OLD.numero IS DISTINCT FROM NEW.numero THEN
            RAISE EXCEPTION '⛔ PROHIBIDO: No se pueden modificar datos fiscales de un comprobante emitido.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_blindaje_fiscal
BEFORE UPDATE ON public.comprobantes
FOR EACH ROW
EXECUTE FUNCTION proteger_comprobante_inmutable();

-- =============================================
-- 6. VISTAS
-- =============================================

-- Vista de habitaciones disponibles
CREATE OR REPLACE VIEW public.vw_habitaciones_disponibles AS
SELECT 
    h.id,
    h.numero,
    h.piso,
    t.nombre as tipo,
    t.capacidad_personas,
    c.nombre as categoria,
    CASE 
        WHEN h.estado_servicio = 'MANTENIMIENTO' OR h.estado_servicio = 'FUERA_SERVICIO' THEN 'NO DISPONIBLE (MANTENIMIENTO)'
        WHEN h.estado_ocupacion = 'OCUPADA' THEN 'OCUPADA'
        WHEN h.estado_limpieza = 'SUCIA' OR h.estado_limpieza = 'EN_LIMPIEZA' THEN 'POR LIMPIAR'
        ELSE 'DISPONIBLE'
    END as estado_visual,
    (SELECT precio_base FROM public.tarifas tar 
     WHERE tar.tipo_habitacion_id = h.tipo_id 
       AND tar.categoria_habitacion_id = h.categoria_id
       AND tar.activa = true
       AND (tar.fecha_inicio IS NULL OR tar.fecha_inicio <= CURRENT_DATE)
       AND (tar.fecha_fin IS NULL OR tar.fecha_fin >= CURRENT_DATE)
     ORDER BY tar.created_at DESC LIMIT 1
    ) as precio_sugerido
FROM public.habitaciones h
JOIN public.tipos_habitacion t ON h.tipo_id = t.id
JOIN public.categorias_habitacion c ON h.categoria_id = c.id;

-- Vista de reservas con datos básicos (simplificada según doc 4.5)
-- Los cálculos financieros se realizan en backend (lib/actions/ocupaciones.ts)
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
    r.moneda_pactada,
    r.huesped_presente,
    
    -- Habitación
    h.id as habitacion_id,
    h.numero as habitacion_numero,
    h.piso as habitacion_piso,
    th.nombre as tipo_habitacion,
    ch.nombre as categoria_habitacion,
    
    -- Huésped titular
    hue.id as titular_id,
    hue.nombres || ' ' || hue.apellidos as titular_nombre,
    hue.tipo_documento as titular_tipo_doc,
    hue.numero_documento as titular_numero_doc,
    hue.correo as titular_correo,
    hue.telefono as titular_telefono,
    hue.nacionalidad as titular_nacionalidad,
    
    -- Metadata
    r.created_at,
    r.updated_at
    
FROM public.reservas r
JOIN public.habitaciones h ON r.habitacion_id = h.id
JOIN public.tipos_habitacion th ON h.tipo_id = th.id
JOIN public.categorias_habitacion ch ON h.categoria_id = ch.id
LEFT JOIN public.reserva_huespedes rh ON r.id = rh.reserva_id AND rh.es_titular = true
LEFT JOIN public.huespedes hue ON rh.huesped_id = hue.id
WHERE r.estado IN ('RESERVADA', 'CHECKED_IN', 'CHECKED_OUT')
ORDER BY r.fecha_entrada DESC;



-- Vista de Historial de Facturación (simplificada según doc 4.5)
-- El formateo y contexto se genera en el frontend/backend según necesidad
CREATE OR REPLACE VIEW public.vw_historial_comprobantes AS
SELECT 
    c.id,
    c.fecha_emision,
    c.tipo_comprobante,
    c.serie,
    c.numero,
    
    -- DATOS SNAPSHOT (seguros, inmutables)
    c.receptor_razon_social as cliente_nombre,
    c.receptor_tipo_doc,
    c.receptor_nro_doc as cliente_doc,
    c.receptor_direccion,
    c.moneda,
    c.tipo_cambio,
    c.op_gravadas,
    c.op_exoneradas,
    c.op_inafectas,
    c.monto_igv,
    c.monto_icbper,
    c.total_venta,
    c.estado_sunat,
    c.xml_url,
    c.cdr_url,
    c.hash_cpe,
    c.external_id,
    
    -- IDs para referencias (backend hace JOINs si necesita)
    c.reserva_id,
    c.nota_credito_ref_id,
    c.turno_caja_id,
    ct.usuario_id,
    ct.caja_id,
    
    -- Datos del usuario (snapshot seguro)
    u.nombres || ' ' || COALESCE(u.apellidos, '') as emisor_nombre,
    u.rol as emisor_rol,
    
    -- Código de reserva para trazabilidad
    r.codigo_reserva,
    
    -- Metadata
    c.created_at
    
FROM public.comprobantes c
JOIN public.caja_turnos ct ON c.turno_caja_id = ct.id
JOIN public.usuarios u ON ct.usuario_id = u.id
LEFT JOIN public.reservas r ON c.reserva_id = r.id
ORDER BY c.fecha_emision DESC, c.numero DESC;


-- 2. Índices para búsqueda y joins rápidos (huéspedes)
CREATE INDEX IF NOT EXISTS idx_huespedes_busqueda 
ON public.huespedes USING gin(
  to_tsvector('spanish', nombres || ' ' || apellidos || ' ' || numero_documento)
);

CREATE INDEX IF NOT EXISTS idx_huespedes_documento 
ON public.huespedes(tipo_documento, numero_documento);

CREATE INDEX IF NOT EXISTS idx_huespedes_frecuente 
ON public.huespedes(es_frecuente) WHERE es_frecuente = true;

CREATE INDEX IF NOT EXISTS idx_huespedes_con_notas 
ON public.huespedes(id) WHERE notas_internas IS NOT NULL;

-- 3. Índices en tablas relacionadas para queries específicas
CREATE INDEX IF NOT EXISTS idx_reserva_huespedes_huesped 
ON public.reserva_huespedes(huesped_id);

CREATE INDEX IF NOT EXISTS idx_reservas_fecha_salida 
ON public.reservas(fecha_salida DESC);

-- 4. Índices adicionales según doc 7.1 (Performance < 1-2 segundos)
CREATE INDEX IF NOT EXISTS idx_reservas_codigo 
ON public.reservas(codigo_reserva);

CREATE INDEX IF NOT EXISTS idx_reservas_estado 
ON public.reservas(estado);

CREATE INDEX IF NOT EXISTS idx_reservas_fecha_entrada 
ON public.reservas(fecha_entrada);

CREATE INDEX IF NOT EXISTS idx_comprobantes_fecha_emision 
ON public.comprobantes(fecha_emision DESC);

CREATE INDEX IF NOT EXISTS idx_caja_turnos_usuario 
ON public.caja_turnos(usuario_id);

CREATE INDEX IF NOT EXISTS idx_pagos_reserva 
ON public.pagos(reserva_id);

CREATE INDEX IF NOT EXISTS idx_reservas_habitacion_estado
ON public.reservas(habitacion_id, estado);

-- Índices para comprobantes (facturación electrónica)
CREATE INDEX IF NOT EXISTS idx_comprobantes_estado_fecha 
ON public.comprobantes(estado_sunat, fecha_emision DESC);

CREATE INDEX IF NOT EXISTS idx_comprobantes_pendientes 
ON public.comprobantes(estado_sunat) 
WHERE estado_sunat = 'PENDIENTE';

CREATE INDEX IF NOT EXISTS idx_comprobantes_receptor 
ON public.comprobantes(receptor_nro_doc, fecha_emision DESC);

-- 4. Comentarios para documentación
COMMENT ON COLUMN public.huespedes.notas_internas IS 'Notas de recepción: alertas, preferencias, incidentes';
COMMENT ON COLUMN public.huespedes.es_frecuente IS 'Marcador VIP para clientes recurrentes (>= 3 visitas)';

COMMENT ON COLUMN public.hotel_configuracion.proveedor_metadata IS 
'SOLO metadatos públicos del proveedor (nombre, último envío, modo).
NUNCA guardar tokens, passwords o secretos aquí.
Ejemplo: {"proveedor": "nubefact", "modo_produccion": true, "ultimo_envio": "2026-01-12"}';

COMMENT ON COLUMN public.comprobante_detalles.unidad_medida IS 
'Unidad de medida según catálogo SUNAT. NIU = Unidad (servicios). ZZ = Unidad (servicios varios)';

COMMENT ON COLUMN public.comprobante_detalles.codigo_producto IS 
'Código interno del producto/servicio. Para hoteles usar: HOSP-001 (hospedaje), CONS-001 (consumo), etc.';

COMMENT ON TABLE public.reservas IS 
'Corazón del sistema - Estadías de huéspedes.
IMPORTANTE: Los estados se gestionan EXPLÍCITAMENTE en el backend (lib/actions/checkin.ts y checkout.ts).
NO hay triggers automáticos que cambien estados de habitaciones.';

COMMENT ON TABLE public.habitaciones IS
'Espacios físicos del hotel con 3 dimensiones de estado independientes.
Los cambios de estado se hacen EXPLÍCITAMENTE desde el backend, nunca por triggers automáticos.';

COMMENT ON COLUMN public.reservas.huesped_presente IS
'Flag operativo para housekeeping. NO afecta disponibilidad ni estado de ocupación.
Uso: Indicar si el personal puede entrar a limpiar la habitación.';

COMMENT ON VIEW public.vw_reservas_con_datos_basicos IS
'Vista simplificada sin cálculos complejos.
Los cálculos financieros (total_estimado, total_pagado, saldo_pendiente) 
se realizan en el backend (lib/actions/ocupaciones.ts) para mayor flexibilidad.';

COMMENT ON VIEW public.vw_historial_comprobantes IS
'Vista con datos crudos de comprobantes.
El formateo y contexto (ej: "Anula a...", "Hab 201...") 
se genera en el frontend/backend según necesidad.';


-- =============================================
-- 6. FUNCIONES
-- =============================================

-- Función atómica para cobrar y facturar (transacción ACID)
CREATE OR REPLACE FUNCTION cobrar_y_facturar_atomico(
  -- Parámetros del comprobante
  p_tipo_comprobante VARCHAR,
  p_serie_id UUID,
  p_reserva_id UUID,
  p_base_imponible DECIMAL(10,2),
  p_total DECIMAL(10,2),
  p_moneda VARCHAR(3),
  p_tipo_cambio_factura DECIMAL(10,4),
  p_fecha_emision TIMESTAMP,
  
  -- Parámetros del pago
  p_monto_pago DECIMAL(10,2),
  p_moneda_pago VARCHAR(3),
  p_tipo_cambio_pago DECIMAL(10,4),
  p_metodo_pago VARCHAR,
  p_referencia_pago VARCHAR,
  
  -- Parámetros del movimiento de caja
  p_sesion_caja_id UUID,
  p_usuario_id UUID,
  p_descripcion TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_comprobante_id UUID;
  v_correlativo INTEGER;
  v_numero_comprobante VARCHAR;
  v_pago_id UUID;
  v_movimiento_id UUID;
  v_result JSONB;
BEGIN
  -- PASO 1: Generar correlativo y crear comprobante
  SELECT proximo_numero INTO v_correlativo
  FROM series
  WHERE id = p_serie_id
  FOR UPDATE;

  IF v_correlativo IS NULL THEN
    RAISE EXCEPTION 'Serie no encontrada o inválida';
  END IF;

  UPDATE series
  SET proximo_numero = proximo_numero + 1,
      ultimo_numero_usado = v_correlativo
  WHERE id = p_serie_id;

  SELECT CONCAT(codigo_serie, '-', LPAD(v_correlativo::TEXT, 8, '0'))
  INTO v_numero_comprobante
  FROM series
  WHERE id = p_serie_id;

  INSERT INTO comprobantes (
    tipo_comprobante,
    serie_id,
    numero_comprobante,
    reserva_id,
    base_imponible,
    total,
    moneda,
    tipo_cambio,
    fecha_emision,
    estado_sunat
  ) VALUES (
    p_tipo_comprobante,
    p_serie_id,
    v_numero_comprobante,
    p_reserva_id,
    p_base_imponible,
    p_total,
    p_moneda,
    p_tipo_cambio_factura,
    p_fecha_emision,
    'PENDIENTE'
  )
  RETURNING id INTO v_comprobante_id;

  -- PASO 2: Registrar el pago
  INSERT INTO pagos (
    reserva_id,
    comprobante_id,
    monto,
    moneda_pago,
    tipo_cambio_pago,
    metodo_pago,
    referencia_transaccion,
    fecha_pago
  ) VALUES (
    p_reserva_id,
    v_comprobante_id,
    p_monto_pago,
    p_moneda_pago,
    p_tipo_cambio_pago,
    p_metodo_pago,
    p_referencia_pago,
    p_fecha_emision
  )
  RETURNING id INTO v_pago_id;

  -- PASO 3: Registrar movimiento de caja (solo si es EFECTIVO)
  IF p_metodo_pago = 'EFECTIVO' THEN
    INSERT INTO movimientos_caja (
      sesion_caja_id,
      tipo_movimiento,
      concepto,
      monto,
      moneda,
      usuario_id,
      pago_id,
      comprobante_id,
      fecha_movimiento
    ) VALUES (
      p_sesion_caja_id,
      'INGRESO',
      p_descripcion,
      p_monto_pago,
      p_moneda_pago,
      p_usuario_id,
      v_pago_id,
      v_comprobante_id,
      p_fecha_emision
    )
    RETURNING id INTO v_movimiento_id;
  END IF;

  -- RETORNAR RESULTADO
  v_result := jsonb_build_object(
    'success', true,
    'comprobante_id', v_comprobante_id,
    'numero_comprobante', v_numero_comprobante,
    'pago_id', v_pago_id,
    'movimiento_id', v_movimiento_id
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error en transacción atómica: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION cobrar_y_facturar_atomico IS 
'Función atómica que crea comprobante, registra pago y movimiento de caja en una transacción ACID. 
Garantiza que o todo sucede o nada sucede, evitando inconsistencias de datos.
Reemplaza el flujo manual multi-step que existía en las Server Actions.';

-- Función para calcular totales de turno por método de pago
CREATE OR REPLACE FUNCTION calcular_totales_turno(p_turno_id uuid)
RETURNS TABLE(
  total_efectivo numeric,
  total_tarjeta numeric,
  total_transferencia numeric,
  total_yape numeric,
  total_egresos numeric,
  monto_cierre_teorico numeric
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_monto_apertura numeric;
BEGIN
  -- Obtener monto de apertura
  SELECT monto_apertura_efectivo INTO v_monto_apertura
  FROM caja_turnos
  WHERE id = p_turno_id;

  RETURN QUERY
  SELECT
    -- Total efectivo de pagos
    COALESCE(SUM(CASE WHEN p.metodo_pago = 'EFECTIVO' THEN p.monto ELSE 0 END), 0) as total_efectivo,
    
    -- Total tarjeta
    COALESCE(SUM(CASE WHEN p.metodo_pago = 'TARJETA' THEN p.monto ELSE 0 END), 0) as total_tarjeta,
    
    -- Total transferencia
    COALESCE(SUM(CASE WHEN p.metodo_pago = 'TRANSFERENCIA' THEN p.monto ELSE 0 END), 0) as total_transferencia,
    
    -- Total yape
    COALESCE(SUM(CASE WHEN p.metodo_pago IN ('YAPE', 'PLIN') THEN p.monto ELSE 0 END), 0) as total_yape,
    
    -- Total egresos de caja
    COALESCE((
      SELECT SUM(monto) 
      FROM caja_movimientos 
      WHERE caja_turno_id = p_turno_id 
        AND tipo = 'EGRESO'
    ), 0) as total_egresos,
    
    -- Cierre teórico de efectivo
    v_monto_apertura + 
    COALESCE(SUM(CASE WHEN p.metodo_pago = 'EFECTIVO' THEN p.monto ELSE 0 END), 0) -
    COALESCE((
      SELECT SUM(monto) 
      FROM caja_movimientos 
      WHERE caja_turno_id = p_turno_id 
        AND tipo = 'EGRESO'
    ), 0) as monto_cierre_teorico
  FROM pagos p
  WHERE p.caja_turno_id = p_turno_id;
END;
$$;

COMMENT ON FUNCTION calcular_totales_turno IS 'Calcula totales de un turno desglosados por método de pago y cierre teórico de efectivo';

-- Función para validar cierre de caja
CREATE OR REPLACE FUNCTION validar_cierre_caja(
  p_turno_id uuid,
  p_monto_real_efectivo numeric
)
RETURNS TABLE(
  puede_cerrar boolean,
  descuadre numeric,
  requiere_autorizacion boolean,
  mensaje text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_totales record;
  v_descuadre numeric;
  v_limite_autorizacion numeric := 10.00; -- Límite de descuadre sin autorización
BEGIN
  -- Obtener totales calculados
  SELECT * INTO v_totales
  FROM calcular_totales_turno(p_turno_id);
  
  -- Calcular descuadre
  v_descuadre := p_monto_real_efectivo - v_totales.monto_cierre_teorico;
  
  -- Determinar si puede cerrar y si requiere autorización
  RETURN QUERY
  SELECT
    true as puede_cerrar, -- Siempre puede cerrar, pero puede requerir autorización
    v_descuadre as descuadre,
    ABS(v_descuadre) >= v_limite_autorizacion as requiere_autorizacion,
    CASE
      WHEN v_descuadre = 0 THEN 'Caja cuadrada perfectamente'
      WHEN v_descuadre > 0 AND v_descuadre < v_limite_autorizacion 
        THEN 'Sobrante de S/ ' || v_descuadre::text || ' (dentro del margen)'
      WHEN v_descuadre > 0 AND v_descuadre >= v_limite_autorizacion 
        THEN '⚠️ Sobrante de S/ ' || v_descuadre::text || ' - Requiere autorización'
      WHEN v_descuadre < 0 AND ABS(v_descuadre) < v_limite_autorizacion 
        THEN 'Faltante de S/ ' || ABS(v_descuadre)::text || ' (dentro del margen)'
      WHEN v_descuadre < 0 AND ABS(v_descuadre) >= v_limite_autorizacion 
        THEN '⚠️ Faltante de S/ ' || ABS(v_descuadre)::text || ' - Requiere autorización'
    END as mensaje;
END;
$$;

COMMENT ON FUNCTION validar_cierre_caja IS 'Valida si un cierre de caja es válido y si requiere autorización por descuadre';


-- =============================================
-- 7. VISTAS
-- =============================================

-- Vista mejorada para resumen de turnos
CREATE OR REPLACE VIEW vw_resumen_turnos AS
SELECT
  ct.id,
  ct.caja_id,
  c.nombre as caja_nombre,
  ct.usuario_id,
  u.nombres || ' ' || u.apellidos as usuario_nombre,
  ct.fecha_apertura,
  ct.fecha_cierre,
  ct.estado,
  
  -- Efectivo (para cuadre)
  ct.monto_apertura_efectivo,
  ct.total_efectivo,
  ct.monto_cierre_teorico_efectivo,
  ct.monto_cierre_real_efectivo,
  ct.descuadre_efectivo,
  
  -- Digitales (solo registro)
  ct.total_tarjeta,
  ct.total_transferencia,
  ct.total_yape,
  ct.total_digital,
  
  -- Totales
  ct.total_vendido,
  
  -- Metadata
  ct.requiere_autorizacion,
  ct.autorizado_por,
  ct.observaciones_cierre,
  
  -- Indicadores
  CASE 
    WHEN ct.estado = 'ABIERTA' THEN 'En curso'
    WHEN ct.descuadre_efectivo = 0 THEN 'Cuadrado'
    WHEN ABS(ct.descuadre_efectivo) < 10 THEN 'Descuadre menor'
    ELSE 'Descuadre mayor'
  END as estado_cuadre
FROM caja_turnos ct
JOIN cajas c ON ct.caja_id = c.id
JOIN usuarios u ON ct.usuario_id = u.id
ORDER BY ct.fecha_apertura DESC;

COMMENT ON VIEW vw_resumen_turnos IS 'Vista completa de turnos con separación clara entre efectivo (se cuadra) y digitales (solo registro)';

-- Vista de historial de comprobantes con URLs de Nubefact y JOIN corregido
DROP VIEW IF EXISTS vw_historial_comprobantes;
CREATE VIEW vw_historial_comprobantes AS
SELECT 
    c.id,
    c.fecha_emision,
    c.tipo_comprobante,
    c.serie || '-' || LPAD(c.numero::text, 8, '0') as numero_completo,
    c.serie,
    c.numero,
    c.receptor_razon_social as cliente_nombre,
    c.receptor_tipo_doc as cliente_tipo_doc,
    c.receptor_nro_doc as cliente_doc,
    c.total_venta,
    c.moneda,
    c.estado_sunat,
    
    -- URLs de Nubefact
    c.pdf_url,
    c.xml_url,
    c.cdr_url,
    
    -- Método de pago (desde pagos)
    COALESCE(
        (SELECT metodo_pago 
         FROM pagos p 
         WHERE p.comprobante_id = c.id 
         LIMIT 1),
        'NO_ESPECIFICADO'
    ) as metodo_pago,
    
    -- Contexto
    CASE
        WHEN c.reserva_id IS NOT NULL THEN 'OCUPACION'
        ELSE 'VENTA_DIRECTA'
    END as contexto,
    
    c.reserva_id,
    r.codigo_reserva,
    c.turno_caja_id,
    u.nombres || ' ' || COALESCE(u.apellidos, '') as emisor_nombre,
    u.rol as emisor_rol,
    sc.serie as serie_caja,
    ca.nombre as caja_nombre
FROM comprobantes c
LEFT JOIN reservas r ON c.reserva_id = r.id
LEFT JOIN caja_turnos ct ON c.turno_caja_id = ct.id
LEFT JOIN usuarios u ON ct.usuario_id = u.id
LEFT JOIN series_comprobante sc ON c.serie = sc.serie AND c.tipo_comprobante = sc.tipo_comprobante
LEFT JOIN cajas ca ON sc.caja_id = ca.id
ORDER BY c.fecha_emision DESC;

COMMENT ON VIEW vw_historial_comprobantes IS 'Historial completo de comprobantes con método de pago y trazabilidad';

-- Índices para optimizar consultas de métodos de pago
CREATE INDEX IF NOT EXISTS idx_pagos_metodo ON pagos(metodo_pago);
CREATE INDEX IF NOT EXISTS idx_pagos_turno_metodo ON pagos(caja_turno_id, metodo_pago);

-- =============================================
-- ÍNDICES PARCIALES (SOFT DELETE - Solo registros activos)
-- =============================================

-- Huéspedes activos (para búsquedas frecuentes)
CREATE INDEX IF NOT EXISTS idx_huespedes_activos 
ON public.huespedes(id) 
WHERE deleted_at IS NULL;

-- Reservas activas
CREATE INDEX IF NOT EXISTS idx_reservas_activas 
ON public.reservas(id) 
WHERE deleted_at IS NULL;

-- Habitaciones activas
CREATE INDEX IF NOT EXISTS idx_habitaciones_activas 
ON public.habitaciones(id) 
WHERE deleted_at IS NULL;

-- =============================================
-- ÍNDICES DE FECHAS PARA REPORTES
-- =============================================

-- Reservas por período de entrada (reportes de ocupación)
CREATE INDEX IF NOT EXISTS idx_reservas_periodo_entrada 
ON public.reservas(fecha_entrada DESC, fecha_salida);

-- Reservas por fecha de creación (reportes de ventas)
CREATE INDEX IF NOT EXISTS idx_reservas_periodo_creacion 
ON public.reservas(created_at DESC);

-- Comprobantes por fecha (reportes contables mensuales)
CREATE INDEX IF NOT EXISTS idx_comprobantes_periodo_mes 
ON public.comprobantes(fecha_emision DESC, tipo_comprobante);

-- Pagos por fecha (cuadres de caja)
CREATE INDEX IF NOT EXISTS idx_pagos_periodo_fecha 
ON public.pagos(fecha_pago DESC);

-- Movimientos de caja por fecha
CREATE INDEX IF NOT EXISTS idx_movimientos_periodo 
ON public.caja_movimientos(created_at DESC);

-- Ticket de anulación SUNAT (para consultas de estado)
CREATE INDEX IF NOT EXISTS idx_comprobantes_ticket_anulacion 
ON public.comprobantes(sunat_ticket_anulacion) 
WHERE sunat_ticket_anulacion IS NOT NULL;

-- =============================================
-- VISTAS SOFT DELETE (Filtran registros eliminados)
-- =============================================

-- Vista de huéspedes activos
CREATE OR REPLACE VIEW public.vw_huespedes_activos AS
SELECT *
FROM public.huespedes
WHERE deleted_at IS NULL;

-- Vista de reservas activas (excluyendo soft delete)
CREATE OR REPLACE VIEW public.vw_reservas_activas AS
SELECT r.*, 
       h.numero as habitacion_numero,
       h.piso as habitacion_piso
FROM public.reservas r
LEFT JOIN public.habitaciones h ON r.habitacion_id = h.id
WHERE r.deleted_at IS NULL;

-- =============================================
-- FUNCIÓN HELPER PARA SOFT DELETE
-- =============================================

CREATE OR REPLACE FUNCTION soft_delete(
    p_tabla text,
    p_id uuid
) RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
    EXECUTE format('UPDATE public.%I SET deleted_at = now() WHERE id = %L AND deleted_at IS NULL', p_tabla, p_id);
    RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION soft_delete IS 
'Marca un registro como eliminado sin borrarlo físicamente. 
Uso: SELECT soft_delete(''huespedes'', ''uuid-del-huesped'')';

-- =============================================
-- FUNCIÓN CHECK-IN ATÓMICO (Walk-in o Reserva)
-- =============================================

CREATE OR REPLACE FUNCTION realizar_checkin_atomico(
    p_habitacion_id UUID,
    p_fecha_entrada TIMESTAMP WITH TIME ZONE,
    p_fecha_salida TIMESTAMP WITH TIME ZONE,
    p_precio_pactado DECIMAL,
    p_huespedes JSONB, -- Array de objetos: { nro_doc, tipo_doc, nombres, apellidos, nacionalidad, ... }
    p_reserva_id UUID DEFAULT NULL, -- Si es NULL, se crea una nueva (Walk-in). Si existe, se actualiza.
    p_moneda_pactada public.moneda_enum DEFAULT 'PEN',
    p_canal_venta_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reserva_id UUID;
    v_huesped_id UUID;
    v_habitacion RECORD;
    v_huesped RECORD;
    v_codigo_reserva TEXT;
    v_titular_encontrado BOOLEAN := FALSE;
    huesped_item JSONB;
BEGIN
    -- 1. Validar Estado de la Habitación (Bloqueo pesimista)
    SELECT * INTO v_habitacion 
    FROM habitaciones 
    WHERE id = p_habitacion_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Habitación no encontrada');
    END IF;

    -- Si es una reserva NUEVA (Walk-in), la habitación debe estar LIBRE
    IF p_reserva_id IS NULL THEN
        IF v_habitacion.estado_ocupacion != 'LIBRE' THEN
            RETURN jsonb_build_object('success', false, 'error', 'La habitación no está disponible (Ocupada)');
        END IF;
    END IF;

    IF v_habitacion.estado_servicio != 'OPERATIVA' THEN
        RETURN jsonb_build_object('success', false, 'error', 'La habitación no está operativa');
    END IF;

    IF v_habitacion.estado_limpieza != 'LIMPIA' THEN
        RETURN jsonb_build_object('success', false, 'error', 'La habitación requiere limpieza antes del check-in');
    END IF;

    -- 2. Gestionar la Reserva
    IF p_reserva_id IS NOT NULL THEN
        UPDATE reservas 
        SET 
            estado = 'CHECKED_IN',
            check_in_real = NOW(),
            huesped_presente = TRUE,
            updated_at = NOW()
        WHERE id = p_reserva_id
        RETURNING id INTO v_reserva_id;
        
        IF NOT FOUND THEN
             RETURN jsonb_build_object('success', false, 'error', 'Reserva no encontrada');
        END IF;
    ELSE
        v_codigo_reserva := 'RSV-' || to_char(NOW(), 'YYMMDD') || '-' || substring(md5(random()::text) from 1 for 4);
        
        INSERT INTO reservas (
            codigo_reserva,
            habitacion_id,
            fecha_entrada,
            fecha_salida,
            precio_pactado,
            moneda_pactada,
            canal_venta_id,
            estado,
            check_in_real,
            huesped_presente
        ) VALUES (
            upper(v_codigo_reserva),
            p_habitacion_id,
            p_fecha_entrada,
            p_fecha_salida,
            p_precio_pactado,
            p_moneda_pactada,
            p_canal_venta_id,
            'CHECKED_IN',
            NOW(),
            TRUE
        ) RETURNING id INTO v_reserva_id;
    END IF;

    -- 3. Procesar Huéspedes (Upsert + Vinculación)
    DELETE FROM reserva_huespedes WHERE reserva_id = v_reserva_id;

    FOR huesped_item IN SELECT * FROM jsonb_array_elements(p_huespedes)
    LOOP
        SELECT id INTO v_huesped_id 
        FROM huespedes 
        WHERE tipo_documento = huesped_item->>'tipo_documento' 
        AND numero_documento = huesped_item->>'numero_documento';

        IF v_huesped_id IS NOT NULL THEN
            UPDATE huespedes SET
                nombres = COALESCE(huesped_item->>'nombres', nombres),
                apellidos = COALESCE(huesped_item->>'apellidos', apellidos),
                nacionalidad = COALESCE(huesped_item->>'nacionalidad', nacionalidad),
                correo = COALESCE(huesped_item->>'correo', correo),
                telefono = COALESCE(huesped_item->>'telefono', telefono)
            WHERE id = v_huesped_id;
        ELSE
            INSERT INTO huespedes (
                tipo_documento,
                numero_documento,
                nombres,
                apellidos,
                nacionalidad,
                correo,
                telefono
            ) VALUES (
                huesped_item->>'tipo_documento',
                huesped_item->>'numero_documento',
                huesped_item->>'nombres',
                huesped_item->>'apellidos',
                COALESCE(huesped_item->>'nacionalidad', 'PE'),
                huesped_item->>'correo',
                huesped_item->>'telefono'
            ) RETURNING id INTO v_huesped_id;
        END IF;

        INSERT INTO reserva_huespedes (
            reserva_id,
            huesped_id,
            es_titular
        ) VALUES (
            v_reserva_id,
            v_huesped_id,
            (huesped_item->>'es_titular')::boolean
        );

        IF (huesped_item->>'es_titular')::boolean THEN
            v_titular_encontrado := TRUE;
        END IF;
    END LOOP;

    IF NOT v_titular_encontrado THEN
        RAISE NOTICE 'No se especificó titular explícito';
    END IF;

    -- 4. Actualizar Estado de la Habitación
    UPDATE habitaciones 
    SET 
        estado_ocupacion = 'OCUPADA',
        estado_limpieza = 'LIMPIA'
    WHERE id = p_habitacion_id;

    RETURN jsonb_build_object(
        'success', true, 
        'reserva_id', v_reserva_id,
        'message', 'Check-in realizado correctamente'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false, 
        'error', SQLERRM,
        'code', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION realizar_checkin_atomico IS 
'Check-in atómico que crea/actualiza reserva, gestiona huéspedes y actualiza habitación en una transacción ACID.
Evita condiciones de carrera usando bloqueo pesimista (FOR UPDATE).';

-- =============================================
-- FUNCIÓN CONFIRMAR CHECK-IN (Solo transición de estados)
-- =============================================

CREATE OR REPLACE FUNCTION confirmar_checkin_reserva(
    p_reserva_id UUID,
    p_usuario_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reserva RECORD;
    v_habitacion_id UUID;
    v_estado_actual_hab public.estado_ocupacion_enum;
    v_estado_servicio_hab public.estado_servicio_enum;
    v_estado_limpieza_hab public.estado_limpieza_enum;
BEGIN
    -- 1. Validar Reserva y obtener ID de habitación
    SELECT * INTO v_reserva
    FROM reservas 
    WHERE id = p_reserva_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reserva no encontrada');
    END IF;

    IF v_reserva.estado != 'RESERVADA' THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'La reserva no está en estado RESERVADA (Estado actual: ' || v_reserva.estado || ')'
        );
    END IF;

    v_habitacion_id := v_reserva.habitacion_id;

    -- 2. Validar Habitación
    SELECT 
        estado_ocupacion, estado_servicio, estado_limpieza 
    INTO 
        v_estado_actual_hab, v_estado_servicio_hab, v_estado_limpieza_hab
    FROM habitaciones 
    WHERE id = v_habitacion_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Habitación asociada no encontrada');
    END IF;

    IF v_estado_servicio_hab != 'OPERATIVA' THEN
        RETURN jsonb_build_object('success', false, 'error', 'La habitación no está operativa');
    END IF;

    IF v_estado_limpieza_hab != 'LIMPIA' THEN
        RETURN jsonb_build_object('success', false, 'error', 'La habitación debe estar LIMPIA para el check-in');
    END IF;

    IF v_estado_actual_hab = 'OCUPADA' THEN
        RETURN jsonb_build_object('success', false, 'error', 'La habitación ya está ocupada por otra reserva');
    END IF;

    -- 3. Ejecutar Transición Atómica
    UPDATE reservas 
    SET 
        estado = 'CHECKED_IN',
        check_in_real = NOW(),
        huesped_presente = TRUE,
        updated_at = NOW()
    WHERE id = p_reserva_id;

    UPDATE habitaciones 
    SET 
        estado_ocupacion = 'OCUPADA',
        estado_limpieza = 'LIMPIA'
    WHERE id = v_habitacion_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Check-in confirmado exitosamente'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false, 
        'error', SQLERRM,
        'code', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION confirmar_checkin_reserva IS 
'Confirma check-in de una reserva existente con validaciones de habitación.
Solo maneja transición de estados (reserva + habitación). No modifica huéspedes.';

-- Comentarios de documentación para soft delete
COMMENT ON COLUMN public.huespedes.deleted_at IS 
'Timestamp de eliminación lógica. NULL = activo, timestamp = eliminado.';

COMMENT ON COLUMN public.reservas.deleted_at IS 
'Timestamp de eliminación lógica. Para auditoría SUNAT se mantiene historial.';

COMMENT ON COLUMN public.habitaciones.deleted_at IS 
'Timestamp de eliminación lógica. Habitaciones que ya no existen.';

COMMENT ON COLUMN public.comprobantes.sunat_ticket_anulacion IS 
'Ticket de SUNAT para consultar estado de comunicación de baja (anulación asíncrona)';

COMMENT ON COLUMN public.comprobantes.fecha_solicitud_anulacion IS 
'Timestamp de cuando se solicitó la anulación vía comunicación de baja';


-- =============================================
-- 8. PERMISOS (CRÍTICO)
-- =============================================

-- Dar todos los permisos al rol authenticated
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Dar todos los permisos al service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Permisos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, service_role;

-- =============================================
-- 9. DESHABILITAR RLS EN TODAS LAS TABLAS
-- =============================================
-- ⚠️ IMPORTANTE: Para sistema interno de hotel, no usar RLS
-- El control de acceso se maneja en Server Actions de Next.js

ALTER TABLE public.usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_configuracion DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cajas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.series_comprobante DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.caja_turnos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.caja_movimientos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_habitacion DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_habitacion DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.canales_venta DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarifas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.habitaciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.huespedes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserva_huespedes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.comprobantes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.comprobante_detalles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos DISABLE ROW LEVEL SECURITY;

-- =============================================
-- 10. DATOS INICIALES (OPCIONAL)
-- =============================================

-- Insertar usuario administrador (ajusta el UUID a tu usuario real de auth.users)
-- Para obtener tu UUID: SELECT id FROM auth.users WHERE email = 'tu-email@ejemplo.com';
INSERT INTO public.usuarios (id, rol, nombres, apellidos, estado)
VALUES (
  '0930db09-44f0-4f3b-bc74-1209bbbe7b32',
  'ADMIN',
  'Administrador',
  'Sistema',
  true
)
ON CONFLICT (id) DO UPDATE SET rol = 'ADMIN', estado = true;

-- =============================================
-- 10. CONFIRMACIÓN
-- =============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '✅ SCHEMA CONSOLIDADO CREADO CORRECTAMENTE';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📊 CARACTERÍSTICAS DEL SCHEMA:';
    RAISE NOTICE '   ✓ Arquitectura alineada con documento de requerimientos v2.1';
    RAISE NOTICE '   ✓ Soft Delete: deleted_at en tablas clave para historial';
    RAISE NOTICE '   ✓ Anulaciones SUNAT: Campos para seguimiento asíncrono';
    RAISE NOTICE '   ✓ Check-in Atómico: Funciones PL/pgSQL con bloqueo pesimista';
    RAISE NOTICE '   ✓ Índices optimizados para reportes y búsquedas';
    RAISE NOTICE '   ✓ Vistas con filtro de soft delete';
    RAISE NOTICE '   ✓ Triggers de protección fiscal activos';
    RAISE NOTICE '   ✓ Realtime habilitado para habitaciones, reservas y caja_turnos';
    RAISE NOTICE '';
    RAISE NOTICE '📦 FUNCIONES DISPONIBLES:';
    RAISE NOTICE '   • realizar_checkin_atomico() - Check-in walk-in o reserva';
    RAISE NOTICE '   • confirmar_checkin_reserva() - Check-in de reserva existente';
    RAISE NOTICE '   • insertar_comprobante_atomico() - Inserción atómica de comprobantes';
    RAISE NOTICE '   • soft_delete(tabla, id) - Eliminación lógica genérica';
    RAISE NOTICE '';
    RAISE NOTICE '📚 Referencia: DOCUMENTO_DE_REQUERIMIENTOS_DEL_SISTEMA_PMS.md';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
END $$;

-- =============================================
-- HABILITAR REALTIME PARA TABLAS CRÍTICAS
-- =============================================
-- Supabase Realtime requiere que las tablas estén en la publicación
-- para poder escuchar cambios en tiempo real.

ALTER PUBLICATION supabase_realtime ADD TABLE habitaciones;
ALTER PUBLICATION supabase_realtime ADD TABLE reservas;
ALTER PUBLICATION supabase_realtime ADD TABLE caja_turnos;

-- Habilitar replica identity FULL para obtener datos completos en DELETE
ALTER TABLE habitaciones REPLICA IDENTITY FULL;
ALTER TABLE reservas REPLICA IDENTITY FULL;

-- =============================================
-- FUNCIÓN: insertar_comprobante_atomico
-- =============================================
-- Esta función garantiza atomicidad en la inserción de comprobantes:
-- El correlativo SOLO se incrementa si el INSERT es exitoso.
-- Si hay cualquier error, el correlativo no se consume.

CREATE OR REPLACE FUNCTION insertar_comprobante_atomico(
  p_serie TEXT,
  p_tipo_comprobante TEXT,
  p_turno_caja_id UUID,
  p_reserva_id UUID,
  p_receptor_tipo_doc TEXT,
  p_receptor_nro_doc TEXT,
  p_receptor_razon_social TEXT,
  p_receptor_direccion TEXT,
  p_moneda TEXT,
  p_tipo_cambio DECIMAL,
  p_op_gravadas DECIMAL,
  p_op_exoneradas DECIMAL,
  p_monto_igv DECIMAL,
  p_total_venta DECIMAL,
  p_nota_credito_ref_id UUID DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  serie TEXT,
  numero INTEGER,
  numero_completo TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_correlativo INTEGER;
  v_serie_id UUID;
  v_nuevo_id UUID;
BEGIN
  -- 1. Obtener y bloquear la serie (FOR UPDATE garantiza exclusividad)
  SELECT sc.id, sc.correlativo_actual + 1
  INTO v_serie_id, v_correlativo
  FROM series_comprobante sc
  WHERE sc.serie = p_serie
    AND sc.tipo_comprobante = p_tipo_comprobante::tipo_comprobante_enum
  FOR UPDATE;

  IF v_serie_id IS NULL THEN
    RAISE EXCEPTION 'Serie % del tipo % no encontrada', p_serie, p_tipo_comprobante;
  END IF;

  -- 2. Insertar comprobante (si falla, todo hace rollback incluyendo el FOR UPDATE)
  INSERT INTO comprobantes (
    turno_caja_id, reserva_id, tipo_comprobante, serie, numero,
    receptor_tipo_doc, receptor_nro_doc, receptor_razon_social, receptor_direccion,
    moneda, tipo_cambio, op_gravadas, op_exoneradas, op_inafectas,
    monto_igv, monto_icbper, total_venta,
    nota_credito_ref_id, estado_sunat, fecha_emision
  ) VALUES (
    p_turno_caja_id, 
    p_reserva_id, 
    p_tipo_comprobante::tipo_comprobante_enum,
    p_serie, 
    v_correlativo,
    p_receptor_tipo_doc, 
    p_receptor_nro_doc, 
    p_receptor_razon_social, 
    p_receptor_direccion,
    p_moneda::moneda_enum, 
    p_tipo_cambio, 
    p_op_gravadas, 
    p_op_exoneradas, 
    0, -- op_inafectas
    p_monto_igv, 
    0, -- monto_icbper
    p_total_venta,
    p_nota_credito_ref_id, 
    'PENDIENTE', 
    NOW()
  )
  RETURNING comprobantes.id INTO v_nuevo_id;

  -- 3. SOLO si el INSERT fue exitoso, actualizar correlativo
  UPDATE series_comprobante
  SET correlativo_actual = v_correlativo
  WHERE series_comprobante.id = v_serie_id;

  -- 4. Retornar datos del comprobante creado
  -- Usamos alias para evitar ambigüedad con parámetros
  RETURN QUERY SELECT 
    v_nuevo_id AS id,
    p_serie AS serie,
    v_correlativo AS numero,
    (p_serie || '-' || LPAD(v_correlativo::TEXT, 8, '0')) AS numero_completo;
END;
$$;

COMMENT ON FUNCTION insertar_comprobante_atomico IS 
  'Inserta un comprobante de forma atómica, garantizando que el correlativo solo se incremente si el INSERT es exitoso. Evita gaps en la numeración.';

SELECT '✅ SCHEMA CONSOLIDADO CREADO CORRECTAMENTE' AS resultado;
SELECT 'Total de tablas: ' || count(*)::text FROM information_schema.tables WHERE table_schema = 'public';

