-- =============================================
-- SEED DATA - Solo lo esencial
-- =============================================

-- =============================================
-- 1. CATEGORÍA (Solo Estándar)
-- =============================================
INSERT INTO public.categorias_habitacion (nombre, descripcion) VALUES
('Estándar', 'Habitación con servicios esenciales')
ON CONFLICT DO NOTHING;

-- =============================================
-- 2. TIPOS DE HABITACIÓN
-- =============================================
-- Capacidades según especificación:
-- Simple: 1p, Matrimonial: 2p, Doble: 3-4p, Triple: 3-5p
INSERT INTO public.tipos_habitacion (nombre, capacidad_personas) VALUES
('Simple', 1),
('Matrimonial', 2),
('Doble', 3),
('Doble 4P', 4),
('Triple', 3),
('Triple 5P', 5)
ON CONFLICT DO NOTHING;

-- =============================================
-- 3. TARIFAS BASE (Tipo + Categoría Estándar)
-- =============================================
-- Precios según especificación: (precio_base - precio_minimo)
INSERT INTO public.tarifas (
    tipo_habitacion_id,
    categoria_habitacion_id,
    nombre_tarifa,
    precio_base,
    precio_minimo,
    activa
)
SELECT 
    t.id,
    c.id,
    CONCAT('Tarifa Base - ', t.nombre),
    CASE 
        WHEN t.nombre = 'Simple' THEN 50.00
        WHEN t.nombre = 'Matrimonial' THEN 70.00
        WHEN t.nombre = 'Doble' THEN 90.00
        WHEN t.nombre = 'Doble 4P' THEN 100.00
        WHEN t.nombre = 'Triple' THEN 110.00
        WHEN t.nombre = 'Triple 5P' THEN 120.00
    END,
    CASE 
        WHEN t.nombre = 'Simple' THEN 30.00
        WHEN t.nombre = 'Matrimonial' THEN 50.00
        WHEN t.nombre = 'Doble' THEN 80.00
        WHEN t.nombre = 'Doble 4P' THEN 90.00
        WHEN t.nombre = 'Triple' THEN 100.00
        WHEN t.nombre = 'Triple 5P' THEN 110.00
    END,
    true
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE c.nombre = 'Estándar'
ON CONFLICT DO NOTHING;

-- =============================================
-- 4. HABITACIONES (12 habitaciones específicas)
-- =============================================

-- ========== PISO 1 (6 habitaciones) ==========

-- 101-Triple 5P (S/120.00)
INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT '101', '1', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Triple 5P' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

-- 102-Triple (S/110.00)
INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT '102', '1', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Triple' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

-- 103-Doble 4P (S/100.00)
INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT '103', '1', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Doble 4P' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

-- 104-Matrimonial (S/70.00)
INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT '104', '1', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Matrimonial' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

-- 105-Matrimonial (S/70.00)
INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT '105', '1', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Matrimonial' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

-- 107-Matrimonial (S/70.00)
INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT '107', '1', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Matrimonial' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

-- ========== PISO 2 (6 habitaciones) ==========

-- 203-Doble (S/90.00)
INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT '203', '2', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Doble' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

-- 205-Simple (S/50.00)
INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT '205', '2', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Simple' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

-- 206-Matrimonial (S/70.00) - Nota: en la lista original 209 estaba duplicado, asumo 206
INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT '206', '2', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Matrimonial' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

-- 207-Matrimonial (S/70.00)
INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT '207', '2', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Matrimonial' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

-- 208-Matrimonial (S/70.00)
INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT '208', '2', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Matrimonial' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

-- 209-Matrimonial (S/70.00)
INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT '209', '2', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Matrimonial' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

-- =============================================
-- 5. CAJAS
-- =============================================
INSERT INTO public.cajas (nombre, estado) VALUES
('Caja Principal', true)
ON CONFLICT DO NOTHING;

-- =============================================
-- 6. SERIES DE COMPROBANTES (Compatibles con Nubefact)
-- =============================================
-- Series para Boletas (Nubefact: BBB1)
INSERT INTO public.series_comprobante (caja_id, tipo_comprobante, serie, correlativo_actual)
SELECT c.id, 'BOLETA', 'BBB1', 0
FROM public.cajas c
WHERE c.nombre = 'Caja Principal'
ON CONFLICT (serie, tipo_comprobante) DO NOTHING;

-- Series para Facturas (Nubefact: FFF1)
INSERT INTO public.series_comprobante (caja_id, tipo_comprobante, serie, correlativo_actual)
SELECT c.id, 'FACTURA', 'FFF1', 0
FROM public.cajas c
WHERE c.nombre = 'Caja Principal'
ON CONFLICT (serie, tipo_comprobante) DO NOTHING;

-- Series para Notas de Crédito Boleta (Nubefact: BBB1)
INSERT INTO public.series_comprobante (caja_id, tipo_comprobante, serie, correlativo_actual)
SELECT c.id, 'NOTA_CREDITO', 'BBB1', 0
FROM public.cajas c
WHERE c.nombre = 'Caja Principal'
ON CONFLICT (serie, tipo_comprobante) DO NOTHING;

-- =============================================
-- 7. CANALES DE VENTA
-- =============================================
INSERT INTO public.canales_venta (nombre, activo) VALUES
('Directo', true),
('Booking', true),
('Expedia', true),
('Airbnb', true)
ON CONFLICT DO NOTHING;

-- Confirmación
SELECT '✅ Seed completado: 12 habitaciones, 1 caja, 3 series Nubefact y 4 canales de venta' AS resultado;
