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
} from '@/components/ui/dialog'
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createCategoriaConTarifas, updateCategoriaConTarifas } from '@/lib/actions/categorias'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2 } from 'lucide-react'

const tarifaSchema = z.object({
    nombre: z.string().min(2, 'El nombre de la tarifa es requerido'),
    precio: z.coerce.number().min(0, 'El precio debe ser mayor a 0'),
})

const categoriaFormSchema = z.object({
    nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    descripcion: z.string().optional(),
    capacidad_maxima: z.coerce.number().min(1, 'La capacidad debe ser al menos 1'),
    tarifas: z.array(tarifaSchema).min(1, 'Debes agregar al menos una tarifa'),
})

type CategoriaFormData = z.infer<typeof categoriaFormSchema>

interface CategoriaDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    categoria?: any
}

export function CategoriaDialog({ open, onOpenChange, categoria }: CategoriaDialogProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const form = useForm<CategoriaFormData>({
        resolver: zodResolver(categoriaFormSchema),
        defaultValues: {
            nombre: categoria?.nombre || '',
            descripcion: categoria?.descripcion || '',
            capacidad_maxima: categoria?.capacidad_max || 1, // Mapeo: DB usa capacidad_max
            tarifas: categoria?.tarifas?.length > 0
                ? categoria.tarifas.map((t: any) => ({
                    nombre: t.nombre || '', // DB usa nombre
                    precio: t.precio || 0,   // DB usa precio
                }))
                : [{ nombre: 'Normal', precio: 0 }],
        },
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'tarifas',
    })

    async function onSubmit(data: CategoriaFormData) {
        setIsLoading(true)
        setError('')

        const result = categoria
            ? await updateCategoriaConTarifas(categoria.id, data)
            : await createCategoriaConTarifas(data)

        if (result.error) {
            setError(result.error)
            setIsLoading(false)
            return
        }

        form.reset()
        onOpenChange(false)
        router.refresh()
        setIsLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {categoria ? 'Editar Categoría' : 'Nueva Categoría'}
                    </DialogTitle>
                    <DialogDescription>
                        {categoria
                            ? 'Modifica los datos de la categoría y sus tarifas'
                            : 'Crea una nueva categoría de habitación con sus tarifas'}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="nombre"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre de la Categoría *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Simple, Doble, Suite" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="descripcion"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descripción</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Descripción breve" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="capacidad_maxima"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Capacidad Máxima *</FormLabel>
                                    <FormControl>
                                        <Input type="number" min="1" {...field} />
                                    </FormControl>
                                    <FormDescription className="text-xs">
                                        Número de personas
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Tarifas */}
                        <div className="space-y-2">
                            {fields.map((field, index) => (
                                <div key={field.id}>
                                    {index === 0 && (
                                        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-2">
                                            <FormLabel>Nombre</FormLabel>
                                            <FormLabel>Precio (S/)</FormLabel>
                                            <div className="w-10" />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start">
                                        <FormField
                                            control={form.control}
                                            name={`tarifas.${index}.nombre`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="Normal"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name={`tarifas.${index}.precio`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            placeholder="0"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        {index === fields.length - 1 ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => append({ nombre: '', precio: 0 })}
                                                className="h-10 w-10"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => remove(index)}
                                                className="h-10 w-10"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {error && (
                            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                                {error}
                            </div>
                        )}

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isLoading}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {categoria ? 'Guardar Cambios' : 'Crear Categoría'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
