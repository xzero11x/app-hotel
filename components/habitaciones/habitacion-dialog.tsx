'use client'

import { useState, useEffect } from 'react'
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createHabitacion, updateHabitacion, type HabitacionFormData } from '@/lib/actions/habitaciones'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

const habitacionFormSchema = z.object({
    numero: z.string().min(1, 'El número es requerido'),
    piso: z.coerce.number().min(1, 'El piso debe ser al menos 1'),
    categoria_id: z.string().min(1, 'Debes seleccionar una categoría'),
})

type HabitacionFormValues = z.infer<typeof habitacionFormSchema>

interface HabitacionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    habitacion?: any
    categorias: any[]
}

export function HabitacionDialog({ open, onOpenChange, habitacion, categorias }: HabitacionDialogProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const form = useForm<HabitacionFormValues>({
        resolver: zodResolver(habitacionFormSchema),
        defaultValues: {
            numero: habitacion?.numero || '',
            piso: habitacion?.piso || 1,
            categoria_id: habitacion?.categoria_id || '',
        },
    })

    // Reset form cuando cambia la habitación
    useEffect(() => {
        if (habitacion) {
            form.reset({
                numero: habitacion.numero,
                piso: habitacion.piso,
                categoria_id: habitacion.categoria_id,
            })
        } else {
            form.reset({
                numero: '',
                piso: 1,
                categoria_id: '',
            })
        }
    }, [habitacion, form])

    async function onSubmit(data: HabitacionFormValues) {
        setIsLoading(true)
        setError('')

        const result = habitacion
            ? await updateHabitacion(habitacion.id, data as HabitacionFormData)
            : await createHabitacion(data as HabitacionFormData)

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
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>
                        {habitacion ? 'Editar Habitación' : 'Nueva Habitación'}
                    </DialogTitle>
                    <DialogDescription>
                        {habitacion
                            ? 'Modifica los datos de la habitación'
                            : 'Crea una nueva habitación en el sistema'}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="numero"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Número de Habitación *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="101" {...field} />
                                    </FormControl>
                                    <FormDescription className="text-xs">
                                        Puede ser numérico o alfanumérico
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="piso"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Piso *</FormLabel>
                                    <FormControl>
                                        <Input type="number" min="1" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="categoria_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Categoría *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecciona una categoría" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {categorias.map((cat) => (
                                                <SelectItem key={cat.id} value={cat.id}>
                                                    {cat.nombre} - {cat.capacidad_max} {cat.capacidad_max === 1 ? 'persona' : 'personas'}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormDescription className="text-xs">
                                        Define el tipo y capacidad de la habitación
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

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
                                {habitacion ? 'Guardar' : 'Crear'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
