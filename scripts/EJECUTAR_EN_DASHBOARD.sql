-- =============================================
-- SCHEMA COMPLETO + PERMISOS - VERSIÓN UNIFICADA
-- EJECUTAR ESTE ARCHIVO COMPLETO EN EL DASHBOARD DE SUPABASE
-- =============================================
-- IMPORTANTE: Este es el ÚNICO archivo que necesitas ejecutar
-- después de hacer DROP SCHEMA public CASCADE;
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
    proveedor_sunat_config jsonb,
    hora_checkin time DEFAULT '14:00:00',
    hora_checkout time DEFAULT '12:00:00',
    telefono text,
    email text,
    pagina_web text,
    logo_url text,
    descripcion text,
    updated_at timestamptz DEFAULT now()
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

-- TURNOS DE CAJA (MULTIMONEDA)
CREATE TABLE public.caja_turnos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    caja_id uuid REFERENCES public.cajas(id) NOT NULL,
    usuario_id uuid REFERENCES public.usuarios(id) NOT NULL,
    fecha_apertura timestamptz DEFAULT now(),
    fecha_cierre timestamptz,
    monto_apertura numeric(12,2) DEFAULT 0,
    monto_cierre_declarado numeric(12,2),
    monto_cierre_sistema numeric(12,2),
    monto_apertura_usd numeric(12,2) DEFAULT 0,
    monto_cierre_declarado_usd numeric(12,2) DEFAULT 0,
    monto_cierre_sistema_usd numeric(12,2) DEFAULT 0,
    estado text DEFAULT 'ABIERTA' CHECK (estado IN ('ABIERTA', 'CERRADA'))
);

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
    activo boolean DEFAULT true
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
    created_at timestamptz DEFAULT now()
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
    updated_at timestamptz DEFAULT now()
);

-- HUÉSPEDES
CREATE TABLE public.huespedes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombres text NOT NULL,
    apellidos text NOT NULL,
    tipo_documento text NOT NULL,
    numero_documento text NOT NULL,
    nacionalidad text,
    correo text,
    telefono text,
    fecha_nacimiento date,
    notas_internas text,
    es_frecuente boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
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
    total_estimado numeric(12,2) GENERATED ALWAYS AS (
        precio_pactado * (GREATEST(1, EXTRACT(DAY FROM (fecha_salida - fecha_entrada))))
    ) STORED,
    huesped_presente boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
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
    codigo_afectacion_igv text NOT NULL DEFAULT '10'
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
CREATE OR REPLACE FUNCTION obtener_siguiente_correlativo(p_serie text)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
    nuevo_correlativo bigint;
BEGIN
    UPDATE public.series_comprobante
    SET correlativo_actual = correlativo_actual + 1
    WHERE serie = p_serie
    RETURNING correlativo_actual INTO nuevo_correlativo;
    RETURN nuevo_correlativo;
END;
$$;

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Función para sincronizar estado de habitación con reserva
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
    
    IF NEW.estado = 'CHECKED_OUT' AND (OLD.estado IS DISTINCT FROM 'CHECKED_OUT') THEN
        UPDATE public.habitaciones
        SET estado_ocupacion = 'LIBRE', estado_limpieza = 'SUCIA'
        WHERE id = NEW.habitacion_id;
        NEW.huesped_presente := false;
        NEW.check_out_real := now();
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Función para validar check-in
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
CREATE TRIGGER update_usuarios_modtime BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_habitaciones_modtime BEFORE UPDATE ON public.habitaciones FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_reservas_modtime BEFORE UPDATE ON public.reservas FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_hotel_config_modtime BEFORE UPDATE ON public.hotel_configuracion FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER trg_gestion_estados_reserva BEFORE UPDATE ON public.reservas FOR EACH ROW EXECUTE PROCEDURE sincronizar_estado_habitacion();
CREATE TRIGGER trg_validar_checkin BEFORE UPDATE ON public.reservas FOR EACH ROW EXECUTE PROCEDURE validar_checkin_habitacion();


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

