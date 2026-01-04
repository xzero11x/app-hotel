# Módulo de Check-in

## 📋 Descripción

Sistema completo de check-in en 3 pasos que permite registrar el ingreso de huéspedes al hotel, con funcionalidades avanzadas como autocompletado por DNI, gestión de acompañantes y registro de pagos.

## 🎯 Características Implementadas

### Paso 1: Seleccionar Habitación
- ✅ Lista de habitaciones disponibles
- ✅ Selección de tarifa por habitación
- ✅ Date picker para fecha/hora de ingreso
- ✅ Date picker para fecha de salida
- ✅ Validación de capacidad máxima
- ✅ Resumen en tiempo real

### Paso 2: Datos del Huésped
- ✅ **Autocompletado por DNI/Documento**
  - Busca automáticamente en la BD
  - Pre-llena todos los campos si existe
  - Marca como "Cliente Frecuente"
- ✅ Validación de campos obligatorios
- ✅ Email requerido (facturación electrónica)
- ✅ Nacionalidad (importante para IGV)
- ✅ **Gestión de acompañantes**
  - Agregar múltiples acompañantes
  - Datos básicos por acompañante
  - Eliminar acompañantes
- ✅ Soporte para RUC (Razón Social)

### Paso 3: Confirmar y Pagar
- ✅ Resumen completo de la reserva
- ✅ Datos de habitación y tarifa
- ✅ Datos del huésped y acompañantes
- ✅ **Registro de pago inicial**
  - Múltiples métodos (Efectivo, Tarjeta, Yape, Plin, etc.)
  - Monto flexible (puede ser 0)
- ✅ Creación automática de estadía
- ✅ Actualización de estado de habitación

## 🗄️ Estructura de Datos

### Relaciones Creadas
```
estadias
  ├── habitacion_id → habitaciones
  ├── huesped_principal_id → huespedes
  ├── tarifa_id → tarifas
  └── estadia_huespedes (many-to-many)
      └── huesped_id → huespedes (principal + acompañantes)

pagos
  └── estadia_id → estadias
```

### Campos Capturados

#### Huésped (tabla `huespedes`)
- ✅ tipo_doc, num_doc
- ✅ nombres, apellidos
- ✅ **email** (crítico para facturación)
- ✅ telefono
- ✅ **nacionalidad** (para exoneración IGV)
- ✅ ciudad_procedencia
- ✅ direccion
- ✅ razon_social (si es RUC)
- ✅ es_frecuente (automático)

#### Estadía (tabla `estadias`)
- ✅ fecha_ingreso (TIMESTAMP con hora)
- ✅ fecha_salida_prevista
- ✅ precio_noche_final (tarifa negociada)
- ✅ num_huespedes
- ✅ estado: 'ACTIVA'

#### Pago (tabla `pagos`)
- ✅ monto
- ✅ metodo_pago (EFECTIVO, TARJETA, YAPE, PLIN, etc.)
- ✅ fecha_pago
- ✅ concepto

## 📁 Archivos Creados

```
lib/actions/
  └── checkin.ts                    # Server Actions

app/(dashboard)/reservas/checkin/
  ├── page.tsx                      # Página principal
  ├── checkin-form.tsx              # Formulario multi-step
  └── steps/
      ├── select-habitacion.tsx     # Paso 1
      ├── datos-huesped.tsx         # Paso 2
      └── confirmar-pago.tsx        # Paso 3
```

## 🔧 Server Actions

### `buscarHuespedPorDocumento(numDoc, tipoDoc)`
Busca un huésped existente por su documento.

### `crearOActualizarHuesped(data)`
Crea un nuevo huésped o actualiza uno existente, marcándolo como frecuente.

### `getHabitacionesDisponibles()`
Obtiene todas las habitaciones disponibles con sus categorías y tarifas.

### `crearCheckIn(data)`
Crea la estadía completa:
1. Valida disponibilidad de habitación
2. Crea registro en `estadias`
3. Asocia huésped principal en `estadia_huespedes`
4. Crea registros para acompañantes
5. Actualiza estado de habitación a OCUPADA

### `registrarPago(data)`
Registra un pago asociado a una estadía.

## 🎨 UX/UI

- **Progress Indicator**: Muestra claramente en qué paso está el usuario
- **Validaciones**: Campos obligatorios marcados con *
- **Feedback Visual**: 
  - Cliente frecuente con badge
  - Resúmenes en cada paso
  - Estados de carga
- **Navegación**: Botones Atrás/Continuar en todos los pasos
- **Responsive**: Funciona en móvil y desktop

## 🚀 Flujo Completo

1. **Usuario accede** a `/reservas/checkin`
2. **Paso 1**: Selecciona habitación, tarifa y fechas
3. **Paso 2**: 
   - Ingresa DNI
   - Si existe → autocompleta
   - Si no existe → llena formulario
   - Agrega acompañantes (opcional)
4. **Paso 3**: 
   - Revisa resumen
   - Registra pago inicial (opcional)
   - Finaliza check-in
5. **Sistema crea**:
   - Huésped (si no existe) o actualiza
   - Estadía activa
   - Relaciones huésped-estadía
   - Pago (si hay monto)
   - Cambia habitación a OCUPADA
6. **Redirige** a lista de estadías activas

## 📊 Ventajas sobre Sistema en Papel

| Característica | Tarjeta Física | Sistema Digital |
|----------------|----------------|-----------------|
| Email | ❌ No captura | ✅ Obligatorio |
| Nacionalidad | ❌ No explícito | ✅ Requerido (IGV) |
| Historial | ❌ Se pierde | ✅ Cliente frecuente |
| Acompañantes | ❌ Limitado | ✅ Ilimitados |
| Auditoría | ❌ No rastreable | ✅ Registrado |
| Búsqueda | ❌ Manual | ✅ Instantánea |
| Facturación | ❌ Manual | ✅ Automática |
| Métodos Pago | ❌ Solo efectivo/tarjeta | ✅ Incluye Yape/Plin |

## ⚙️ Configuración Requerida

### Rutas de Navegación
Asegúrate de tener configurado en el sidebar:
```typescript
{
  title: "Check-in",
  url: "/reservas/checkin",
  icon: UserPlus,
}
```

### Permisos
La ruta requiere autenticación (middleware de Supabase).

## 🔜 Mejoras Futuras

- [ ] Scanner de DNI/Pasaporte
- [ ] Firma digital del huésped
- [ ] Cálculo automático de noches y total
- [ ] Descuentos y promociones
- [ ] Validación de mayoría de edad
- [ ] Integración con RENIEC (Perú)
- [ ] Impresión de tarjeta de registro
- [ ] Notificaciones por email/SMS

## 🧪 Testing

### Casos de Prueba Esenciales

1. ✅ Check-in cliente nuevo
2. ✅ Check-in cliente frecuente
3. ✅ Con acompañantes
4. ✅ Sin acompañantes
5. ✅ Con pago inicial
6. ✅ Sin pago inicial
7. ✅ Validación de capacidad
8. ✅ RUC con razón social

---

**Estado**: ✅ Implementado y funcional
**Última actualización**: Enero 2026
