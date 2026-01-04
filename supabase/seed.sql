-- Datos de prueba para el sistema de hotel
-- Se ejecuta automáticamente después de `supabase db reset`

-- 1. Categorías de habitaciones
INSERT INTO categorias (nombre, descripcion, capacidad_base, capacidad_max) VALUES
  ('Estándar', 'Habitación estándar con lo básico', 1, 2),
  ('Suite', 'Habitación amplia con sala de estar', 2, 4),
  ('Suite Premium', 'Suite de lujo con jacuzzi', 2, 4);

-- 2. Tarifas
INSERT INTO tarifas (nombre, descripcion, tipo, precio) VALUES
  ('rack', 'Tarifa estándar al público', 'NORMAL', 120.00),
  ('corporativa', 'Tarifa para empresas', 'NORMAL', 100.00),
  ('promo', 'Tarifa promocional', 'PROMOCION', 90.00);

-- 3. Habitaciones
INSERT INTO habitaciones (numero, piso, categoria_id, estado_ocupacion, estado_mantenimiento) VALUES
  ('101', 1, (SELECT id FROM categorias WHERE nombre = 'Estándar' LIMIT 1), 'DISPONIBLE', 'LIMPIO'),
  ('102', 1, (SELECT id FROM categorias WHERE nombre = 'Estándar' LIMIT 1), 'DISPONIBLE', 'LIMPIO'),
  ('103', 1, (SELECT id FROM categorias WHERE nombre = 'Estándar' LIMIT 1), 'DISPONIBLE', 'LIMPIO'),
  ('201', 2, (SELECT id FROM categorias WHERE nombre = 'Suite' LIMIT 1), 'DISPONIBLE', 'LIMPIO'),
  ('202', 2, (SELECT id FROM categorias WHERE nombre = 'Suite' LIMIT 1), 'DISPONIBLE', 'LIMPIO'),
  ('301', 3, (SELECT id FROM categorias WHERE nombre = 'Suite Premium' LIMIT 1), 'DISPONIBLE', 'LIMPIO');

-- 4. Relación categorías-tarifas (precio por tarifa y categoría)
INSERT INTO categoria_tarifas (categoria_id, tarifa_id, precio_noche) VALUES
  -- Estándar
  ((SELECT id FROM categorias WHERE nombre = 'Estándar' LIMIT 1), 
   (SELECT id FROM tarifas WHERE nombre = 'rack' LIMIT 1), 120.00),
  ((SELECT id FROM categorias WHERE nombre = 'Estándar' LIMIT 1), 
   (SELECT id FROM tarifas WHERE nombre = 'corporativa' LIMIT 1), 100.00),
  ((SELECT id FROM categorias WHERE nombre = 'Estándar' LIMIT 1), 
   (SELECT id FROM tarifas WHERE nombre = 'promo' LIMIT 1), 90.00),
  
  -- Suite
  ((SELECT id FROM categorias WHERE nombre = 'Suite' LIMIT 1), 
   (SELECT id FROM tarifas WHERE nombre = 'rack' LIMIT 1), 200.00),
  ((SELECT id FROM categorias WHERE nombre = 'Suite' LIMIT 1), 
   (SELECT id FROM tarifas WHERE nombre = 'corporativa' LIMIT 1), 170.00),
  ((SELECT id FROM categorias WHERE nombre = 'Suite' LIMIT 1), 
   (SELECT id FROM tarifas WHERE nombre = 'promo' LIMIT 1), 150.00),
  
  -- Suite Premium
  ((SELECT id FROM categorias WHERE nombre = 'Suite Premium' LIMIT 1), 
   (SELECT id FROM tarifas WHERE nombre = 'rack' LIMIT 1), 350.00),
  ((SELECT id FROM categorias WHERE nombre = 'Suite Premium' LIMIT 1), 
   (SELECT id FROM tarifas WHERE nombre = 'corporativa' LIMIT 1), 300.00),
  ((SELECT id FROM categorias WHERE nombre = 'Suite Premium' LIMIT 1), 
   (SELECT id FROM tarifas WHERE nombre = 'promo' LIMIT 1), 280.00);

SELECT 'Datos de prueba creados exitosamente' AS message;
