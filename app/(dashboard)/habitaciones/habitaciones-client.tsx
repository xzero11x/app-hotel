'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { HabitacionDialog } from '@/components/habitaciones/habitacion-dialog'
import { deleteHabitacion, updateEstadoHabitacion } from '@/lib/actions/habitaciones'
import { useRouter } from 'next/navigation'
import {
    Plus,
    Edit2,
    Trash2,
    Bed,
    Users,
    Search,
    LayoutGrid,
    List,
} from 'lucide-react'

interface HabitacionesClientProps {
    habitaciones: any[]
    categorias: any[]
}

const ESTADOS = [
    { value: 'DISPONIBLE', label: 'Disponible', color: 'bg-green-500/10 text-green-700 border-green-200' },
    { value: 'OCUPADA', label: 'Ocupada', color: 'bg-red-500/10 text-red-700 border-red-200' },
    { value: 'MANTENIMIENTO', label: 'Mantenimiento', color: 'bg-yellow-500/10 text-yellow-700 border-yellow-200' },
]

export function CreateButton({ categorias }: { categorias: any[] }) {
    const [dialogOpen, setDialogOpen] = useState(false)

    return (
        <>
            <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Habitación
            </Button>
            <HabitacionDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                habitacion={null}
                categorias={categorias}
            />
        </>
    )
}

export function HabitacionesClient({ habitaciones, categorias }: HabitacionesClientProps) {
    const router = useRouter()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedHabitacion, setSelectedHabitacion] = useState<any>(null)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [habitacionToDelete, setHabitacionToDelete] = useState<any>(null)
    const [filtroEstado, setFiltroEstado] = useState<string>('TODOS')
    const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS')
    const [busqueda, setBusqueda] = useState('')
    const [vistaMode, setVistaMode] = useState<'grid' | 'list'>('grid')

    const habitacionesFiltradas = habitaciones.filter((hab) => {
        const matchEstado = filtroEstado === 'TODOS' || hab.estado_ocupacion === filtroEstado
        const matchCategoria = filtroCategoria === 'TODAS' || hab.categoria_id === filtroCategoria
        const matchBusqueda = busqueda === '' ||
            hab.numero.toLowerCase().includes(busqueda.toLowerCase()) ||
            hab.categorias?.nombre.toLowerCase().includes(busqueda.toLowerCase())
        return matchEstado && matchCategoria && matchBusqueda
    })

    function handleEdit(habitacion: any) {
        setSelectedHabitacion(habitacion)
        setDialogOpen(true)
    }

    function handleDeleteClick(habitacion: any) {
        setHabitacionToDelete(habitacion)
        setDeleteDialogOpen(true)
    }

    async function confirmDelete() {
        if (!habitacionToDelete) return

        const result = await deleteHabitacion(habitacionToDelete.id)

        if (result.error) {
            alert(result.error)
        } else {
            router.refresh()
        }

        setDeleteDialogOpen(false)
        setHabitacionToDelete(null)
    }

    async function handleEstadoChange(habitacionId: string, nuevoEstado: string) {
        await updateEstadoHabitacion(habitacionId, nuevoEstado)
        router.refresh()
    }

    return (
        <div className="space-y-4">
            {/* Barra de búsqueda y filtros */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar habitación..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="pl-9"
                    />
                </div>

                <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="TODOS">Todos los estados</SelectItem>
                        {ESTADOS.map((estado) => (
                            <SelectItem key={estado.value} value={estado.value}>
                                {estado.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="TODAS">Todos los tipos</SelectItem>
                        {categorias.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                                {cat.nombre}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="ml-auto">
                    <ToggleGroup type="single" value={vistaMode} onValueChange={(value) => value && setVistaMode(value as 'grid' | 'list')}>
                        <ToggleGroupItem value="grid" aria-label="Vista en cuadrícula" className="h-9 w-9">
                            <LayoutGrid className="h-4 w-4" />
                        </ToggleGroupItem>
                        <ToggleGroupItem value="list" aria-label="Vista en lista" className="h-9 w-9">
                            <List className="h-4 w-4" />
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>
            </div>

            {/* Grid de habitaciones */}
            {habitacionesFiltradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-lg">
                    <Bed className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <h3 className="font-semibold text-base mb-1">
                        {habitaciones.length === 0 ? 'No hay habitaciones registradas' : 'No se encontraron resultados'}
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                        {habitaciones.length === 0
                            ? 'Comienza creando tu primera habitación usando el botón superior'
                            : 'Intenta ajustar los filtros o la búsqueda'}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {habitacionesFiltradas.map((habitacion) => {
                        const estadoInfo = ESTADOS.find(e => e.value === habitacion.estado_ocupacion) || ESTADOS[0]

                        return (
                            <div
                                key={habitacion.id}
                                className="group relative flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/50"
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="font-semibold text-lg">{habitacion.numero}</h3>
                                        <p className="text-xs text-muted-foreground">Piso {habitacion.piso}</p>
                                    </div>
                                    <Badge variant="outline" className={estadoInfo.color + " text-xs"}>
                                        {estadoInfo.label}
                                    </Badge>
                                </div>

                                {/* Detalles */}
                                <div className="flex flex-col gap-1.5 text-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Bed className="h-3.5 w-3.5" />
                                        <span>{habitacion.categorias?.nombre || 'Sin categoría'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Users className="h-3.5 w-3.5" />
                                        <span>{habitacion.categorias?.capacidad_max || 0} personas</span>
                                    </div>
                                </div>

                                {/* Acciones */}
                                <div className="flex gap-2 mt-auto pt-3 border-t">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleEdit(habitacion)}
                                        className="flex-1 h-8"
                                    >
                                        <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                                        Editar
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDeleteClick(habitacion)}
                                        className="flex-1 h-8 text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                        Eliminar
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <HabitacionDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                habitacion={selectedHabitacion}
                categorias={categorias}
            />

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar habitación?</AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Estás seguro de eliminar la habitación{' '}
                            <strong>{habitacionToDelete?.numero}</strong>? Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
