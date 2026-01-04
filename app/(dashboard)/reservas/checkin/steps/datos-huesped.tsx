'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { NacionalidadCombobox } from '@/components/ui/nacionalidad-combobox'
import { ChevronLeft, ChevronRight, Search, Plus, X, UserCheck, CalendarIcon, Users, Building2, Mail, Phone, MapPin } from 'lucide-react'
import { buscarHuespedPorDocumento, crearOActualizarHuesped } from '@/lib/actions/checkin'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface DatosHuespedProps {
    habitacionData: any
    initialData: any
    onNext: (data: any) => void
    onBack: () => void
}

export function DatosHuesped({ habitacionData, initialData, onNext, onBack }: DatosHuespedProps) {
    const [loading, setLoading] = useState(false)
    const [esClienteFrecuente, setEsClienteFrecuente] = useState(false)

    // Fechas y número de huéspedes
    const [fechaIngreso, setFechaIngreso] = useState<Date>(
        initialData?.fecha_ingreso ? new Date(initialData.fecha_ingreso) : new Date()
    )
    const [fechaSalida, setFechaSalida] = useState<Date | undefined>(
        initialData?.fecha_salida_prevista ? new Date(initialData.fecha_salida_prevista) : undefined
    )
    const [numHuespedes, setNumHuespedes] = useState(initialData?.num_huespedes || 1)

    // Datos del huésped principal
    const [tipoDoc, setTipoDoc] = useState(initialData?.tipo_doc || 'DNI')
    const [numDoc, setNumDoc] = useState(initialData?.num_doc || '')
    const [nombres, setNombres] = useState(initialData?.nombres || '')
    const [apellidos, setApellidos] = useState(initialData?.apellidos || '')
    const [email, setEmail] = useState(initialData?.email || '')
    const [telefono, setTelefono] = useState(initialData?.telefono || '')
    const [nacionalidad, setNacionalidad] = useState(initialData?.nacionalidad || 'Peruana')
    const [ciudadProcedencia, setCiudadProcedencia] = useState(initialData?.ciudad_procedencia || '')
    const [razonSocial, setRazonSocial] = useState(initialData?.razon_social || '')

    // Acompañantes
    const [acompanantes, setAcompanantes] = useState<any[]>(initialData?.acompanantes || [])
    const [nuevoAcomp, setNuevoAcomp] = useState({
        nombres: '',
        apellidos: '',
        tipo_doc: 'DNI',
        num_doc: '',
        nacionalidad: 'Peruana',
    })

    async function buscarPorDNI() {
        if (!numDoc) return

        setLoading(true)
        const result = await buscarHuespedPorDocumento(numDoc, tipoDoc)
        setLoading(false)

        if (result.huesped) {
            const h = result.huesped
            setNombres(h.nombres || '')
            setApellidos(h.apellidos || '')
            setEmail(h.email || '')
            setTelefono(h.telefono || '')
            setNacionalidad(h.nacionalidad || 'Peruana')
            setCiudadProcedencia(h.ciudad_procedencia || '')
            setRazonSocial(h.razon_social || '')
            setEsClienteFrecuente(h.es_frecuente || false)
        } else {
            setEsClienteFrecuente(false)
        }
    }

    function agregarAcompanante() {
        if (!nuevoAcomp.nombres || !nuevoAcomp.apellidos || !nuevoAcomp.num_doc) {
            alert('Completa todos los campos del acompañante')
            return
        }

        setAcompanantes([...acompanantes, { ...nuevoAcomp }])
        setNuevoAcomp({
            nombres: '',
            apellidos: '',
            tipo_doc: 'DNI',
            num_doc: '',
            nacionalidad: 'Peruana',
        })
    }

    function eliminarAcompanante(index: number) {
        setAcompanantes(acompanantes.filter((_, i) => i !== index))
    }

    async function handleContinuar() {
        if (!tipoDoc || !numDoc || !nombres || !apellidos) {
            alert('Por favor completa los campos obligatorios')
            return
        }

        if (!email) {
            alert('El email es requerido para facturación electrónica')
            return
        }

        if (!fechaSalida) {
            alert('Selecciona la fecha de salida')
            return
        }

        setLoading(true)

        const result = await crearOActualizarHuesped({
            tipo_doc: tipoDoc,
            num_doc: numDoc,
            nombres,
            apellidos,
            email,
            telefono,
            nacionalidad,
            ciudad_procedencia: ciudadProcedencia,
            razon_social: tipoDoc === 'RUC' ? razonSocial : null,
        })

        setLoading(false)

        if (result.error) {
            alert(result.error)
            return
        }

        onNext({
            huesped_id: result.huesped.id,
            tipo_doc: tipoDoc,
            num_doc: numDoc,
            nombres,
            apellidos,
            email,
            telefono,
            nacionalidad,
            ciudad_procedencia: ciudadProcedencia,
            fecha_ingreso: fechaIngreso.toISOString(),
            fecha_salida_prevista: fechaSalida.toISOString(),
            num_huespedes: numHuespedes,
            acompanantes,
        })
    }

    return (
        <>
            <div className="space-y-6">
                {/* Header con info de habitación */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold">Datos del Huésped</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Habitación {habitacionData?.habitacion_numero} • {habitacionData?.categoria_nombre}
                        </p>
                    </div>
                    {esClienteFrecuente && (
                        <Badge variant="outline" className="bg-green-500/10 border-green-500/20 text-green-700">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Cliente Frecuente
                        </Badge>
                    )}
                </div>

                {/* Detalles de estadía - más compacto */}
                <div className="grid gap-3 sm:grid-cols-3 p-4 rounded-lg border bg-muted/30">
                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Fecha de ingreso</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full justify-start font-normal">
                                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                    <span className="text-sm">{format(fechaIngreso, 'dd/MM/yyyy', { locale: es })}</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={fechaIngreso}
                                    onSelect={(date) => date && setFechaIngreso(date)}
                                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Fecha de salida</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        'w-full justify-start font-normal',
                                        !fechaSalida && 'text-muted-foreground'
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                    <span className="text-sm">
                                        {fechaSalida ? format(fechaSalida, 'dd/MM/yyyy', { locale: es }) : 'Selecciona'}
                                    </span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={fechaSalida}
                                    onSelect={setFechaSalida}
                                    disabled={(date) => date <= fechaIngreso}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">N° de huéspedes</Label>
                        <div className="relative">
                            <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                type="number"
                                min="1"
                                max={habitacionData?.capacidad_max || 10}
                                value={numHuespedes}
                                onChange={(e) => setNumHuespedes(parseInt(e.target.value) || 1)}
                                className="pl-8 h-9 text-sm"
                            />
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Búsqueda rápida */}
                <div>
                    <h3 className="font-medium mb-3">Buscar Huésped</h3>
                    <div className="flex gap-3">
                        <Select value={tipoDoc} onValueChange={setTipoDoc}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="DNI">DNI</SelectItem>
                                <SelectItem value="CE">CE</SelectItem>
                                <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                                <SelectItem value="RUC">RUC</SelectItem>
                            </SelectContent>
                        </Select>
                        <Input
                            value={numDoc}
                            onChange={(e) => setNumDoc(e.target.value)}
                            placeholder="Número de documento"
                            className="flex-1"
                            onKeyDown={(e) => e.key === 'Enter' && buscarPorDNI()}
                        />
                        <Button onClick={buscarPorDNI} disabled={loading || !numDoc}>
                            <Search className="h-4 w-4 mr-2" />
                            {loading ? 'Buscando...' : 'Buscar'}
                        </Button>
                    </div>
                </div>

                {/* Datos personales - grid mejorado */}
                <div>
                    <h3 className="font-medium mb-3">Información Personal</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label className="text-sm">
                                Nombres <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                value={nombres}
                                onChange={(e) => setNombres(e.target.value)}
                                placeholder="Nombres completos"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm">
                                Apellidos <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                value={apellidos}
                                onChange={(e) => setApellidos(e.target.value)}
                                placeholder="Apellidos completos"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5" />
                                Email <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="correo@ejemplo.com"
                            />
                            <p className="text-xs text-muted-foreground">Requerido para factura electrónica</p>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm flex items-center gap-1.5">
                                <Phone className="h-3.5 w-3.5" />
                                Teléfono / Celular
                            </Label>
                            <Input
                                value={telefono}
                                onChange={(e) => setTelefono(e.target.value)}
                                placeholder="999 999 999"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm">
                                Nacionalidad <span className="text-destructive">*</span>
                            </Label>
                            <NacionalidadCombobox
                                value={nacionalidad}
                                onValueChange={setNacionalidad}
                            />
                            <p className="text-xs text-muted-foreground">Importante para exoneración de IGV</p>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5" />
                                Ciudad de Procedencia
                            </Label>
                            <Input
                                value={ciudadProcedencia}
                                onChange={(e) => setCiudadProcedencia(e.target.value)}
                                placeholder="Lima, Arequipa, etc."
                            />
                        </div>
                        {tipoDoc === 'RUC' && (
                            <div className="space-y-2 sm:col-span-2">
                                <Label className="text-sm flex items-center gap-1.5">
                                    <Building2 className="h-3.5 w-3.5" />
                                    Razón Social
                                </Label>
                                <Input
                                    value={razonSocial}
                                    onChange={(e) => setRazonSocial(e.target.value)}
                                    placeholder="Nombre de la empresa"
                                />
                            </div>
                        )}
                    </div>
                </div>

                <Separator />

                {/* Acompañantes */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium">Acompañantes</h3>
                        <Badge variant="secondary">{acompanantes.length}</Badge>
                    </div>

                    {acompanantes.length > 0 && (
                        <div className="space-y-2 mb-4">
                            {acompanantes.map((acomp, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">
                                            {acomp.nombres} {acomp.apellidos}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {acomp.tipo_doc}: {acomp.num_doc} • {acomp.nacionalidad}
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => eliminarAcompanante(index)}
                                        className="h-8 w-8 p-0"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                        <p className="text-sm font-medium">Agregar acompañante</p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            <Input
                                placeholder="Nombres"
                                value={nuevoAcomp.nombres}
                                onChange={(e) =>
                                    setNuevoAcomp({ ...nuevoAcomp, nombres: e.target.value })
                                }
                                className="sm:col-span-2 lg:col-span-1"
                            />
                            <Input
                                placeholder="Apellidos"
                                value={nuevoAcomp.apellidos}
                                onChange={(e) =>
                                    setNuevoAcomp({ ...nuevoAcomp, apellidos: e.target.value })
                                }
                                className="sm:col-span-2 lg:col-span-1"
                            />
                            <Select
                                value={nuevoAcomp.tipo_doc}
                                onValueChange={(value) =>
                                    setNuevoAcomp({ ...nuevoAcomp, tipo_doc: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DNI">DNI</SelectItem>
                                    <SelectItem value="CE">CE</SelectItem>
                                    <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input
                                placeholder="N° Documento"
                                value={nuevoAcomp.num_doc}
                                onChange={(e) =>
                                    setNuevoAcomp({ ...nuevoAcomp, num_doc: e.target.value })
                                }
                            />
                            <NacionalidadCombobox
                                value={nuevoAcomp.nacionalidad}
                                onValueChange={(value) =>
                                    setNuevoAcomp({ ...nuevoAcomp, nacionalidad: value })
                                }
                            />
                        </div>
                        <Button onClick={agregarAcompanante} variant="outline" className="w-full" size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Agregar Acompañante
                        </Button>
                    </div>
                </div>
            </div>

            {/* Bottom Bar Fija */}
            <div className="fixed bottom-0 right-0 left-0 md:left-[var(--sidebar-width)] border-t bg-background z-50">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex justify-between">
                        <Button variant="outline" onClick={onBack}>
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Atrás
                        </Button>
                        <Button onClick={handleContinuar} disabled={loading} size="lg">
                            {loading ? 'Guardando...' : 'Continuar'}
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </>
    )
}
