# 🔧 Troubleshooting: Dashboard No Carga

## Problema: ERR_CONNECTION_REFUSED en http://127.0.0.1:54323

### Diagnóstico

El contenedor de Studio corre pero el puerto no está mapeado correctamente en Windows.

### Solución Definitiva

#### Opción 1: Acceder vía Kong Gateway (Recomendado)

El Studio está accesible a través del gateway de Supabase:

```
http://127.0.0.1:54321
```

Luego navega manualmente a `/project/default` o usa directamente:

```
http://127.0.0.1:54321/project/default
```

#### Opción 2: Recrear Stack Completo

```powershell
# 1. Detener todo
npx supabase stop

# 2. Limpiar volúmenes (CUIDADO: Borra datos locales)
docker volume prune -f

# 3. Reiniciar
npx supabase start
```

#### Opción 3: Usar Supabase Web Directamente

**La forma más confiable:**

1. Ve a https://app.supabase.com/project/thfurwbvjmtnleaqduzi
2. Usa el SQL Editor o Table Editor en la web
3. Los cambios se sincronizan automáticamente

**Para capturar cambios:**
```powershell
npx supabase db remote commit
```

Esto genera una migración desde tu BD remota.

### Comandos Útiles

```powershell
# Ver logs del Studio
docker logs supabase_studio_app-hotel

# Ver todos los contenedores de Supabase
docker ps --filter "label=com.supabase.cli.project=app-hotel"

# Reiniciar solo el Studio
docker restart supabase_studio_app-hotel

# Ver puertos mapeados
docker port supabase_studio_app-hotel
```

## Workflow Recomendado (Sin Dashboard Local)

### 1. Desarrollo Diario

```powershell
# Solo correr la BD (sin Studio)
npx supabase db start

# O usar BD remota directamente
# (con credenciales de producción en .env.local)
```

### 2. Hacer Cambios en el Esquema

**Opción A: SQL Editor Web**
1. https://app.supabase.com/project/thfurwbvjmtnleaqduzi/sql
2. Escribe tu SQL
3. Ejecuta

**Opción B: Archivo SQL Local**
```powershell
# Crea un archivo temporal
echo "ALTER TABLE habitaciones ADD COLUMN nueva_col TEXT;" > temp.sql

# Aplícalo
npx supabase db execute -f temp.sql

# O directamente
npx supabase db execute "ALTER TABLE habitaciones ADD COLUMN nueva_col TEXT;"
```

### 3. Capturar Cambios (IMPORTANTE)

Después de cualquier cambio en la web o local:

```powershell
# Genera migración desde el estado actual
npx supabase db diff -f descripcion_del_cambio

# Actualiza tipos
npm run db:types
```

### 4. Ver Datos

**Opción A: Supabase Web**
- Table Editor: https://app.supabase.com/project/thfurwbvjmtnleaqduzi/editor

**Opción B: SQL Directo**
```powershell
npx supabase db execute "SELECT * FROM habitaciones LIMIT 10;"
```

**Opción C: Herramienta Externa**
- DBeaver, pgAdmin, TablePlus, etc.
- Connection: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

## Scripts de Ayuda

Agrega a `package.json`:

```json
{
  "scripts": {
    "db:query": "npx supabase db execute",
    "db:logs": "docker logs supabase_db_app-hotel",
    "db:psql": "docker exec -it supabase_db_app-hotel psql -U postgres",
    "studio:logs": "docker logs supabase_studio_app-hotel",
    "studio:restart": "docker restart supabase_studio_app-hotel"
  }
}
```

Uso:
```powershell
npm run db:query "SELECT * FROM habitaciones;"
npm run db:psql
npm run studio:logs
```

## Recomendación Final

**Para máxima estabilidad en Windows:**

1. **No uses el Dashboard local** - Usa https://app.supabase.com
2. **Corre solo la BD local** cuando necesites desarrollo offline
3. **Versionas con `db diff`** después de cada cambio
4. **Despliegas con `db push`** cuando estés listo

Este flujo es más confiable que depender del Studio local en Windows.

## Configuración .env.local

Para cambiar entre local y remoto fácilmente:

```env
# ===== DESARROLLO LOCAL (Docker) =====
# NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH

# ===== PRODUCCIÓN/REMOTO (Supabase Cloud) =====
NEXT_PUBLIC_SUPABASE_URL=https://thfurwbvjmtnleaqduzi.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_F-u-QtM0r35yFBmuOxk9ag_rYODGBLs

# ===== CLI =====
SUPABASE_ACCESS_TOKEN=sbp_a53af090317923d03f77d9b7a55855a8465b9e9d
```

Descomenta el bloque que quieras usar y reinicia `npm run dev`.
