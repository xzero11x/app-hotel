-- =============================================
-- REFACTORIZACIÓN DEL SCHEMA SEGÚN DOCUMENTO DE REQUERIMIENTOS
-- =============================================
-- Fecha: 2026-01-07
-- Referencia: DOCUMENTO_DE_REQUERIMIENTOS_DEL_SISTEMA_PMS.md v2.1
-- Análisis: docs/analisis-refactorizacion-schema.md
-- =============================================
-- 
-- ⚠️  NOTA IMPORTANTE:
-- Esta migración es OPCIONAL si estás empezando desde cero.
-- Si ejecutas 20260101022650_initial_schema.sql (versión actualizada),
-- ya incluye todos estos cambios.
-- 
-- Solo ejecuta este archivo si:
-- - Ya tienes una BD existente con el schema inicial viejo
-- - Necesitas actualizar una BD en producción
-- 
-- =============================================

-- Este archivo implementa los cambios identificados en el análisis para
-- alinear el schema de la BD con la filosofía arquitectónica del documento:
--
-- "La Base de Datos debe ser el guardián de la INTEGRIDAD,
--  pero el Backend debe ser el dueño de la LÓGICA DE NEGOCIO"

-- =============================================
-- PARTE 1: ELIMINAR TRIGGERS DE LÓGICA DE NEGOCIO
-- =============================================

-- 1.1 Eliminar trigger de sincronización automática de estados
-- Razón: Lógica de negocio debe ser explícita en backend (doc 6.3.1)
DROP TRIGGER IF EXISTS trg_gestion_estados_reserva ON public.reservas;
DROP FUNCTION IF EXISTS sincronizar_estado_habitacion();

-- 1.2 Eliminar trigger de validación de check-in
-- Razón: Validaciones con mensajes amigables deben estar en backend (doc 6.3.1)
DROP TRIGGER IF EXISTS trg_validar_checkin ON public.reservas;
DROP FUNCTION IF EXISTS validar_checkin_habitacion();

-- Confirmación
DO $$
BEGIN
    RAISE NOTICE '✅ PASO 1: Triggers de lógica de negocio eliminados correctamente';
    RAISE NOTICE '   - sincronizar_estado_habitacion() → movido a lib/actions/checkin.ts';
    RAISE NOTICE '   - validar_checkin_habitacion() → movido a lib/actions/checkin.ts';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANTE: Asegúrate de que lib/actions/checkin.ts y checkout.ts';
    RAISE NOTICE '   implementen la lógica de cambio de estados EXPLÍCITAMENTE';
END $$;

-- =============================================
-- PARTE 2: ELIMINAR CAMPO CALCULATED INNECESARIO
-- =============================================

-- 2.1 Eliminar campo total_estimado GENERATED
-- Razón: Cálculos deben estar en backend (doc 6.2.2)
ALTER TABLE public.reservas 
DROP COLUMN IF EXISTS total_estimado;

-- Confirmación
DO $$
BEGIN
    RAISE NOTICE '✅ PASO 2: Campo total_estimado eliminado de tabla reservas';
    RAISE NOTICE '   El backend calculará este valor con:';
    RAISE NOTICE '   total_estimado = precio_pactado * Math.max(1, dias_estadia)';
    RAISE NOTICE '';
END $$;

-- =============================================
-- PARTE 3: AGREGAR CONSTRAINT FALTANTE
-- =============================================

-- 3.1 Agregar CHECK constraint en tabla tarifas
-- Razón: Garantizar integridad de datos (doc 3.2.4)
ALTER TABLE public.tarifas 
ADD CONSTRAINT check_precio_minimo_valido 
CHECK (precio_minimo <= precio_base);

-- Confirmación
DO $$
BEGIN
    RAISE NOTICE '✅ PASO 3: CHECK constraint agregado en tabla tarifas';
    RAISE NOTICE '   Ahora es imposible crear tarifas con precio_minimo > precio_base';
    RAISE NOTICE '';
END $$;

-- =============================================
-- PARTE 4: SIMPLIFICAR VISTAS COMPLEJAS
-- =============================================

-- 4.1 Reemplazar vw_reservas_con_deuda con versión simplificada
-- Razón: Eliminar subconsultas correlacionadas O(n²) y mover cálculos a backend (doc 4.5)

DROP VIEW IF EXISTS public.vw_reservas_con_deuda;

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

