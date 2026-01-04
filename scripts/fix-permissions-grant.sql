-- ========================================================
-- SOLUCIÓN FINAL DE PERMISOS (ERROR 42501)
-- ========================================================
-- El error 42501 indica que el rol de base de datos no tiene
-- permisos para "tocar" la tabla, independientemente de RLS.
-- Este script otorga permisos totales a los usuarios autenticados.
-- ========================================================

-- 1. Otorgar uso del esquema público
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- 2. Otorgar permisos a TODAS las tablas actuales
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 3. Otorgar permisos a todas las secuencias (para contadores)
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 4. Asegurar permisos futuros (para tablas que crees después)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

-- 5. Verificar que el usuario existe (Confirmación visual)
SELECT 'Permisos otorgados correctamente' as estado, count(*) as usuarios_count FROM usuarios;
