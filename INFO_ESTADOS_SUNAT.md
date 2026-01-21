
# ¿Cómo se actualiza el estado de SUNAT?

La actualización **NO es automática** por arte de magia (Nubefact no avisa a tu app "¡Oye, ya aceptaron!").
Tu app tiene que **preguntar activamente** ("¿Ya aceptaron la factura X?").

## Estrategias posibles:

1.  **Botón Manual (Recomendado ahora):**
    Un botón "Actualizar Estado" al lado de cada factura pendiente. Si le das clic, la app consulta a Nubefact y actualiza la BD.

2.  **Tarea Automática (Cron Job):**
    Un script que corre cada 15 minutos en el servidor, busca todas las "PENDIENTES" y pregunta por ellas. (Más complejo de configurar en Vercel/Supabase sin pagar servicios extra).

3.  **Webhook (Avanzado):**
    Configurar en Nubefact para que ellos llamen a una URL de tu app cuando cambie el estado. (Requiere que tu app esté en una URL pública y configurar el panel de Nubefact).

**Mi recomendación:**
Implementemos primero la **Opción 1 (Botón Manual)** o simplemente que al entrar al detalle de la factura, la app verifique el estado en ese momento si está pendiente.
