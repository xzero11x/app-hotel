import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default async function EstadiasPage() {
  const supabase = await createClient();

  const { data: estadias, error } = await supabase
    .from("estadias")
    .select(`
      id,
      fecha_ingreso,
      fecha_salida_prevista,
      estado,
      habitacion:habitaciones(numero, piso),
      huesped:huespedes!huesped_principal_id(nombres, apellidos, num_doc)
    `)
    .order("fecha_ingreso", { ascending: false });

  if (error) {
    return <div className="p-4 text-red-500">Error al cargar estadías</div>;
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Estadías</h1>
          <p className="text-muted-foreground">
            Gestión de huéspedes alojados actualmente
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {estadias?.map((estadia: any) => (
          <Card key={estadia.id} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Habitación {estadia.habitacion?.numero}
              </CardTitle>
              <Badge
                variant={estadia.estado === "ACTIVA" ? "default" : "secondary"}
              >
                {estadia.estado}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {estadia.huesped?.nombres} {estadia.huesped?.apellidos}
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                DNI: {estadia.huesped?.num_doc}
              </p>
              <div className="grid gap-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ingreso:</span>
                  <span>
                    {format(new Date(estadia.fecha_ingreso), "dd MMM yyyy", {
                      locale: es,
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Salida:</span>
                  <span>
                    {format(new Date(estadia.fecha_salida_prevista), "dd MMM yyyy", {
                      locale: es,
                    })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {estadias?.length === 0 && (
          <div className="col-span-full text-center py-10 text-muted-foreground">
            No hay estadías registradas
          </div>
        )}
      </div>
    </div>
  );
}
