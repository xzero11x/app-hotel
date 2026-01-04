-- =========================================
-- LIMPIEZA TOTAL - Una sola línea
-- Ejecutar en el SQL Editor de Supabase Dashboard
-- =========================================

-- Elimina TODO el schema public y lo recrea vacío
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Restaurar permisos por defecto
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Confirmación
SELECT '✅ Schema public completamente limpio' AS resultado;