-- Confirmación
DO $$
BEGIN
    RAISE NOTICE '✅ PASO 4: Vista vw_reservas_con_deuda simplificada';
    RAISE NOTICE '   Nueva vista: vw_reservas_con_datos_basicos';
    RAISE NOTICE '   - Sin subconsultas correlacionadas';
    RAISE NOTICE '   - Cálculos de total_estimado, total_pagado y saldo_pendiente';
    RAISE NOTICE '     ahora se hacen en lib/actions/ocupaciones.ts';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANTE: Actualizar lib/actions/ocupaciones.ts para calcular:';
    RAISE NOTICE '   - total_estimado = precio_pactado * dias';
    RAISE NOTICE '   - total_pagado = SUM(pagos) en backend';
    RAISE NOTICE '   - saldo_pendiente = total_estimado - total_pagado';
    RAISE NOTICE '';
END $$;

-- 4.2 Simplificar vw_historial_comprobantes
-- Razón: Eliminar lógica de presentación y formateo (doc 4.5)

DROP VIEW IF EXISTS public.vw_historial_comprobantes;

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
    
    -- Metadata
    c.created_at
    
FROM public.comprobantes c
JOIN public.caja_turnos ct ON c.turno_caja_id = ct.id
JOIN public.usuarios u ON ct.usuario_id = u.id
ORDER BY c.fecha_emision DESC, c.numero DESC;

-- Confirmación
DO $$
BEGIN
    RAISE NOTICE '✅ PASO 4.2: Vista vw_historial_comprobantes simplificada';
    RAISE NOTICE '   - Eliminadas subconsultas de formateo de contexto';
    RAISE NOTICE '   - Textos hardcodeados ("Anula a", "Hab") movidos a frontend';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANTE: Actualizar components/facturacion/historial-table.tsx';
    RAISE NOTICE '   para formatear el contexto en frontend/backend según necesidad';
    RAISE NOTICE '';
END $$;

-- =============================================
-- PARTE 5: AGREGAR ÍNDICES FALTANTES
-- =============================================

-- 5.1 Índice para búsqueda de reservas por código (query muy frecuente)
CREATE INDEX IF NOT EXISTS idx_reservas_codigo 
ON public.reservas(codigo_reserva);

-- 5.2 Índice para filtrar reservas por estado (dashboard)
CREATE INDEX IF NOT EXISTS idx_reservas_estado 
ON public.reservas(estado);

-- 5.3 Índice para filtrar reservas por fecha de entrada (llegadas del día)
CREATE INDEX IF NOT EXISTS idx_reservas_fecha_entrada 
ON public.reservas(fecha_entrada);

-- 5.4 Índice para historial de comprobantes por fecha (reportes mensuales)
CREATE INDEX IF NOT EXISTS idx_comprobantes_fecha_emision 
ON public.comprobantes(fecha_emision DESC);

-- 5.5 Índice para historial de turnos por usuario
CREATE INDEX IF NOT EXISTS idx_caja_turnos_usuario 
ON public.caja_turnos(usuario_id);

-- 5.6 Índice para suma de pagos por reserva (cálculo de deuda)
CREATE INDEX IF NOT EXISTS idx_pagos_reserva 
ON public.pagos(reserva_id);

-- 5.7 Índice compuesto para reservas activas por habitación
CREATE INDEX IF NOT EXISTS idx_reservas_habitacion_estado
ON public.reservas(habitacion_id, estado);

-- Confirmación
DO $$
BEGIN
    RAISE NOTICE '✅ PASO 5: Índices agregados correctamente';
    RAISE NOTICE '   Performance esperada:';
    RAISE NOTICE '   - Búsqueda de reserva: < 1 segundo (doc 7.1)';
    RAISE NOTICE '   - Historial de facturación: < 2 segundos (doc 7.1)';
    RAISE NOTICE '   - Dashboard de habitaciones: < 2 segundos (doc 7.1)';
    RAISE NOTICE '';
END $$;

-- =============================================
-- PARTE 6: ACTUALIZAR COMENTARIOS DE DOCUMENTACIÓN
-- =============================================

-- Documentar cambios arquitectónicos en la BD
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
-- PARTE 7: VERIFICACIONES FINALES
-- =============================================

-- 7.1 Verificar que triggers críticos siguen activos
DO $$
DECLARE
    trigger_count INTEGER;
BEGIN
    -- Verificar que proteger_comprobante_inmutable sigue activo
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger
    WHERE tgname = 'trg_blindaje_fiscal';
    
    IF trigger_count = 0 THEN
        RAISE EXCEPTION '❌ ERROR: Trigger trg_blindaje_fiscal no encontrado (debe estar activo)';
    ELSE
        RAISE NOTICE '✅ Verificación: Trigger trg_blindaje_fiscal activo';
    END IF;
    
    -- Verificar que obtener_siguiente_correlativo existe
    SELECT COUNT(*) INTO trigger_count
    FROM pg_proc
    WHERE proname = 'obtener_siguiente_correlativo';
    
    IF trigger_count = 0 THEN
        RAISE EXCEPTION '❌ ERROR: Función obtener_siguiente_correlativo no encontrada (debe existir)';
    ELSE
        RAISE NOTICE '✅ Verificación: Función obtener_siguiente_correlativo existe';
    END IF;
