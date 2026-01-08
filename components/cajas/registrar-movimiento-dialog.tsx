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
import { PlusCircle, MinusCircle, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function RegistrarMovimientoDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    tipo: 'INGRESO' as 'INGRESO' | 'EGRESO',
    categoria: '',
    moneda: 'PEN' as 'PEN' | 'USD',
    monto: '',
    motivo: '',
    comprobante_referencia: ''
  })
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await registrarMovimiento({
        tipo: formData.tipo,
        categoria: formData.categoria || undefined,
        moneda: formData.moneda,
        monto: parseFloat(formData.monto),
        motivo: formData.motivo,
        comprobante_referencia: formData.comprobante_referencia || undefined
      })

      if (result.success) {
        toast.success('Movimiento registrado', {
          description: `${formData.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'} de ${formData.moneda === 'PEN' ? 'S/' : '$'} ${formData.monto}`,
        })
        setOpen(false)
        setFormData({
          tipo: 'INGRESO',
          categoria: '',
          moneda: 'PEN',
          monto: '',
          motivo: '',
          comprobante_referencia: ''
        })
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

  const categorias = {
    INGRESO: [
      'Propina',
      'Venta Directa',
      'Reembolso',
      'Ajuste',
      'Otro'
    ],
    EGRESO: [
      'Compra de Útiles',
      'Propina a Staff',
      'Gastos Menores',
      'Reembolso a Cliente',
      'Ajuste',
      'Otro'
    ]
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Registrar Movimiento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
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
                  if (value) setFormData({ ...formData, tipo: value as 'INGRESO' | 'EGRESO', categoria: '' })
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
              <Label htmlFor="categoria">Categoría</Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => setFormData({ ...formData, categoria: value })}
              >
                <SelectTrigger id="categoria">
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categorias[formData.tipo].map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              <Label htmlFor="motivo">Motivo *</Label>
              <Textarea
                id="motivo"
                placeholder="Describe el motivo del movimiento..."
                value={formData.motivo}
                onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                required
                minLength={5}
                rows={3}
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
              disabled={loading || !formData.monto || !formData.motivo || formData.motivo.length < 5}
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
