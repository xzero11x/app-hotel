-- =========================
-- 1. TIPOS DE DATOS (ENUMS)
-- =========================

CREATE TYPE rol_usuario AS ENUM ('admin', 'recepcion', 'limpieza', 'contador');

CREATE TYPE estado_ocupacion AS ENUM ('DISPONIBLE', 'OCUPADA', 'MANTENIMIENTO');
CREATE TYPE estado_limpieza AS ENUM ('LIMPIA', 'SUCIA');
CREATE TYPE ubicacion_llave AS ENUM ('RECEPCION', 'CLIENTE');

CREATE TYPE estado_reserva AS ENUM ('PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'NOSHOW');
CREATE TYPE estado_estadia AS ENUM ('ACTIVA', 'FINALIZADA');

CREATE TYPE tipo_doc_identidad AS ENUM ('DNI', 'RUC', 'PASAPORTE', 'CARNET_EXT', 'OTROS');
CREATE TYPE tipo_comprobante AS ENUM ('BOLETA', 'FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO');
CREATE TYPE estado_sunat AS ENUM ('PENDIENTE', 'ENVIADO', 'ACEPTADO', 'RECHAZADO', 'ANULADO');

-- =========================
-- 2. CONFIGURACIÓN GLOBAL
-- =========================

CREATE TABLE configuracion_sistema (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ruc VARCHAR(11) NOT NULL,
    razon_social TEXT NOT NULL,
    nombre_comercial TEXT NOT NULL,
    direccion_fiscal TEXT NOT NULL,
    ubigeo VARCHAR(6) NOT NULL,
    logo_url TEXT,
    moneda_principal VARCHAR(3) DEFAULT 'PEN',
    tasa_igv DECIMAL(5,2) DEFAULT 18.00,
    tasa_recargo_consumo DECIMAL(5,2) DEFAULT 0.00,
    es_regimen_amazonia BOOLEAN DEFAULT false,
    nubefact_ruta TEXT,
    nubefact_token TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX only_one_config ON configuracion_sistema ((true));

-- =========================
-- 3. SERIES Y CORRELATIVOS (NUEVO)
-- =========================

CREATE TABLE series_comprobantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_comprobante tipo_comprobante NOT NULL,
    serie VARCHAR(4) NOT NULL, -- Ej: F001, B001
    correlativo_actual INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    UNIQUE (tipo_comprobante, serie)
);

-- Insertar series por defecto (OBLIGATORIO)
INSERT INTO series_comprobantes (tipo_comprobante, serie, correlativo_actual) VALUES 
('BOLETA', 'B001', 0),
('FACTURA', 'F001', 0),
('NOTA_CREDITO', 'BC01', 0), -- Para boletas
('NOTA_CREDITO', 'FC01', 0); -- Para facturas

-- Función Atómica para obtener el siguiente número (Seguro contra concurrencia)
CREATE OR REPLACE FUNCTION obtener_siguiente_correlativo(p_serie VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    nuevo_correlativo INTEGER;
BEGIN
    UPDATE series_comprobantes
    SET correlativo_actual = correlativo_actual + 1
    WHERE serie = p_serie
    RETURNING correlativo_actual INTO nuevo_correlativo;
    
    RETURN nuevo_correlativo;
END;
$$ LANGUAGE plpgsql;

-- =========================
-- 4. USUARIOS (CORREGIDO)
-- =========================

CREATE TABLE usuarios (
    -- Vinculación directa con Supabase Auth
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, 
    email TEXT UNIQUE NOT NULL,
    nombre_completo TEXT NOT NULL,
    rol rol_usuario DEFAULT 'recepcion',
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- 5. INVENTARIO
-- =========================

CREATE TABLE categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    capacidad_max INTEGER NOT NULL,
    descripcion TEXT
);

CREATE TABLE tarifas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria_id UUID REFERENCES categorias(id),
    nombre TEXT NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    activa BOOLEAN DEFAULT true
);

CREATE TABLE habitaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero TEXT UNIQUE NOT NULL,
    piso INTEGER NOT NULL,
    categoria_id UUID REFERENCES categorias(id),
    estado_ocupacion estado_ocupacion DEFAULT 'DISPONIBLE',
    estado_limpieza estado_limpieza DEFAULT 'LIMPIA',
    notas_mantenimiento TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- 6. HUÉSPEDES Y OPERACIONES
-- =========================

CREATE TABLE huespedes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_doc tipo_doc_identidad DEFAULT 'DNI',
    num_doc TEXT UNIQUE NOT NULL,
    nombres TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    razon_social TEXT,
    ciudad_procedencia TEXT,
    nacionalidad TEXT DEFAULT 'Peruana',
    email TEXT,
    telefono TEXT,
    es_frecuente BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reservas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    habitacion_id UUID REFERENCES habitaciones(id),
    huesped_titular_id UUID REFERENCES huespedes(id),
    fecha_llegada DATE NOT NULL,
    fecha_salida DATE NOT NULL,
    origen TEXT DEFAULT 'WHATSAPP',
    precio_pactado_total DECIMAL(10,2),
    adelanto_pagado DECIMAL(10,2) DEFAULT 0,
    estado estado_reserva DEFAULT 'CONFIRMADA',
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE estadias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reserva_id UUID REFERENCES reservas(id),
    habitacion_id UUID REFERENCES habitaciones(id),
    huesped_principal_id UUID REFERENCES huespedes(id),
    tarifa_id UUID REFERENCES tarifas(id),
    fecha_ingreso TIMESTAMPTZ DEFAULT now(),
    fecha_salida_prevista TIMESTAMPTZ NOT NULL,
    fecha_salida_real TIMESTAMPTZ,
    precio_noche_final DECIMAL(10,2) NOT NULL,
    num_huespedes INTEGER DEFAULT 1,
    estado estado_estadia DEFAULT 'ACTIVA',
    ubicacion_llave ubicacion_llave DEFAULT 'CLIENTE',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE estadia_huespedes (
    estadia_id UUID REFERENCES estadias(id),
    huesped_id UUID REFERENCES huespedes(id),
    es_titular BOOLEAN DEFAULT false,
    PRIMARY KEY (estadia_id, huesped_id)
);

-- =========================
-- 7. CAJA Y PAGOS (CORREGIDO)
-- =========================

CREATE TABLE turnos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES usuarios(id),
    inicio TIMESTAMPTZ DEFAULT now(),
    fin TIMESTAMPTZ,
    monto_inicial DECIMAL(10,2) NOT NULL,
    monto_final_real DECIMAL(10,2),
    estado TEXT DEFAULT 'ABIERTO'
);

