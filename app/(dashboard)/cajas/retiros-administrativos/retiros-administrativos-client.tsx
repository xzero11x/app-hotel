'use client'

import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { getReporteRetirosAdministrativos, type ResumenRetiros } from '@/lib/actions/reportes'
import { CalendarIcon, Download, TrendingDown, Banknote, User, Briefcase, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import * as XLSX from 'xlsx'

export function RetirosAdministrativosClient() {
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<ResumenRetiros | null>(null)
    const [fechaInicio, setFechaInicio] = useState<Date>(startOfMonth(new Date()))
    const [fechaFin, setFechaFin] = useState<Date>(endOfMonth(new Date()))

    const cargarDatos = async () => {
        setLoading(true)
        const result = await getReporteRetirosAdministrativos({
            fechaInicio,
            fechaFin
        })
        if (result.success && result.data) {
            setData(result.data)
        }
        setLoading(false)
    }

    useEffect(() => {
        cargarDatos()
    }, [fechaInicio, fechaFin])

    const handleExportExcel = () => {
        if (!data?.retiros.length) return

        const dataForExcel = data.retiros.map(r => ({
            'Fecha': format(new Date(r.fecha), 'dd/MM/yyyy HH:mm'),
            'Monto': r.monto,
            'Moneda': r.moneda,
            'Receptor': r.receptor,
            'Registrado por': r.cajero,
            'Caja': r.caja_nombre,
            'Motivo': r.motivo
        }))

        // Añadir fila de totales
        dataForExcel.push({
            'Fecha': 'TOTALES',
            'Monto': data.total_pen,
            'Moneda': 'PEN',
            'Receptor': '',
            'Registrado por': '',
            'Caja': '',
            'Motivo': ''
        })
        if (data.total_usd > 0) {
            dataForExcel.push({
                'Fecha': '',
                'Monto': data.total_usd,
                'Moneda': 'USD',
                'Receptor': '',
                'Registrado por': '',
                'Caja': '',
                'Motivo': ''
            })
        }

        const ws = XLSX.utils.json_to_sheet(dataForExcel)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Retiros Administrativos')

        const fileName = `retiros_administrativos_${format(fechaInicio, 'yyyy-MM-dd')}_${format(fechaFin, 'yyyy-MM-dd')}.xlsx`
        XLSX.writeFile(wb, fileName)
    }

    const setMesActual = () => {
        setFechaInicio(startOfMonth(new Date()))
        setFechaFin(endOfMonth(new Date()))
    }

    const setMesAnterior = () => {
        const mesAnterior = subMonths(new Date(), 1)
        setFechaInicio(startOfMonth(mesAnterior))
        setFechaFin(endOfMonth(mesAnterior))
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/cajas">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">
                            Retiros Administrativos
                        </h1>
                        <p className="text-muted-foreground">
                            Reporte consolidado de retiros de dinero por dueño/gerencia
                        </p>
                    </div>
                </div>
                <Button onClick={handleExportExcel} disabled={!data?.retiros.length} className="gap-2">
                    <Download className="h-4 w-4" />
                    Exportar Excel
                </Button>
            </div>

            {/* Filtros de fecha */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Periodo</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Fecha Inicio */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <CalendarIcon className="h-4 w-4" />
                                    Desde: {format(fechaInicio, 'dd/MM/yyyy', { locale: es })}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={fechaInicio}
                                    onSelect={(date) => date && setFechaInicio(date)}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>

                        {/* Fecha Fin */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <CalendarIcon className="h-4 w-4" />
                                    Hasta: {format(fechaFin, 'dd/MM/yyyy', { locale: es })}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={fechaFin}
                                    onSelect={(date) => date && setFechaFin(date)}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>

                        <div className="flex gap-2">
                            <Button variant="secondary" size="sm" onClick={setMesActual}>
                                Este Mes
                            </Button>
                            <Button variant="secondary" size="sm" onClick={setMesAnterior}>
                                Mes Anterior
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* KPIs */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <Card key={i}>
                            <CardHeader>
                                <Skeleton className="h-4 w-24" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-8 w-32" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : data && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription className="flex items-center gap-2">
                                <Banknote className="h-4 w-4" />
                                Total Retirado (PEN)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold text-red-600">
                                S/ {data.total_pen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription className="flex items-center gap-2">
                                <Banknote className="h-4 w-4" />
                                Total Retirado (USD)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold text-red-600">
                                $ {data.total_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription className="flex items-center gap-2">
                                <TrendingDown className="h-4 w-4" />
                                Cantidad de Retiros
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold">{data.cantidad}</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Tabla de Retiros */}
            <Card>
                <CardHeader>
                    <CardTitle>Detalle de Retiros</CardTitle>
                    <CardDescription>
                        Lista de todos los retiros registrados en el periodo
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-2">
                            {[1, 2, 3, 4, 5].map(i => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : data?.retiros.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No hay retiros administrativos en este periodo</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Monto</TableHead>
                                    <TableHead>Receptor</TableHead>
                                    <TableHead>Registrado por</TableHead>
                                    <TableHead>Caja</TableHead>
                                    <TableHead>Motivo</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data?.retiros.map((retiro) => (
                                    <TableRow key={retiro.id}>
                                        <TableCell>
                                            {format(new Date(retiro.fecha), 'dd/MM/yyyy HH:mm', { locale: es })}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="destructive" className="font-mono">
                                                {retiro.moneda === 'PEN' ? 'S/' : '$'} {retiro.monto.toFixed(2)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                {retiro.receptor}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {retiro.cajero}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {retiro.caja_nombre}
                                        </TableCell>
                                        <TableCell className="max-w-[300px] truncate" title={retiro.motivo}>
                                            {retiro.motivo}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
