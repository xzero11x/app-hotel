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
import { toast } from 'sonner'
import { abrirCaja, getCajasDisponibles } from '@/lib/actions/cajas'
import { Wallet, Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function AbrirCajaDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cajas, setCajas] = useState<any[]>([])
  const [formData, setFormData] = useState({
    caja_id: '',
    monto_apertura: '',
    monto_apertura_usd: ''
  })
  const router = useRouter()

  useEffect(() => {
    if (open) {
      loadCajas()
    }
  }, [open])

  const loadCajas = async () => {
    const result = await getCajasDisponibles()
    if (result.success) {
      setCajas(result.data)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await abrirCaja({
        caja_id: formData.caja_id,
        monto_apertura: parseFloat(formData.monto_apertura),
        monto_apertura_usd: formData.monto_apertura_usd ? parseFloat(formData.monto_apertura_usd) : 0
      })

      if (result.success) {
        toast.success('Caja abierta', {
          description: 'Tu turno ha comenzado correctamente',
        })
        setOpen(false)
        // Forzar recarga completa para actualizar el Server Component
        window.location.href = '/cajas'
      } else {
        toast.error('Error', {
          description: result.error || 'No se pudo abrir la caja',
        })
      }
    } catch (error) {
      toast.error('Error', {
        description: 'Ocurrió un error al abrir la caja',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2">
          <Wallet className="h-5 w-5" />
          Abrir Caja
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Abrir Caja</DialogTitle>
            <DialogDescription>
              Inicia un nuevo turno. Cuenta el dinero físico antes de comenzar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="caja">Caja *</Label>
              <Select
                value={formData.caja_id}
                onValueChange={(value) => setFormData({ ...formData, caja_id: value })}
                required
              >
                <SelectTrigger id="caja">
                  <SelectValue placeholder="Selecciona una caja" />
                </SelectTrigger>
                <SelectContent>
                  {cajas.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No hay cajas disponibles
                    </div>
                  ) : (
                    cajas.map((caja) => (
                      <SelectItem key={caja.id} value={caja.id}>
                        {caja.nombre}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monto_pen">Monto Inicial PEN *</Label>
              <Input
                id="monto_pen"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.monto_apertura}
                onChange={(e) => setFormData({ ...formData, monto_apertura: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Cuenta el dinero físico en soles
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monto_usd">Monto Inicial USD (Opcional)</Label>
              <Input
                id="monto_usd"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.monto_apertura_usd}
                onChange={(e) => setFormData({ ...formData, monto_apertura_usd: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !formData.caja_id || !formData.monto_apertura}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Abriendo...
                </>
              ) : (
                'Abrir Caja'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
