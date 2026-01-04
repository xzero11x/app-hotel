# 🎉 ¡Supabase Local Funcionando!

## ✅ Setup Completo

Tu ambiente de desarrollo profesional está 100% configurado:

- ✅ **Supabase Local** corriendo en Docker
- ✅ **Base de datos** con tu esquema completo
- ✅ **Migraciones** versionadas en Git
- ✅ **Tipos TypeScript** generados
- ✅ **Next.js** conectado a BD local

## 🌐 URLs Activas

### Dashboard Local
```
http://127.0.0.1:8323
```
Aquí gestionas tablas, ejecutas SQL, ves datos, etc.

### Tu App
```
http://localhost:3001
```
Tu aplicación Next.js corriendo.

### APIs
- **REST:** `http://127.0.0.1:8321/rest/v1`
- **GraphQL:** `http://127.0.0.1:8321/graphql/v1`
- **Database:** `postgresql://postgres:postgres@127.0.0.1:8322/postgres`

## 🚀 Workflow Diario

### 1. Iniciar el Día
```powershell
# 1. Asegúrate que Docker Desktop esté corriendo
# 2. Inicia Supabase (si no está ya)
npx supabase start

# 3. Inicia tu app
npm run dev
```

### 2. Ver/Editar Base de Datos
Abre el Dashboard:
```
http://127.0.0.1:8323
```
- **Table Editor** → Ver/editar datos
- **SQL Editor** → Ejecutar queries
- **Database** → Ver esquema

### 3. Modificar Esquema

**Opción A: En el Dashboard**
1. Ve a http://127.0.0.1:8323
2. Crea/modifica tablas con la UI

**Opción B: Con SQL**
```powershell
# SQL directo
npx supabase db execute "ALTER TABLE habitaciones ADD COLUMN nueva_columna TEXT;"

# Desde archivo
npx supabase db execute -f mi_cambio.sql
```

### 4. Capturar Cambios (IMPORTANTE 🔑)

Después de hacer cambios en el Dashboard o con SQL:

```powershell
npx supabase db diff -f descripcion_del_cambio
```

Esto genera:
```
supabase/migrations/[timestamp]_descripcion_del_cambio.sql
```

**Este archivo es tu migración versionada.** Commitéalo a Git.

### 5. Actualizar Tipos TypeScript

```powershell
npm run db:types
```

Esto actualiza `types/database.types.ts` con tu nuevo esquema.

### 6. Usar en tu Código

```typescript
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

// Ahora tienes autocompletado completo
const supabase = createClient()
const { data } = await supabase.from('habitaciones').select('*')
//                                     ^ autocompletado!
```

### 7. Commitear

```powershell
git add supabase/migrations/ types/
git commit -m "feat: agregar columna X a habitaciones"
git push
```

### 8. Desplegar a Producción

```powershell
# Aplica todas las migraciones pendientes
npx supabase db push
```

### 9. Fin del Día

```powershell
# Opcional: Detener Supabase para liberar RAM
npx supabase stop
```

## 📊 Comandos Útiles

```powershell
# Ver estado
npx supabase status

# Ver logs
docker logs supabase_db_app-hotel

# Resetear BD local (aplica migraciones + seed)
npx supabase db reset

# Ver qué migraciones están aplicadas
npx supabase db status

# Ejecutar SQL rápido
npx supabase db execute "SELECT * FROM habitaciones LIMIT 5;"

# Abrir psql interactivo
docker exec -it supabase_db_app-hotel psql -U postgres
```

## 🎯 Tu Esquema Actual

Ya tienes estas tablas en tu BD local:

1. **configuracion_sistema** - Config global
2. **series_comprobantes** - Serie/correlativos
3. **usuarios** - Usuarios del sistema
4. **categorias** - Categorías de habitaciones
5. **tarifas** - Tarifas por categoría
6. **habitaciones** - Inventario de habitaciones
7. **huespedes** - Huéspedes/clientes
8. **reservas** - Reservaciones
9. **estadias** - Estadías activas
10. **estadia_huespedes** - Relación M2M
11. **turnos** - Turnos de caja
12. **pagos** - Pagos (multi-moneda)
13. **comprobantes** - Facturación SUNAT
14. **comprobante_detalles** - Líneas de factura
15. **audit_logs** - Auditoría automática

## 🔄 Cambiar entre Local y Remoto

### Para usar BD Local (actual):
`.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:8321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

### Para usar BD Remota (producción):
`.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://thfurwbvjmtnleaqduzi.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_F-u-QtM0r35yFBmuOxk9ag_rYODGBLs
```

Luego reinicia `npm run dev`.

## 📚 Documentación

- **`docs/supabase-workflow.md`** - Workflow completo profesional
- **`docs/development-guide.md`** - Guía de desarrollo
- **`docs/docker-windows-fix.md`** - Solución problemas Docker
- **`README.md`** - Overview del proyecto

## 🏆 Estás Listo

Ahora puedes:
- ✅ Crear tablas en el Dashboard local
- ✅ Ejecutar SQL
- ✅ Versionar cambios con migraciones
- ✅ Tener tipos TypeScript automáticos
- ✅ Desarrollar offline
- ✅ Desplegar a producción con un comando

**¡Empieza a desarrollar!** 🚀