-- Vista de reservas con deuda (CRÍTICA PARA OCUPACIONES)
CREATE OR REPLACE VIEW public.vw_reservas_con_deuda AS
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
    
    -- Cálculos financieros
    r.precio_pactado * GREATEST(1, EXTRACT(DAY FROM (r.fecha_salida - r.fecha_entrada))::numeric) as total_estimado,
    COALESCE((SELECT SUM(p.monto) FROM public.pagos p WHERE p.reserva_id = r.id), 0) as total_pagado,
    (r.precio_pactado * GREATEST(1, EXTRACT(DAY FROM (r.fecha_salida - r.fecha_entrada))::numeric)) - 
    COALESCE((SELECT SUM(p.monto) FROM public.pagos p WHERE p.reserva_id = r.id), 0) as saldo_pendiente,
    
    -- Noches
    GREATEST(1, EXTRACT(DAY FROM (r.fecha_salida - r.fecha_entrada))::int) as total_noches,
    
    -- Metadata
    r.created_at,
    r.updated_at
FROM public.reservas r
JOIN public.habitaciones h ON r.habitacion_id = h.id
JOIN public.tipos_habitacion th ON h.tipo_id = th.id
LEFT JOIN public.reserva_huespedes rh ON r.id = rh.reserva_id AND rh.es_titular = true
LEFT JOIN public.huespedes hue ON rh.huesped_id = hue.id
WHERE r.estado IN ('RESERVADA', 'CHECKED_IN', 'CHECKED_OUT')
ORDER BY r.fecha_entrada DESC;



-- Vista de Historial de Facturación (Snapshot Reader con Contexto Inteligente)
CREATE OR REPLACE VIEW public.vw_historial_comprobantes AS
SELECT 
    c.id,
    c.fecha_emision,
    c.tipo_comprobante,
    c.serie,
    c.numero,
    c.serie || '-' || LPAD(c.numero::text, 8, '0') as numero_completo,
    
    -- DATOS SNAPSHOT (Lectura segura)
    c.receptor_razon_social as cliente_nombre,
    c.receptor_tipo_doc,
    c.receptor_nro_doc as cliente_doc,
    c.moneda,
    c.total_venta,
    c.estado_sunat,
    c.xml_url,
    c.cdr_url,
    
    -- CONTEXTO INTELIGENTE (Lógica Condicional)
    CASE 
        -- Caso A: Es una Nota de Crédito (anula otro comprobante)
        WHEN c.tipo_comprobante = 'NOTA_CREDITO' AND c.nota_credito_ref_id IS NOT NULL THEN
            'Anula a ' || (
                SELECT ref.serie || '-' || LPAD(ref.numero::text, 8, '0')
                FROM public.comprobantes ref
                WHERE ref.id = c.nota_credito_ref_id
            )
        -- Caso B: Es una venta normal con reserva
        WHEN c.reserva_id IS NOT NULL THEN
            'Hab ' || (
                SELECT h.numero 
                FROM public.reservas r
                JOIN public.habitaciones h ON r.habitacion_id = h.id
                WHERE r.id = c.reserva_id
            ) || ' (' || (
                SELECT 
                    CASE r.estado
                        WHEN 'RESERVADA' THEN 'Reservado'
                        WHEN 'CHECKED_IN' THEN 'Hospedado'
                        WHEN 'CHECKED_OUT' THEN 'Check-out'
                        ELSE r.estado::text
                    END
                FROM public.reservas r
                WHERE r.id = c.reserva_id
            ) || ')'
        -- Caso C: Comprobante sin contexto
        ELSE 'Sin contexto'
    END as contexto,
    
    -- IDs y datos de auditoría
    c.reserva_id,
    ct.usuario_id,
    u.nombres || ' ' || COALESCE(u.apellidos, '') as emisor_nombre,
    c.created_at
FROM public.comprobantes c
JOIN public.caja_turnos ct ON c.turno_caja_id = ct.id
JOIN public.usuarios u ON ct.usuario_id = u.id
ORDER BY c.fecha_emision DESC, c.numero DESC;


-- 2. Índices para búsqueda y joins rápidos
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

-- 4. Comentarios para documentación
COMMENT ON COLUMN public.huespedes.notas_internas IS 'Notas de recepción: alertas, preferencias, incidentes';
COMMENT ON COLUMN public.huespedes.es_frecuente IS 'Marcador VIP para clientes recurrentes (>= 3 visitas)';

-- Confirmación
SELECT '✅ Migración de Huéspedes completada (versión optimizada)' AS resultado;


-- =============================================
-- 7. PERMISOS (CRÍTICO)
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
-- 8. DESHABILITAR RLS EN TODAS LAS TABLAS
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
-- 9. DATOS INICIALES (OPCIONAL)
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
SELECT '✅ SCHEMA COMPLETO CREADO CORRECTAMENTE' AS resultado;
SELECT 'Total de tablas: ' || count(*)::text FROM information_schema.tables WHERE table_schema = 'public';