END $$;

-- 7.2 Verificar que constraint fue agregado
DO $$
DECLARE
    constraint_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO constraint_count
    FROM pg_constraint
    WHERE conname = 'check_precio_minimo_valido';
    
    IF constraint_count = 0 THEN
        RAISE EXCEPTION '❌ ERROR: Constraint check_precio_minimo_valido no fue creado';
    ELSE
        RAISE NOTICE '✅ Verificación: Constraint check_precio_minimo_valido activo';
    END IF;
END $$;

-- 7.3 Verificar que vistas existen
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_views WHERE viewname = 'vw_reservas_con_datos_basicos'
    ) THEN
        RAISE EXCEPTION '❌ ERROR: Vista vw_reservas_con_datos_basicos no fue creada';
    ELSE
        RAISE NOTICE '✅ Verificación: Vista vw_reservas_con_datos_basicos creada';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_views WHERE viewname = 'vw_historial_comprobantes'
    ) THEN
        RAISE EXCEPTION '❌ ERROR: Vista vw_historial_comprobantes no fue creada';
    ELSE
        RAISE NOTICE '✅ Verificación: Vista vw_historial_comprobantes creada';
    END IF;
END $$;

-- 7.4 Verificar índices
DO $$
DECLARE
    indices_creados INTEGER;
BEGIN
    SELECT COUNT(*) INTO indices_creados
    FROM pg_indexes
    WHERE indexname IN (
        'idx_reservas_codigo',
        'idx_reservas_estado',
        'idx_reservas_fecha_entrada',
        'idx_comprobantes_fecha_emision',
        'idx_caja_turnos_usuario',
        'idx_pagos_reserva',
        'idx_reservas_habitacion_estado'
    );
    
    IF indices_creados < 7 THEN
        RAISE WARNING '⚠️  ADVERTENCIA: Solo % de 7 índices fueron creados', indices_creados;
    ELSE
        RAISE NOTICE '✅ Verificación: Todos los índices (7/7) creados correctamente';
    END IF;
END $$;

-- =============================================
-- CONFIRMACIÓN FINAL
-- =============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '✅ MIGRACIÓN COMPLETADA EXITOSAMENTE';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📊 RESUMEN DE CAMBIOS:';
    RAISE NOTICE '   ✓ Triggers eliminados: 2 (sincronizar_estado, validar_checkin)';
    RAISE NOTICE '   ✓ Triggers mantenidos: 2 (proteger_comprobante, update_timestamps)';
    RAISE NOTICE '   ✓ Campo eliminado: 1 (total_estimado GENERATED)';
    RAISE NOTICE '   ✓ Constraints agregados: 1 (check_precio_minimo_valido)';
    RAISE NOTICE '   ✓ Vistas simplificadas: 2 (reservas, comprobantes)';
    RAISE NOTICE '   ✓ Índices agregados: 7';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  ACCIÓN REQUERIDA EN CÓDIGO:';
    RAISE NOTICE '';
    RAISE NOTICE '1. lib/actions/checkin.ts';
    RAISE NOTICE '   - Implementar validaciones explícitas';
    RAISE NOTICE '   - Cambiar estados de habitación explícitamente';
    RAISE NOTICE '   - Manejar errores con códigos estructurados';
    RAISE NOTICE '';
    RAISE NOTICE '2. lib/actions/checkout.ts';
    RAISE NOTICE '   - Implementar cambio de estados explícito';
    RAISE NOTICE '   - Agregar logs de auditoría';
    RAISE NOTICE '';
    RAISE NOTICE '3. lib/actions/ocupaciones.ts';
    RAISE NOTICE '   - Cambiar de vw_reservas_con_deuda a vw_reservas_con_datos_basicos';
    RAISE NOTICE '   - Calcular total_estimado, total_pagado, saldo_pendiente en backend';
    RAISE NOTICE '';
    RAISE NOTICE '4. lib/actions/reservas.ts';
    RAISE NOTICE '   - Agregar función calcularTotalEstimado(reserva)';
    RAISE NOTICE '';
    RAISE NOTICE '5. components/facturacion/historial-table.tsx';
    RAISE NOTICE '   - Formatear contexto en frontend ("Anula a...", "Hab...")';
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '📚 Referencia: docs/analisis-refactorizacion-schema.md';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
END $$;
