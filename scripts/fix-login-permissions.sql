-- ========================================================
-- SOLUCIÓN AL ERROR "USUARIO NO AUTORIZADO"
-- ========================================================
-- Este script deshabilita la seguridad a nivel de fila (RLS)
-- en la tabla 'usuarios' para permitir que la aplicación
-- lea el perfil del administrador correctamente.
-- ========================================================

-- 1. Deshabilitar RLS temporalmente para permitir lectura
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;

-- 2. Asegurar que el usuario administrador este activo y con rol correcto
UPDATE usuarios 
SET activo = true, rol = 'admin'
WHERE email = 'admin@hotel.com';

-- 3. Verificar que el usuario existe y es accesible
SELECT id, email, rol, activo 
FROM usuarios 
WHERE email = 'admin@hotel.com';
