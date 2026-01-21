'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { toast } from 'sonner'
import { registrarMovimiento } from '@/lib/actions/cajas'
import { PlusCircle, MinusCircle, Loader2, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'

// Categorías para cada tipo de movimiento
const CATEGORIAS = {
  INGRESO: [
    { value: 'VENTA_DIRECTA', label: 'Venta Directa' },
    { value: 'PROPINA', label: 'Propina' },
    { value: 'REEMBOLSO', label: 'Reembolso Recibido' },
    { value: 'AJUSTE', label: 'Ajuste' },
    { value: 'OTRO', label: 'Otro' }
  ],
  EGRESO: [
    { value: 'RETIRO_ADMINISTRATIVO', label: 'Retiro Administrativo (Dueño/Gerencia)', destacado: true },
    { value: 'GASTO_OPERATIVO', label: 'Gasto Operativo (Útiles, Insumos)' },
    { value: 'GASTO_EMERGENCIA', label: 'Gasto de Emergencia' },
    { value: 'DOTACION_SENCILLO', label: 'Dotación de Sencillo' },
    { value: 'PROPINA_STAFF', label: 'Propina a Staff' },
    { value: 'REEMBOLSO_CLIENTE', label: 'Reembolso a Cliente' },
    { value: 'AJUSTE', label: 'Ajuste' },
    { value: 'OTRO', label: 'Otro' }
  ]
}

export function RegistrarMovimientoDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    tipo: 'INGRESO' as 'INGRESO' | 'EGRESO',
    categoria: '',
    moneda: 'PEN' as 'PEN' | 'USD',
    monto: '',
    motivo: '',
    comprobante_referencia: '',
    receptor_nombre: '' // Quién recibe el dinero (para retiros)
  })
  const router = useRouter()

  const esRetiroAdministrativo = formData.categoria === 'RETIRO_ADMINISTRATIVO'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validación especial para retiros administrativos
    if (esRetiroAdministrativo && !formData.receptor_nombre.trim()) {
      toast.error('Campo requerido', { description: 'Indica quién recibe el dinero' })
      return
    }

    setLoading(true)

    try {
      // Construir motivo completo para retiro administrativo
      let motivoFinal = formData.motivo
      if (esRetiroAdministrativo) {
        motivoFinal = `RETIRO ADMINISTRATIVO - Entregado a: ${formData.receptor_nombre}. ${formData.motivo}`
      }

      const result = await registrarMovimiento({
        tipo: formData.tipo,
        categoria: formData.categoria || undefined,
        moneda: formData.moneda,
        monto: parseFloat(formData.monto),
        motivo: motivoFinal,
        comprobante_referencia: formData.comprobante_referencia || undefined
        // TODO: Subir evidencia a storage y guardar URL
      })

      if (result.success) {
        toast.success('Movimiento registrado', {
          description: `${formData.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'} de ${formData.moneda === 'PEN' ? 'S/' : '$'} ${formData.monto}`,
        })
        setOpen(false)
        resetForm()
        router.refresh()
      } else {
        toast.error('Error', {
          description: result.error || 'No se pudo registrar el movimiento',
        })
      }
    } catch (error) {
      toast.error('Error', {
        description: 'Ocurrió un error al registrar el movimiento',
      })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      tipo: 'INGRESO',
      categoria: '',
      moneda: 'PEN',
      monto: '',
      motivo: '',
      comprobante_referencia: '',
      receptor_nombre: ''
    })
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen)
      if (!isOpen) resetForm()
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Registrar Movimiento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Registrar Movimiento</DialogTitle>
            <DialogDescription>
              Ingreso o egreso manual de dinero en caja
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Tipo de Movimiento */}
            <div className="space-y-2">
              <Label>Tipo de Movimiento *</Label>
              <ToggleGroup
                type="single"
                value={formData.tipo}
                onValueChange={(value) => {
                  if (value) setFormData({ ...formData, tipo: value as 'INGRESO' | 'EGRESO', categoria: '', receptor_nombre: '' })
                }}
                className="justify-start"
              >
                <ToggleGroupItem value="INGRESO" className="gap-2 flex-1 data-[state=on]:bg-green-100 data-[state=on]:text-green-700">
                  <PlusCircle className="h-4 w-4" />
                  Ingreso
                </ToggleGroupItem>
                <ToggleGroupItem value="EGRESO" className="gap-2 flex-1 data-[state=on]:bg-red-100 data-[state=on]:text-red-700">
                  <MinusCircle className="h-4 w-4" />
                  Egreso
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Categoría */}
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría *</Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                required
              >
                <SelectTrigger id="categoria">
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS[formData.tipo].map((cat) => (
                    <SelectItem
                      key={cat.value}
                      value={cat.value}
                      className={'destacado' in cat && cat.destacado ? 'font-semibold text-amber-700 bg-amber-50' : ''}
                    >
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Alerta y campos especiales para Retiro Administrativo */}
            {esRetiroAdministrativo && (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg space-y-3">
                <div className="flex gap-2 items-start">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">Retiro de Dinero a Gerencia</p>
                    <p className="text-xs mt-1">Este movimiento quedará registrado en el reporte de retiros administrativos.</p>
                  </div>
                </div>

                {/* Quién recibe el dinero */}
                <div className="space-y-1">
                  <Label htmlFor="receptor" className="text-amber-800">¿Quién recibe el dinero? *</Label>
                  <Input
                    id="receptor"
                    placeholder="Nombre completo de quien recibe"
                    value={formData.receptor_nombre}
                    onChange={(e) => setFormData({ ...formData, receptor_nombre: e.target.value })}
                    required={esRetiroAdministrativo}
                    className="bg-white"
                  />
                </div>
              </div>
            )}



            {/* Moneda y Monto */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="moneda">Moneda *</Label>
                <Select
                  value={formData.moneda}
                  onValueChange={(value) => setFormData({ ...formData, moneda: value as 'PEN' | 'USD' })}
                >
                  <SelectTrigger id="moneda">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PEN">S/ Soles</SelectItem>
                    <SelectItem value="USD">$ Dólares</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="monto">Monto *</Label>
                <Input
                  id="monto"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={formData.monto}
                  onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Motivo */}
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo / Descripción *</Label>
              <Textarea
                id="motivo"
                placeholder={esRetiroAdministrativo
                  ? "Detalle adicional del retiro..."
                  : "Describe el motivo del movimiento..."
                }
                value={formData.motivo}
                onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                required
                minLength={5}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo 5 caracteres
              </p>
            </div>

            {/* Referencia (opcional) */}
            <div className="space-y-2">
              <Label htmlFor="referencia">Comprobante Referencia (Opcional)</Label>
              <Input
                id="referencia"
                placeholder="Ej: B001-00000123"
                value={formData.comprobante_referencia}
                onChange={(e) => setFormData({ ...formData, comprobante_referencia: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.monto || !formData.motivo || formData.motivo.length < 5 || !formData.categoria}
              className={esRetiroAdministrativo ? 'bg-amber-600 hover:bg-amber-700' : ''}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                'Registrar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
