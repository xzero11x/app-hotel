'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { getDetalleKPI } from '@/lib/actions/rack'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { RackKPIs } from '@/lib/actions/rack'

type Props = {
  kpis: RackKPIs
}

export function KpiChips({ kpis }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<'llegadas' | 'salidas' | 'sucias' | null>(null)
  const [detalles, setDetalles] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const handleClick = async (type: 'llegadas' | 'salidas' | 'sucias') => {
    setDialogType(type)
    setDialogOpen(true)
    setLoading(true)
    
    try {
      const data = await getDetalleKPI(type)
      setDetalles(data)
    } catch (error) {
      console.error('Error al cargar detalles:', error)
      setDetalles([])
    } finally {
      setLoading(false)
    }
  }

  const getDialogTitle = () => {
    if (dialogType === 'llegadas') return 'Check-ins del Día'
    if (dialogType === 'salidas') return 'Check-outs del Día'
    if (dialogType === 'sucias') return 'Habitaciones Sucias'
    return ''
  }

  const getDialogDescription = () => {
    if (dialogType === 'llegadas') return `${kpis.llegadas} llegadas programadas para hoy`
    if (dialogType === 'salidas') return `${kpis.salidas} salidas programadas para hoy`
    if (dialogType === 'sucias') return `${kpis.sucias} habitaciones requieren limpieza`
    return ''
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Badge 
          variant="secondary" 
          className={cn(
            "gap-1 cursor-pointer hover:bg-secondary/80 transition-colors",
            kpis.llegadas > 0 && "bg-green-500/20 text-green-700 dark:text-green-400"
          )}
          onClick={() => handleClick('llegadas')}
        >
          <ArrowDown className="h-3 w-3" />
          Llegadas: {kpis.llegadas}
        </Badge>
        
        <Badge 
          variant="secondary" 
          className={cn(
            "gap-1 cursor-pointer hover:bg-secondary/80 transition-colors",
            kpis.salidas > 0 && "bg-blue-500/20 text-blue-700 dark:text-blue-400"
          )}
          onClick={() => handleClick('salidas')}
        >
          <ArrowUp className="h-3 w-3" />
          Salidas: {kpis.salidas}
        </Badge>
        
        <Badge 
          variant="secondary" 
          className={cn(
            "gap-1 cursor-pointer hover:bg-secondary/80 transition-colors",
            kpis.sucias > 0 && "bg-red-500/20 text-red-700 dark:text-red-400"
          )}
          onClick={() => handleClick('sucias')}
        >
          <Trash2 className="h-3 w-3" />
          Sucias: {kpis.sucias}
        </Badge>
      </div>

      {/* Modal de detalles */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[600px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
            <DialogDescription>{getDialogDescription()}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {loading ? (
              <>  
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </>
            ) : detalles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay elementos para mostrar
              </div>
            ) : (
              detalles.map((item, index) => (
                <div
                  key={index}
                  className="p-3 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{item.titulo}</div>
                      <div className="text-sm text-muted-foreground">{item.subtitulo}</div>
                    </div>
                    {item.badge && (
                      <Badge variant="secondary">{item.badge}</Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
