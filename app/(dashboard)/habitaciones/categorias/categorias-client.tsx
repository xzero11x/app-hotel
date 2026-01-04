'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CategoriaDialog } from '@/components/habitaciones/categoria-dialog'
import { deleteCategoria } from '@/lib/actions/categorias'
import { useRouter } from 'next/navigation'
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
import { Plus, Edit2, Trash2, Users, DollarSign, Bed } from 'lucide-react'

interface CategoriasClientProps {
    categorias: any[]
}

export function CreateButton() {
    const [dialogOpen, setDialogOpen] = useState(false)

    return (
        <>
            <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Categoría
            </Button>
            <CategoriaDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                categoria={null}
            />
        </>
    )
}

export function CategoriasClient({ categorias }: CategoriasClientProps) {
    const router = useRouter()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [selectedCategoria, setSelectedCategoria] = useState<any>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState('')

    function handleEdit(categoria: any) {
        setSelectedCategoria(categoria)
        setDialogOpen(true)
    }

    function handleDeleteClick(categoria: any) {
        setSelectedCategoria(categoria)
        setDeleteError('')
        setDeleteDialogOpen(true)
    }

    async function handleDelete() {
        if (!selectedCategoria) return

        setIsDeleting(true)
        setDeleteError('')

        const result = await deleteCategoria(selectedCategoria.id)

        if (result.error) {
            setDeleteError(result.error)
            setIsDeleting(false)
            return
        }

        setDeleteDialogOpen(false)
        setIsDeleting(false)
        router.refresh()
    }

    return (
        <div className="space-y-4">
            {/* Grid de categorías */}
            {categorias.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-lg">
                    <Bed className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <h3 className="font-semibold text-base mb-1">
                        No hay categorías registradas
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-sm mb-4">
                        Las categorías definen los tipos de habitación (Simple, Doble, Suite, etc.) y sus precios
                    </p>
                    <Button onClick={() => setDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Crear Primera Categoría
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {categorias.map((categoria) => (
                        <div
                            key={categoria.id}
                            className="group relative flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/50"
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <h3 className="font-semibold text-lg">{categoria.nombre}</h3>
                                    {categoria.descripcion && (
                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                            {categoria.descripcion}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Capacidad */}
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Users className="h-3.5 w-3.5" />
                                <span>
                                    {categoria.capacidad_max} {categoria.capacidad_max === 1 ? 'persona' : 'personas'}
                                </span>
                            </div>

                            {/* Tarifas */}
                            {categoria.tarifas && categoria.tarifas.length > 0 && (
                                <div className="space-y-1.5">
                                    <div className="text-xs font-medium text-muted-foreground">Tarifas:</div>
                                    {categoria.tarifas.map((tarifa: any, index: number) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between text-sm rounded-md bg-muted/50 px-2.5 py-1.5"
                                        >
                                            <span className="capitalize text-xs">{tarifa.nombre}</span>
                                            <span className="font-semibold text-sm">S/ {tarifa.precio}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Footer con acciones */}
                            <div className="flex items-center justify-between pt-3 mt-auto border-t">
                                <Badge variant="secondary" className="text-xs">
                                    {categoria._count?.habitaciones || 0} hab.
                                </Badge>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleEdit(categoria)}
                                        className="h-8 px-2"
                                    >
                                        <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                                        Editar
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDeleteClick(categoria)}
                                        className="h-8 px-2 text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                        Eliminar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <CategoriaDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                categoria={selectedCategoria}
            />

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Vas a eliminar la categoría <strong>{selectedCategoria?.nombre}</strong>.
                            Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {deleteError && (
                        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                            {deleteError}
                        </div>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                handleDelete()
                            }}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? 'Eliminando...' : 'Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
