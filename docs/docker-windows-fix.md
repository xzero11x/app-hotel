# 🔧 Arreglo Definitivo: Supabase Local en Windows

## El Problema Real

Docker Desktop en Windows tiene problemas de permisos de socket. **No es tu culpa, es un bug conocido de Windows.**

## ✅ Solución Paso a Paso

### 1. Reinicia Docker Desktop

```powershell
# Opción A: Desde la interfaz
# - Click derecho en el ícono de Docker (barra de tareas)
# - "Restart"

# Opción B: Desde PowerShell (como Admin)
Stop-Service -Name "com.docker.service" -Force
Start-Service -Name "com.docker.service"
```

### 2. Espera a que Docker esté "running"

Verifica en Docker Desktop que diga "Docker Desktop is running" (ícono verde).

### 3. Inicia Supabase

```powershell
npx supabase start
```

**IMPORTANTE:** La primera vez tarda 2-5 min descargando imágenes.

### 4. Verifica que Todo Funcione

```powershell
npx supabase status
```

Deberías ver:

```
Studio URL: http://127.0.0.1:54323
API URL: http://127.0.0.1:54321
...
```

### 5. Accede al Dashboard

Abre en tu navegador:
```
http://127.0.0.1:54323
```

O con localhost:
```
http://localhost:54323
```

## 🔍 Si Aún No Funciona

### Opción 1: Modo Debug

```powershell
npx supabase start --debug
```

Copia el output completo para diagnosticar.

### Opción 2: Reinstalar Supabase CLI

```powershell
npm uninstall -g supabase
npm install -g supabase@latest
```

### Opción 3: Verificar Docker

```powershell
# Ver si Docker responde
docker ps

# Si esto falla, Docker Desktop tiene problemas
```

**Si `docker ps` falla:**
1. Abre Docker Desktop
2. Settings → General
3. ✅ "Use the WSL 2 based engine"
4. Apply & Restart

### Opción 4: Resetear Docker Completamente

**⚠️ CUIDADO: Borra todos los contenedores/volúmenes**

```powershell
# 1. Detén Docker
# (Click derecho → Quit Docker Desktop)

# 2. Abre PowerShell como Admin

# 3. Borra configuraciones
Remove-Item -Path "$env:APPDATA\Docker" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Docker" -Recurse -Force -ErrorAction SilentlyContinue

# 4. Reinicia Docker Desktop
```

## 🎯 Workflow Correcto (Una vez funcione)

### Inicio del Día

```powershell
# 1. Asegúrate que Docker Desktop esté corriendo

# 2. Inicia Supabase
npx supabase start

# 3. Inicia tu app
npm run dev
```

### Durante el Desarrollo

1. **Haces cambios en el Dashboard** (http://127.0.0.1:54323)
2. **Capturas los cambios:**
   ```powershell
   npx supabase db diff -f nombre_descriptivo
   ```
3. **Generas tipos:**
   ```powershell
   npm run db:types
   ```
4. **Commiteas:**
   ```powershell
   git add supabase/migrations/ types/
   git commit -m "feat: cambios en schema"
   ```

### Fin del Día

```powershell
# Detener Supabase (opcional, libera RAM)
npx supabase stop
```

## 🏆 ¿Por Qué Docker Local es Mejor?

1. **Control Total:** Tu esquema está versionado en `supabase/migrations/`
2. **Offline:** No necesitas internet
3. **Reproducible:** El mismo ambiente en dev, staging y prod
4. **Testing Seguro:** Puedes romper cosas sin afectar producción
5. **CI/CD:** Migraciones se aplican automáticamente

**Es el estándar enterprise.** Quien dijo que trabajar directo en la nube es de "novatos" tiene razón.

## 📝 Comandos de Emergencia

```powershell
# Ver logs de un servicio específico
docker logs supabase_studio_app-hotel
docker logs supabase_db_app-hotel

# Reiniciar un servicio específico
docker restart supabase_studio_app-hotel

# Ver puertos
docker port supabase_studio_app-hotel

# Ver contenedores de Supabase
docker ps --filter "label=com.supabase.cli.project=app-hotel"

# Detener todo de Supabase
npx supabase stop

# Resetear BD local (mantiene migraciones)
npx supabase db reset
```

## ⚡ Fix Rápido si se Cuelga

```powershell
# 1. Mata todo
npx supabase stop --no-backup

# 2. Limpia
docker system prune -f

# 3. Reinicia Docker Desktop

# 4. Espera 30 seg

# 5. Inicia de nuevo
npx supabase start
```

## 🆘 Si Nada Funciona

**Última opción (combina local + remoto):**

1. **BD Local** para desarrollo:
   ```powershell
   npx supabase db start  # Solo BD, no Studio
   ```

2. **Dashboard Remoto** para gestionar esquema:
   ```
   https://app.supabase.com/project/thfurwbvjmtnleaqduzi
   ```

3. **Sincronización:**
   ```powershell
   # Después de cambios remotos
   npx supabase db remote commit
   npx supabase db reset  # Aplica a local
   ```

Este híbrido funciona al 100% en cualquier sistema.
