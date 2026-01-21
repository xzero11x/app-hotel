'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Eye, FileText, Download, XCircle, Receipt, FileSpreadsheet, FileMinus, Ticket, CreditCard, Smartphone, Building2, Banknote, ExternalLink, RefreshCw } from 'lucide-react'
import { DataTableColumnHeader } from '@/components/tables/data-table-column-header'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export type Comprobante = {
  id: string
  fecha_emision: string
  tipo_comprobante: 'BOLETA' | 'FACTURA' | 'NOTA_CREDITO' | 'TICKET_INTERNO'
  numero_completo: string
  cliente_nombre: string
  cliente_doc: string
  contexto: string
  estado_sunat: 'PENDIENTE' | 'ACEPTADO' | 'RECHAZADO' | 'ANULADO'
  total_venta: number
  moneda: string
  emisor_nombre: string
  metodo_pago?: string
  reserva_id?: string
  codigo_reserva?: string
  pdf_url?: string | null
  xml_url?: string | null
  cdr_url?: string | null
}

const formatCurrency = (amount: number, currency: string = 'PEN') => {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: currency,
  }).format(amount)
}

export const comprobantesColumns: ColumnDef<Comprobante>[] = [
  {
    id: 'comprobante',
    accessorFn: (row) => `${row.numero_completo} ${format(new Date(row.fecha_emision), 'dd/MM/yyyy HH:mm', { locale: es })}`,
    header: 'Comprobante',
    cell: ({ row }) => {
      const comprobante = row.original
      return (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono font-medium">{comprobante.numero_completo}</span>
          <div className="flex items-center gap-1.5">
            <FileText className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {format(new Date(comprobante.fecha_emision), "dd/MM/yyyy HH:mm", { locale: es })}
            </span>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: 'tipo_comprobante',
    header: 'Tipo',
    cell: ({ row }) => {
      const tipo = row.getValue('tipo_comprobante') as string
      const iconMap: Record<string, any> = {
        'BOLETA': Receipt,
        'FACTURA': FileSpreadsheet,
        'NOTA_CREDITO': FileMinus,
        'TICKET_INTERNO': Ticket
      }
      const Icon = iconMap[tipo] || Receipt
      return (
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{tipo.replace('_', ' ')}</span>
        </div>
      )
    },
  },
  {
    id: 'cliente',
    accessorFn: (row) => `${row.cliente_nombre} ${row.cliente_doc}`,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" />,
    cell: ({ row }) => {
      const comprobante = row.original
      return (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{comprobante.cliente_nombre}</span>
          <span className="text-xs text-muted-foreground">DNI: {comprobante.cliente_doc}</span>
        </div>
      )
    },
  },
  {
    id: 'reserva',
    accessorKey: 'codigo_reserva',
    header: 'Reserva',
    cell: ({ row, table }) => {
      const comprobante = row.original
      const meta = table.options.meta as any

      if (!comprobante.reserva_id || !comprobante.codigo_reserva) {
        return (
          <span className="text-xs text-muted-foreground italic">Venta directa</span>
        )
      }

      return (
        <Button
          variant="link"
          className="h-auto p-0 font-mono text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          onClick={(e) => {
            e.stopPropagation()
            meta?.onVerReserva?.(comprobante.reserva_id)
          }}
        >
          {comprobante.codigo_reserva}
          <ExternalLink className="ml-1 h-3 w-3" />
        </Button>
      )
    },
  },
  {
    id: 'metodo_pago',
    accessorKey: 'metodo_pago',
    header: 'Método Pago',
    cell: ({ row }) => {
      const metodo = row.original.metodo_pago || 'EFECTIVO'
      const iconMap: Record<string, any> = {
        'EFECTIVO': Banknote,
        'TARJETA': CreditCard,
        'YAPE': Smartphone,
        'PLIN': Smartphone,
        'TRANSFERENCIA': Building2
      }
      const Icon = iconMap[metodo] || Banknote
      return (
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span>{metodo}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'total_venta',
    header: () => (
      <div className="text-right font-medium">Total</div>
    ),
    cell: ({ row }) => {
      const total = row.getValue('total_venta') as number
      const moneda = row.original.moneda
      return (
        <div className="text-right font-medium">
          {formatCurrency(total, moneda)}
        </div>
      )
    },
  },
  {
    accessorKey: 'estado_sunat',
    header: 'SUNAT',
    cell: ({ row, table }) => {
      const estado = row.getValue('estado_sunat') as string
      const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string; label: string }> = {
        'PENDIENTE': { variant: 'secondary', label: 'Pendiente' },
        'ACEPTADO': { variant: 'secondary', className: 'bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600', label: 'Aceptado' },
        'RECHAZADO': { variant: 'destructive', label: 'Rechazado' },
        'ANULADO': { variant: 'outline', label: 'Anulado' }
      }

      const config = variants[estado] || { variant: 'outline' as const, label: estado }
      const meta = table.options.meta as any

      return (
        <div className="flex items-center gap-2">
          <Badge variant={config.variant} className={config.className || ''}>
            {config.label}
          </Badge>
          {(estado === 'PENDIENTE' || estado === 'RECHAZADO') && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title="Actualizar estado desde SUNAT"
              onClick={(e) => {
                e.stopPropagation()
                meta?.onActualizarEstado?.(row.original.id)
              }}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        </div>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row, table }) => {
      const comprobante = row.original
      const meta = table.options.meta as any

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Abrir menú</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => meta?.onVerDetalle?.(comprobante.id)}>
              <Eye className="mr-2 h-4 w-4" />
              Ver Detalle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => meta?.onDescargarPDF?.(comprobante.id)}>
              <Download className="mr-2 h-4 w-4" />
              Descargar PDF
            </DropdownMenuItem>
            {(comprobante.estado_sunat === 'ACEPTADO' || comprobante.estado_sunat === 'PENDIENTE') && comprobante.tipo_comprobante !== 'NOTA_CREDITO' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => meta?.onAnular?.(comprobante.id)}
                  className="text-orange-600"
                >
                  <FileMinus className="mr-2 h-4 w-4" />
                  Emitir Nota de Crédito
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
