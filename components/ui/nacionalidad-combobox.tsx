'use client'

import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'

const NACIONALIDADES = [
    'Peruana',
    'Argentina',
    'Boliviana',
    'Brasileña',
    'Chilena',
    'Colombiana',
    'Ecuatoriana',
    'Venezolana',
    'Uruguaya',
    'Paraguaya',
    'Estadounidense',
    'Canadiense',
    'Mexicana',
    'Española',
    'Francesa',
    'Alemana',
    'Italiana',
    'Británica',
    'Portuguesa',
    'Holandesa',
    'Belga',
    'Suiza',
    'Sueca',
    'Noruega',
    'Danesa',
    'Finlandesa',
    'Rusa',
    'Ucraniana',
    'Polaca',
    'Rumana',
    'Griega',
    'Turca',
    'China',
    'Japonesa',
    'Coreana',
    'India',
    'Australiana',
    'Neozelandesa',
    'Sudafricana',
    'Israelí',
    'Otra',
]

interface NacionalidadComboboxProps {
    value: string
    onValueChange: (value: string) => void
    disabled?: boolean
}

export function NacionalidadCombobox({ value, onValueChange, disabled }: NacionalidadComboboxProps) {
    const [open, setOpen] = React.useState(false)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                    disabled={disabled}
                >
                    {value || 'Selecciona nacionalidad...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
                <Command>
                    <CommandInput placeholder="Buscar nacionalidad..." />
                    <CommandList>
                        <CommandEmpty>No se encontró la nacionalidad.</CommandEmpty>
                        <CommandGroup>
                            {NACIONALIDADES.map((nacionalidad) => (
                                <CommandItem
                                    key={nacionalidad}
                                    value={nacionalidad}
                                    onSelect={(currentValue) => {
                                        onValueChange(currentValue === value.toLowerCase() ? '' : nacionalidad)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            'mr-2 h-4 w-4',
                                            value.toLowerCase() === nacionalidad.toLowerCase()
                                                ? 'opacity-100'
                                                : 'opacity-0'
                                        )}
                                    />
                                    {nacionalidad}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
