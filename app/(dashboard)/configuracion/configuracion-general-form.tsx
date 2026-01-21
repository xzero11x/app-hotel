'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Save, Clock, Building2, Mail, Phone, Globe, Receipt, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import { updateHotelConfig } from '@/lib/actions/configuracion'
import type { HotelConfig } from '@/lib/actions/configuracion'

type Props = {
  initialData: HotelConfig | null
}

export function ConfiguracionGeneralForm({ initialData }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const [formData, setFormData] = useState({
    ruc: initialData?.ruc || '',
    razon_social: initialData?.razon_social || '',
    nombre_comercial: initialData?.nombre_comercial || '',
    direccion_fiscal: initialData?.direccion_fiscal || '',
    ubigeo_codigo: initialData?.ubigeo_codigo || '',
    telefono: initialData?.telefono || '',
    email: initialData?.email || '',
    pagina_web: initialData?.pagina_web || '',
    hora_checkin: initialData?.hora_checkin || '14:00',
    hora_checkout: initialData?.hora_checkout || '12:00',
    descripcion: initialData?.descripcion || '',
    // Facturación
    tasa_igv: initialData?.tasa_igv ?? 18.00,
    tasa_icbper: initialData?.tasa_icbper ?? 0.50,
    es_exonerado_igv: initialData?.es_exonerado_igv ?? false,
    facturacion_activa: initialData?.facturacion_activa ?? false,
  })

  // Validación de RUC peruano (11 dígitos con dígito verificador)
  function validarRUC(ruc: string): { valido: boolean; error?: string } {
    if (!ruc) return { valido: false, error: 'RUC es requerido' }
    if (!/^\d{11}$/.test(ruc)) {
      return { valido: false, error: 'RUC debe tener 11 dígitos' }
    }
    const prefijosValidos = ['10', '15', '17', '20']
    if (!prefijosValidos.some(p => ruc.startsWith(p))) {
      return { valido: false, error: 'RUC debe iniciar con 10, 15, 17 o 20' }
    }
    // Algoritmo de dígito verificador SUNAT (módulo 11)
    const factores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    let suma = 0
    for (let i = 0; i < 10; i++) {
      suma += parseInt(ruc[i]) * factores[i]
    }
    // Fórmula correcta: (11 - (suma % 11)) % 11, si es 10 se usa 0
    const resto = suma % 11
    let digitoVerificador = 11 - resto
    if (digitoVerificador >= 10) digitoVerificador = digitoVerificador - 10

    if (parseInt(ruc[10]) !== digitoVerificador) {
      return { valido: false, error: 'Dígito verificador de RUC inválido' }
    }
    return { valido: true }
  }

  const updateField = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validar RUC si facturación está activa
    if (formData.facturacion_activa) {
      const rucValidation = validarRUC(formData.ruc)
      if (!rucValidation.valido) {
        toast.error(rucValidation.error)
        return
      }
      if (!formData.razon_social || formData.razon_social === 'MI HOTEL S.A.C.') {
        toast.error('Debe configurar la razón social real del hotel')
        return
      }
      if (!formData.direccion_fiscal) {
        toast.error('Debe configurar la dirección fiscal')
        return
      }
    }

    setSaving(true)

    try {
      // Limpiar datos: campos vacíos deben ser null para evitar errores de constraint
      const dataToSave = {
        ...formData,
        ubigeo_codigo: formData.ubigeo_codigo?.trim() || null,
        telefono: formData.telefono?.trim() || null,
        email: formData.email?.trim() || null,
        pagina_web: formData.pagina_web?.trim() || null,
        descripcion: formData.descripcion?.trim() || null,
      }

      const result = await updateHotelConfig(dataToSave)

      if (result.success) {
        toast.success('Configuración guardada exitosamente')
        setIsEditing(false)
        router.refresh()
      } else {
        toast.error(result.error || 'Error al guardar la configuración')
      }
    } catch (error) {
      console.error('Error saving configuration:', error)
      toast.error('Error al guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    // Resetear form a valores iniciales (simple reload o reset state si tuviéramos backup)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Datos del Hotel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Información del Hotel
          </CardTitle>
          <CardDescription>
            Datos generales de tu establecimiento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ruc">RUC *</Label>
              <Input
                id="ruc"
                value={formData.ruc}
                onChange={(e) => updateField('ruc', e.target.value)}
                placeholder="20XXXXXXXXX"
                maxLength={11}
                required
                disabled={!isEditing || saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                type="tel"
                value={formData.telefono}
                onChange={(e) => updateField('telefono', e.target.value)}
                placeholder="+51 999 999 999"
                disabled={!isEditing || saving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="razon_social">Razón Social *</Label>
            <Input
              id="razon_social"
              value={formData.razon_social}
              onChange={(e) => updateField('razon_social', e.target.value)}
              placeholder="HOTEL PARADISE S.A.C."
              required
              disabled={!isEditing || saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nombre_comercial">Nombre Comercial</Label>
            <Input
              id="nombre_comercial"
              value={formData.nombre_comercial}
              onChange={(e) => updateField('nombre_comercial', e.target.value)}
              placeholder="Hotel Paradise"
              disabled={!isEditing || saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="direccion_fiscal">Dirección Fiscal</Label>
            <Input
              id="direccion_fiscal"
              value={formData.direccion_fiscal}
              onChange={(e) => updateField('direccion_fiscal', e.target.value)}
              placeholder="Av. Principal 123, Lima"
              disabled={!isEditing || saving}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ubigeo_codigo">Ubigeo (Código SUNAT)</Label>
              <Input
                id="ubigeo_codigo"
                value={formData.ubigeo_codigo}
                onChange={(e) => updateField('ubigeo_codigo', e.target.value)}
                placeholder="150101"
                maxLength={6}
                disabled={!isEditing || saving}
              />
              <p className="text-xs text-muted-foreground">
                6 dígitos del distrito (ej: 150101 para Lima Centro)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="contacto@hotel.com"
                disabled={!isEditing || saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pagina_web" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Página Web
              </Label>
              <Input
                id="pagina_web"
                type="url"
                value={formData.pagina_web}
                onChange={(e) => updateField('pagina_web', e.target.value)}
                placeholder="https://www.hotel.com"
                disabled={!isEditing || saving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <textarea
              id="descripcion"
              value={formData.descripcion}
              onChange={(e) => updateField('descripcion', e.target.value)}
              placeholder="Breve descripción del hotel..."
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!isEditing || saving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Facturación y SUNAT (NUEVO) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Facturación y SUNAT
          </CardTitle>
          <CardDescription>
            Configura los parámetros tributarios para la emisión de comprobantes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-base">Activar Facturación Electrónica</Label>
              <p className="text-sm text-muted-foreground">
                Habilita la emisión de comprobantes válidos para SUNAT
              </p>
            </div>
            <Switch
              checked={formData.facturacion_activa}
              onCheckedChange={(checked) => updateField('facturacion_activa', checked)}
              disabled={!isEditing || saving}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tasa_igv">Tasa IGV (%)</Label>
              <Input
                id="tasa_igv"
                type="number"
                step="0.01"
                value={formData.tasa_igv}
                onChange={(e) => updateField('tasa_igv', parseFloat(e.target.value) || 0)}
                disabled={!isEditing || saving}
              />
              <p className="text-xs text-muted-foreground">
                Generalmente 18.00%
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tasa_icbper">Impuesto Bolsas (ICBPER)</Label>
              <Input
                id="tasa_icbper"
                type="number"
                step="0.01"
                value={formData.tasa_icbper}
                onChange={(e) => updateField('tasa_icbper', parseFloat(e.target.value) || 0)}
                disabled={!isEditing || saving}
              />
              <p className="text-xs text-muted-foreground">
                Monto fijo por bolsa (ej: S/ 0.50)
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg bg-muted/20">
            <div className="space-y-0.5">
              <Label className="text-base">Régimen Exonerado (Amazonía)</Label>
              <p className="text-sm text-muted-foreground">
                Si el hotel está ubicado en zona exonerada de IGV
              </p>
            </div>
            <Switch
              checked={formData.es_exonerado_igv}
              onCheckedChange={(checked) => updateField('es_exonerado_igv', checked)}
              disabled={!isEditing || saving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Horarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horarios de Check-in/Check-out
          </CardTitle>
          <CardDescription>
            Define los horarios estándar del hotel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hora_checkin">Hora de Check-in</Label>
              <Input
                id="hora_checkin"
                type="time"
                value={formData.hora_checkin}
                onChange={(e) => updateField('hora_checkin', e.target.value)}
                required
                disabled={!isEditing || saving}
              />
              <p className="text-xs text-muted-foreground">
                Hora a partir de la cual los huéspedes pueden hacer check-in
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hora_checkout">Hora de Check-out</Label>
              <Input
                id="hora_checkout"
                type="time"
                value={formData.hora_checkout}
                onChange={(e) => updateField('hora_checkout', e.target.value)}
                required
                disabled={!isEditing || saving}
              />
              <p className="text-xs text-muted-foreground">
                Hora límite para que los huéspedes hagan check-out
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botones Flotantes (Action Bar) */}
      <div className="flex justify-end gap-3 sticky bottom-4 bg-background/80 backdrop-blur p-4 border rounded-lg shadow-lg border-t">
        {!isEditing ? (
          <Button type="button" onClick={() => setIsEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar Configuración
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={saving}
            >
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </form>
  )
}
