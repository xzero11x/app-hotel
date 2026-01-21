'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { getLibroHuespedes, type LibroHuespedesItem } from '@/lib/actions/reportes'
import { format, startOfMonth, endOfMonth, setYear, setMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { Printer, Search, FileText, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

export function RegistroLegalClient() {
    const [mes, setMes] = useState<string>(new Date().getMonth().toString())
    const [anio, setAnio] = useState<string>(new Date().getFullYear().toString())
    const [datos, setDatos] = useState<LibroHuespedesItem[]>([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)

    const generarReporte = async () => {
        setLoading(true)
        try {
            const fechaBase = setMonth(setYear(new Date(), parseInt(anio)), parseInt(mes))
            const inicio = startOfMonth(fechaBase)
            const fin = endOfMonth(fechaBase)

            const result = await getLibroHuespedes({
                fechaInicio: inicio,
                fechaFin: fin
            })

            if (result.success && result.data) {
                setDatos(result.data)
                setSearched(true)
                if (result.data.length === 0) {
                    toast.info('No se encontraron registros para este periodo')
                }
            } else {
                toast.error('Error al generar el reporte')
            }
        } catch (error) {
            console.error(error)
            toast.error('Error inesperado')
        } finally {
            setLoading(false)
        }
    }

    const handlePrint = () => {
        window.print()
    }

    const handleExportExcel = () => {
        if (datos.length === 0) return

        // Mapear datos para Excel con formato plano
        // Orden: Hab, Fecha, Hora, Salida, Tarifa, Total, Huésped, Tipo Doc, N° Doc, Nacionalidad, Procedencia
        const dataForExcel = datos.map(fila => ({
            'N° Hab': fila.habitacion,
            'Fecha Ingreso': format(new Date(fila.fecha_ingreso), 'dd/MM/yyyy'),
            'Hora': format(new Date(fila.fecha_ingreso), 'HH:mm'),
            'Salida Probable': format(new Date(fila.fecha_salida), 'dd/MM/yyyy'),
            'Tarifa': fila.tarifa_numero,    // Número para que Excel lo reconozca
            'Total': fila.total,              // Número: tarifa × días
            'Huésped': fila.nombre_completo,
            'Tipo Doc': fila.tipo_documento,
            'N° Doc': fila.numero_documento,
            'Nacionalidad': fila.nacionalidad,
            'Procedencia': fila.departamento,
        }))

        // Crear libro y hoja
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(dataForExcel)

        // Ajustar anchos de columna automáticamente
        const colWidths = [
            { wch: 8 },  // Hab
            { wch: 12 }, // Fecha
            { wch: 8 },  // Hora
            { wch: 12 }, // Salida
            { wch: 10 }, // Tarifa
            { wch: 12 }, // Total
            { wch: 35 }, // Huesped
            { wch: 10 }, // Tipo
            { wch: 15 }, // Doc
            { wch: 15 }, // Nac
            { wch: 15 }, // Proc
        ]
        ws['!cols'] = colWidths

        XLSX.utils.book_append_sheet(wb, ws, 'Libro de Huespedes')

        // Nombre del archivo
        const mesNombre = meses[parseInt(mes)].label
        const fileName = `Libro_Huespedes_${mesNombre}_${anio}.xlsx`

        XLSX.writeFile(wb, fileName)
        toast.success("Excel exportado correctamente")
    }

    const anios = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString())
    const meses = [
        { value: '0', label: 'Enero' },
        { value: '1', label: 'Febrero' },
        { value: '2', label: 'Marzo' },
        { value: '3', label: 'Abril' },
        { value: '4', label: 'Mayo' },
        { value: '5', label: 'Junio' },
        { value: '6', label: 'Julio' },
        { value: '7', label: 'Agosto' },
        { value: '8', label: 'Septiembre' },
        { value: '9', label: 'Octubre' },
        { value: '10', label: 'Noviembre' },
        { value: '11', label: 'Diciembre' },
    ]

    return (
        <div className="space-y-6 sm:space-y-8">
            {/* Header y Controles Unificados */}
            <div className="flex flex-col gap-4 sm:gap-6 print:hidden border-b pb-4 sm:pb-6">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Libro de Huéspedes</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                        Reporte legal para notaría (Hojas Sueltas)
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-md border">
                        <Select value={mes} onValueChange={setMes}>
                            <SelectTrigger className="h-9 w-full sm:w-[140px] border-0 bg-transparent focus:ring-0 shadow-none text-xs sm:text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {meses.map((m) => (
                                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div className="w-px h-5 bg-border mx-1" />

                        <Select value={anio} onValueChange={setAnio}>
                            <SelectTrigger className="h-9 w-full sm:w-[90px] border-0 bg-transparent focus:ring-0 shadow-none text-xs sm:text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {anios.map((a) => (
                                    <SelectItem key={a} value={a}>{a}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Button onClick={generarReporte} disabled={loading} className="h-10 px-4 sm:px-6 shadow-sm text-xs sm:text-sm">
                        {loading ? 'Generando...' : 'Generar Reporte'}
                    </Button>

                    {datos.length > 0 && (
                        <div className="flex items-center gap-2 sm:border-l sm:pl-4 sm:ml-2">
                            <Button variant="outline" size="icon" onClick={handleExportExcel} className="h-10 w-10 text-green-700 hover:text-green-800 hover:bg-green-50 border-green-200" title="Exportar Excel">
                                <FileSpreadsheet className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={handlePrint} className="h-10 w-10" title="Imprimir">
                                <Printer className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Vista Previa / Impresión */}
            {searched && (
                <div className="print:block min-h-[400px] sm:min-h-[500px]">
                    {/* Cabecera del Documento Legal */}
                    <div className="hidden print:block mb-6 sm:mb-8 text-center">
                        <h1 className="text-lg sm:text-xl font-bold uppercase tracking-widest border-b-2 border-black pb-2 inline-block">
                            Registro de Huéspedes
                        </h1>
                        <p className="text-xs sm:text-sm mt-2">
                            Periodo: {meses[parseInt(mes)].label.toUpperCase()} {anio}
                        </p>
                    </div>

                    <div className="overflow-x-auto -mx-3 sm:mx-0">
                        <table className="w-full text-[10px] sm:text-sm border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-muted print:bg-transparent">
                                    <th className="border border-black p-1 sm:p-2 text-center w-10 sm:w-12 font-semibold">Hab</th>
                                    <th className="border border-black p-1 sm:p-2 text-center w-16 sm:w-20 font-semibold">Fecha</th>
                                    <th className="border border-black p-1 sm:p-2 text-center w-12 sm:w-16 font-semibold">Hora</th>
                                    <th className="border border-black p-1 sm:p-2 text-center w-16 sm:w-20 font-semibold">Salida</th>
                                    <th className="border border-black p-1 sm:p-2 text-right w-14 sm:w-16 font-semibold">Tarifa</th>
                                    <th className="border border-black p-1 sm:p-2 text-right w-16 sm:w-20 font-semibold">Total</th>
                                    <th className="border border-black p-1 sm:p-2 text-left font-semibold">Huésped</th>
                                    <th className="border border-black p-1 sm:p-2 text-center w-14 sm:w-16 font-semibold">Tipo</th>
                                    <th className="border border-black p-1 sm:p-2 text-center w-20 sm:w-24 font-semibold">N° Doc</th>
                                    <th className="border border-black p-1 sm:p-2 text-center w-20 sm:w-24 font-semibold">Nacionalidad</th>
                                    <th className="border border-black p-1 sm:p-2 text-center w-20 sm:w-24 font-semibold">Procedencia</th>
                                </tr>
                            </thead>
                            <tbody>
                                {datos.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="border border-black p-6 sm:p-8 text-center text-muted-foreground italic text-xs sm:text-sm">
                                            No hay registros de ingreso en este periodo.
                                        </td>
                                    </tr>
                                ) : (
                                    datos.map((fila, i) => (
                                        <tr key={i} className="print:break-inside-avoid">
                                            <td className="border border-black p-1 sm:p-1.5 text-center font-bold">{fila.habitacion}</td>
                                            <td className="border border-black p-1 sm:p-1.5 text-center">
                                                {format(new Date(fila.fecha_ingreso), 'dd/MM/yy')}
                                            </td>
                                            <td className="border border-black p-1 sm:p-1.5 text-center">
                                                {format(new Date(fila.fecha_ingreso), 'HH:mm')}
                                            </td>
                                            <td className="border border-black p-1 sm:p-1.5 text-center">
                                                {format(new Date(fila.fecha_salida), 'dd/MM/yy')}
                                            </td>
                                            <td className="border border-black p-1 sm:p-1.5 text-right">
                                                S/{fila.tarifa_numero.toFixed(2)}
                                            </td>
                                            <td className="border border-black p-1 sm:p-1.5 text-right font-medium">
                                                S/{fila.total.toFixed(2)}
                                            </td>
                                            <td className="border border-black p-1 sm:p-1.5 font-medium truncate max-w-[150px] sm:max-w-[200px]">
                                                {fila.nombre_completo}
                                            </td>
                                            <td className="border border-black p-1 sm:p-1.5 text-center text-[10px] sm:text-xs">
                                                {fila.tipo_documento}
                                            </td>
                                            <td className="border border-black p-1 sm:p-1.5 text-center text-[10px] sm:text-xs">
                                                {fila.numero_documento}
                                            </td>
                                            <td className="border border-black p-1 sm:p-1.5 text-center text-[9px] sm:text-xs">
                                                {fila.nacionalidad}
                                            </td>
                                            <td className="border border-black p-1 sm:p-1.5 text-center text-[9px] sm:text-xs">
                                                {fila.departamento}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-6 sm:mt-8 hidden print:block text-xs text-center text-gray-500">
                        <p>Página legalizada N° _______</p>
                    </div>
                </div>
            )}

            {/* Mensaje inicial */}
            {!searched && (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground border-2 border-dashed rounded-lg">
                    <FileText className="h-12 w-12 mb-4 opacity-20" />
                    <p>Selecciona un mes y año para generar el libro de huéspedes.</p>
                </div>
            )}

            <style jsx global>{`
        @media print {
          @page {
            margin: 1.5cm;
            size: A4 landscape;
          }
          body {
            background: white;
          }
          /* Ocultar elementos de navegación del layout principal si no tienen clase print:hidden */
          nav, aside, header {
            display: none !important;
          }
        }
      `}</style>
        </div>
    )
}