CREATE TABLE pagos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estadia_id UUID REFERENCES estadias(id),
    turno_id UUID REFERENCES turnos(id),
    
    -- Corrección Moneda
    moneda VARCHAR(3) DEFAULT 'PEN', -- PEN, USD
    tipo_cambio DECIMAL(5,3) DEFAULT 1.000,
    monto DECIMAL(10,2) NOT NULL, -- Monto en la moneda original
    
    metodo_pago TEXT NOT NULL,
    nro_operacion TEXT,
    fecha_pago TIMESTAMPTZ DEFAULT now(),
    notas TEXT
);

-- =========================
-- 8. FACTURACIÓN ELECTRÓNICA (CORREGIDO)
-- =========================

CREATE TABLE comprobantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estadia_id UUID REFERENCES estadias(id),
    tipo tipo_comprobante NOT NULL,
    serie VARCHAR(4) NOT NULL,
    correlativo INTEGER NOT NULL,
    fecha_emision TIMESTAMPTZ DEFAULT now(),
    cliente_num_doc TEXT NOT NULL,
    cliente_nombre TEXT NOT NULL,
    cliente_direccion TEXT,
    tasa_igv_aplicada DECIMAL(5,2) NOT NULL,
    tasa_rc_aplicada DECIMAL(5,2) DEFAULT 0,
    total_gravado DECIMAL(12,2) DEFAULT 0,
    total_exonerado DECIMAL(12,2) DEFAULT 0,
    total_igv DECIMAL(12,2) DEFAULT 0,
    total_recargo_consumo DECIMAL(12,2) DEFAULT 0,
    total_venta DECIMAL(12,2) NOT NULL,
    sunat_estado estado_sunat DEFAULT 'PENDIENTE',
    enlace_pdf TEXT,
    enlace_xml TEXT,
    nubefact_error TEXT,
    documento_ref_id UUID REFERENCES comprobantes(id),
    motivo_anulacion TEXT,
    created_by UUID REFERENCES usuarios(id),
    
    -- Restricción Legal SUNAT (Nuevo)
    CONSTRAINT unique_comprobante UNIQUE (tipo, serie, correlativo)
);

CREATE TABLE comprobante_detalles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comprobante_id UUID REFERENCES comprobantes(id) ON DELETE CASCADE,
    descripcion TEXT NOT NULL,
    cantidad INTEGER DEFAULT 1,
    valor_unitario DECIMAL(12,2) NOT NULL,
    precio_unitario DECIMAL(12,2) NOT NULL,
    codigo_afectacion_igv VARCHAR(10) NOT NULL,
    igv_linea DECIMAL(12,2),
    total_linea DECIMAL(12,2)
);

-- =========================
-- 9. AUDITORÍA
-- =========================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    operation TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION fn_audit_log() RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
BEGIN
    BEGIN
        current_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        current_user_id := NULL;
    END;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (table_name, record_id, operation, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW), current_user_id);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW IS DISTINCT FROM OLD THEN
            INSERT INTO audit_logs (table_name, record_id, operation, old_data, new_data, changed_by)
            VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), current_user_id);
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (table_name, record_id, operation, old_data, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD), current_user_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_reservas AFTER INSERT OR UPDATE OR DELETE ON reservas FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER audit_estadias AFTER INSERT OR UPDATE OR DELETE ON estadias FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER audit_pagos AFTER INSERT OR UPDATE OR DELETE ON pagos FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER audit_habitaciones AFTER INSERT OR UPDATE OR DELETE ON habitaciones FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER audit_comprobantes AFTER INSERT OR UPDATE OR DELETE ON comprobantes FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER audit_config AFTER INSERT OR UPDATE OR DELETE ON configuracion_sistema FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER audit_series AFTER INSERT OR UPDATE OR DELETE ON series_comprobantes FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- =========================
-- 10. ÍNDICES DE RENDIMIENTO
-- =========================

CREATE INDEX idx_habitaciones_categoria ON habitaciones(categoria_id);
CREATE INDEX idx_reservas_habitacion ON reservas(habitacion_id);
CREATE INDEX idx_reservas_huesped ON reservas(huesped_titular_id);
CREATE INDEX idx_estadias_habitacion ON estadias(habitacion_id);
CREATE INDEX idx_estadias_reserva ON estadias(reserva_id);
CREATE INDEX idx_pagos_estadia ON pagos(estadia_id);
CREATE INDEX idx_pagos_turno ON pagos(turno_id);
CREATE INDEX idx_comprobantes_estadia ON comprobantes(estadia_id);
CREATE INDEX idx_detalles_comprobante ON comprobante_detalles(comprobante_id);
CREATE INDEX idx_huespedes_doc ON huespedes(num_doc);
CREATE INDEX idx_comprobantes_fecha ON comprobantes(fecha_emision);
