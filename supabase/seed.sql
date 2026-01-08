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
INSERT INTO public.tipos_habitacion (nombre, capacidad_personas) VALUES
('Simple', 1),
('Doble', 3),
('Doble 4P', 4),
('Matrimonial', 2),
('Triple', 3),
('Triple 5P', 5)
ON CONFLICT DO NOTHING;

-- =============================================
-- 3. TARIFAS BASE (Tipo + Categoría Estándar)
-- =============================================
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
        WHEN t.nombre = 'Doble' THEN 90.00
        WHEN t.nombre = 'Doble 4P' THEN 100.00
        WHEN t.nombre = 'Matrimonial' THEN 70.00
        WHEN t.nombre = 'Triple' THEN 110.00
        WHEN t.nombre = 'Triple 5P' THEN 120.00
    END,
    CASE 
        WHEN t.nombre = 'Simple' THEN 30.00
        WHEN t.nombre = 'Doble' THEN 80.00
        WHEN t.nombre = 'Doble 4P' THEN 90.00
        WHEN t.nombre = 'Matrimonial' THEN 50.00
        WHEN t.nombre = 'Triple' THEN 100.00
        WHEN t.nombre = 'Triple 5P' THEN 110.00
    END,
    true
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE c.nombre = 'Estándar'
ON CONFLICT DO NOTHING;

-- =============================================
-- 4. HABITACIONES
-- =============================================

-- PISO 1: 2 Simples + 3 Matrimoniales
INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT 
    '101', '1', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Simple' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT 
    '102', '1', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Simple' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT 
    '103', '1', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Matrimonial' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT 
    '104', '1', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Matrimonial' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT 
    '105', '1', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Matrimonial' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

-- PISO 2: 2 Simples + 3 Matrimoniales
INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT 
    '201', '2', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Simple' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT 
    '202', '2', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Simple' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT 
    '203', '2', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Matrimonial' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT 
    '204', '2', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Matrimonial' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT 
    '205', '2', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Matrimonial' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

-- Una habitación de cada tipo restante (Doble, Doble 4P, Triple, Triple 5P)
INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT 
    '301', '3', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Doble' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT 
    '302', '3', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Doble 4P' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT 
    '303', '3', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Triple' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

INSERT INTO public.habitaciones (numero, piso, tipo_id, categoria_id, estado_ocupacion, estado_limpieza, estado_servicio)
SELECT 
    '304', '3', t.id, c.id, 'LIBRE', 'LIMPIA', 'OPERATIVA'
FROM public.tipos_habitacion t
CROSS JOIN public.categorias_habitacion c
WHERE t.nombre = 'Triple 5P' AND c.nombre = 'Estándar'
ON CONFLICT (numero) DO NOTHING;

-- =============================================
-- 5. CAJAS
-- =============================================
INSERT INTO public.cajas (nombre, estado) VALUES
('Caja Principal', true)
ON CONFLICT DO NOTHING;

-- =============================================
-- 6. SERIES DE COMPROBANTES
-- =============================================
-- Series para Boletas
INSERT INTO public.series_comprobante (caja_id, tipo_comprobante, serie, correlativo_actual)
SELECT c.id, 'BOLETA', 'B001', 0
FROM public.cajas c
WHERE c.nombre = 'Caja Principal'
ON CONFLICT (serie, tipo_comprobante) DO NOTHING;

-- Series para Facturas
INSERT INTO public.series_comprobante (caja_id, tipo_comprobante, serie, correlativo_actual)
SELECT c.id, 'FACTURA', 'F001', 0
FROM public.cajas c
WHERE c.nombre = 'Caja Principal'
ON CONFLICT (serie, tipo_comprobante) DO NOTHING;

-- Series para Notas de Crédito
INSERT INTO public.series_comprobante (caja_id, tipo_comprobante, serie, correlativo_actual)
SELECT c.id, 'NOTA_CREDITO', 'NC01', 0
FROM public.cajas c
WHERE c.nombre = 'Caja Principal'
ON CONFLICT (serie, tipo_comprobante) DO NOTHING;

-- Confirmación
SELECT '✅ Seed completado: 14 habitaciones, 1 caja y 3 series creadas' AS resultado;
