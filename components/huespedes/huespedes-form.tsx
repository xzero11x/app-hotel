'use client'

import { useState, useCallback } from 'react'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, User, Users, Search, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { HuespedConRelacion } from '@/lib/actions/huespedes'
import { NacionalidadCombobox } from '@/components/custom/nacionalidad-combobox'
import { DepartamentoCombobox } from '@/components/custom/departamento-combobox'
import { buscarHuespedPorDocumento } from '@/lib/actions/checkin'

interface HuespedFormData {
  id: string // ID temporal para el formulario
  huesped_bd_id?: string // ID real en la BD si existe
  nombres: string
  apellidos: string
  tipo_documento: 'DNI' | 'PASAPORTE' | 'CE' | 'OTRO'
  numero_documento: string
  nacionalidad: string
  procedencia_departamento: string
  correo: string
  telefono: string
  fecha_nacimiento: string
  es_titular: boolean
  es_existente: boolean // Flag para saber si viene de la BD
}

interface Props {
  onSubmit: (huespedes: HuespedConRelacion[]) => Promise<void>
  initialData?: HuespedFormData[]
  submitButtonText?: string
  showSubmitButton?: boolean
  onChange?: (huespedes: HuespedConRelacion[]) => void
}

const TIPOS_DOCUMENTO = [
  { value: 'DNI', label: 'DNI' },
  { value: 'PASAPORTE', label: 'Pasaporte' },
  { value: 'CE', label: 'Carnet de Extranjería' },
  { value: 'OTRO', label: 'Otro' },
]

const NACIONALIDADES = [
  'Peruana',
  'Argentina',
  'Boliviana',
  'Brasileña',
  'Chilena',
  'Colombiana',
  'Ecuatoriana',
  'Estadounidense',
  'Española',
  'Mexicana',
  'Venezolana',
  'Otra',
]

const DEPARTAMENTOS_PERU = [
  'Amazonas',
  'Áncash',
  'Apurímac',
  'Arequipa',
  'Ayacucho',
  'Cajamarca',
  'Callao',
  'Cusco',
  'Huancavelica',
  'Huánuco',
  'Ica',
  'Junín',
  'La Libertad',
  'Lambayeque',
  'Lima',
  'Loreto',
  'Madre de Dios',
  'Moquegua',
  'Pasco',
  'Piura',
  'Puno',
  'San Martín',
  'Tacna',
  'Tumbes',
  'Ucayali',
  'Extranjero',
]

export function HuespedesForm({ onSubmit, initialData, submitButtonText = 'Guardar Huéspedes', showSubmitButton = true, onChange }: Props) {
  const [huespedes, setHuespedes] = useState<HuespedFormData[]>(
    initialData || [
      {
        id: crypto.randomUUID(),
        nombres: '',
        apellidos: '',
        tipo_documento: 'DNI',
        numero_documento: '',
        nacionalidad: 'Peruana',
        procedencia_departamento: '',
        correo: '',
        telefono: '',
        fecha_nacimiento: '',
        es_titular: true,
        es_existente: false,
      },
    ]
  )

  const [loading, setLoading] = useState(false)
  const [buscando, setBuscando] = useState<Record<string, boolean>>({})

  // Función para buscar huésped por documento
  const buscarHuesped = useCallback(async (huespedId: string, tipoDoc: string, numDoc: string) => {
    if (!numDoc || numDoc.length < 3) return // Mínimo 3 caracteres para buscar

    setBuscando(prev => ({ ...prev, [huespedId]: true }))

    try {
      const result = await buscarHuespedPorDocumento(numDoc, tipoDoc)

      if (result.huesped) {
        // Huésped encontrado: autocompleta los campos
        setHuespedes(prev => prev.map(h => {
          if (h.id === huespedId) {
            toast.success(`Huésped encontrado: ${result.huesped.nombres} ${result.huesped.apellidos}`)
            return {
              ...h,
              huesped_bd_id: result.huesped.id,
              nombres: result.huesped.nombres || '',
              apellidos: result.huesped.apellidos || '',
              nacionalidad: result.huesped.nacionalidad || 'Peruana',
              procedencia_departamento: result.huesped.procedencia_departamento || '',
              correo: result.huesped.correo || '',
              telefono: result.huesped.telefono || '',
              fecha_nacimiento: result.huesped.fecha_nacimiento || '',
              es_existente: true,
            }
          }
          return h
        }))
      } else {
        // No existe: marcar como nuevo
        setHuespedes(prev => prev.map(h => {
          if (h.id === huespedId) {
            return { ...h, huesped_bd_id: undefined, es_existente: false }
          }
          return h
        }))
      }
    } catch (error) {
      console.error('Error buscando huésped:', error)
    } finally {
      setBuscando(prev => ({ ...prev, [huespedId]: false }))
    }
  }, [])

  const agregarAcompanante = () => {
    setHuespedes([
      ...huespedes,
      {
        id: crypto.randomUUID(),
        nombres: '',
        apellidos: '',
        tipo_documento: 'DNI',
        numero_documento: '',
        nacionalidad: 'Peruana',
        procedencia_departamento: '',
        correo: '',
        telefono: '',
        fecha_nacimiento: '',
        es_titular: false,
        es_existente: false,
      },
    ])
  }

  const eliminarHuesped = (id: string) => {
    if (huespedes.length === 1) {
      toast.error('Debe haber al menos un huésped')
      return
    }

    const huespedAEliminar = huespedes.find((h) => h.id === id)
    if (huespedAEliminar?.es_titular) {
      toast.error('No puedes eliminar al huésped titular')
      return
    }

    setHuespedes(huespedes.filter((h) => h.id !== id))
  }

  const actualizarHuesped = (id: string, field: keyof HuespedFormData, value: any) => {
    const updatedHuespedes = huespedes.map((h) => (h.id === id ? { ...h, [field]: value } : h))
    setHuespedes(updatedHuespedes)

    // Notificar cambios al padre si está en modo onChange
    if (onChange) {
      const huespedConRelacion = updatedHuespedes.map(h => ({
        ...h,
        huesped_id: null
      }))
      onChange(huespedConRelacion)
    }
  }

  const validarFormulario = (): boolean => {
    // Validar que todos tengan nombres
    for (const h of huespedes) {
      if (!h.nombres.trim()) {
        toast.error('Todos los huéspedes deben tener nombre')
        return false
      }
      if (!h.apellidos.trim()) {
        toast.error('Todos los huéspedes deben tener apellidos')
        return false
      }
      if (!h.numero_documento.trim()) {
        toast.error('Todos los huéspedes deben tener número de documento')
        return false
      }
    }

    // Validar documentos únicos
    const documentos = huespedes.map((h) => h.numero_documento)
    const duplicados = documentos.filter((d, i) => documentos.indexOf(d) !== i)
    if (duplicados.length > 0) {
      toast.error('No puede haber documentos duplicados')
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validarFormulario()) return

    setLoading(true)
    try {
      const huespedesData: HuespedConRelacion[] = huespedes.map((h) => ({
        nombres: h.nombres,
        apellidos: h.apellidos,
        tipo_documento: h.tipo_documento,
        numero_documento: h.numero_documento,
        nacionalidad: h.nacionalidad,
        procedencia_departamento: h.procedencia_departamento || null,
        correo: h.correo || null,
        telefono: h.telefono || null,
        fecha_nacimiento: h.fecha_nacimiento || null,
        es_titular: h.es_titular,
      }))

      await onSubmit(huespedesData)
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar huéspedes')
    } finally {
      setLoading(false)
    }
  }

  const titular = huespedes.find((h) => h.es_titular)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* HUÉSPED TITULAR */}
      {titular && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <div>
                <CardTitle>Huésped Titular</CardTitle>
                <CardDescription>Persona responsable de la reserva</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nombres-titular">
                  Nombres <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="nombres-titular"
                  value={titular.nombres}
                  onChange={(e) =>
                    actualizarHuesped(titular.id, 'nombres', e.target.value)
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="apellidos-titular">
                  Apellidos <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="apellidos-titular"
                  value={titular.apellidos}
                  onChange={(e) =>
                    actualizarHuesped(titular.id, 'apellidos', e.target.value)
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="tipo-doc-titular">Tipo Documento</Label>
                <Select
                  value={titular.tipo_documento}
                  onValueChange={(value) =>
                    actualizarHuesped(titular.id, 'tipo_documento', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_DOCUMENTO.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="nro-doc-titular">
                  Número Documento <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="nro-doc-titular"
                    value={titular.numero_documento}
                    onChange={(e) =>
                      actualizarHuesped(titular.id, 'numero_documento', e.target.value)
                    }
                    onBlur={() => buscarHuesped(titular.id, titular.tipo_documento, titular.numero_documento)}
                    placeholder="Ingrese documento y presione Tab para buscar"
                    required
                  />
                  {buscando[titular.id] && (
                    <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {titular.es_existente && !buscando[titular.id] && (
                    <CheckCircle2 className="absolute right-3 top-2.5 h-4 w-4 text-green-500" />
                  )}
                </div>
                {titular.es_existente && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Huésped frecuente
                  </Badge>
                )}
              </div>

              <div>
                <Label htmlFor="nacionalidad-titular">Nacionalidad</Label>
                <NacionalidadCombobox
                  value={titular.nacionalidad}
                  onValueChange={(value) =>
                    actualizarHuesped(titular.id, 'nacionalidad', value)
                  }
                />
              </div>

              <div>
                <Label htmlFor="procedencia-titular">Procedencia (Dpto)</Label>
                <DepartamentoCombobox
                  value={titular.procedencia_departamento}
                  onValueChange={(value) =>
                    actualizarHuesped(titular.id, 'procedencia_departamento', value)
                  }
                />
              </div>

              <div>
                <Label htmlFor="fecha-nac-titular">Fecha Nacimiento</Label>
                <Input
                  id="fecha-nac-titular"
                  type="date"
                  value={titular.fecha_nacimiento}
                  onChange={(e) =>
                    actualizarHuesped(titular.id, 'fecha_nacimiento', e.target.value)
                  }
                />
              </div>

              <div>
                <Label htmlFor="correo-titular">Correo</Label>
                <Input
                  id="correo-titular"
                  type="email"
                  value={titular.correo}
                  onChange={(e) =>
                    actualizarHuesped(titular.id, 'correo', e.target.value)
                  }
                />
              </div>

              <div>
                <Label htmlFor="telefono-titular">Teléfono</Label>
                <Input
                  id="telefono-titular"
                  type="tel"
                  value={titular.telefono}
                  onChange={(e) =>
                    actualizarHuesped(titular.id, 'telefono', e.target.value)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ACOMPAÑANTES */}
      <Card className="flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <div>
                <CardTitle>Acompañantes</CardTitle>
                <CardDescription>
                  {huespedes.length - 1} acompañante(s) registrado(s)
                </CardDescription>
              </div>
            </div>
            <Button type="button" onClick={agregarAcompanante} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Acompañante
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 max-h-[400px] overflow-y-auto">
          {huespedes
            .filter((h) => !h.es_titular)
            .map((acomp, index) => (
              <div key={acomp.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">Acompañante {index + 1}</Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => eliminarHuesped(acomp.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>
                      Nombres <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={acomp.nombres}
                      onChange={(e) =>
                        actualizarHuesped(acomp.id, 'nombres', e.target.value)
                      }
                      required
                    />
                  </div>

                  <div>
                    <Label>
                      Apellidos <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={acomp.apellidos}
                      onChange={(e) =>
                        actualizarHuesped(acomp.id, 'apellidos', e.target.value)
                      }
                      required
                    />
                  </div>

                  <div>
                    <Label>Tipo Documento</Label>
                    <Select
                      value={acomp.tipo_documento}
                      onValueChange={(value) =>
                        actualizarHuesped(acomp.id, 'tipo_documento', value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_DOCUMENTO.map((tipo) => (
                          <SelectItem key={tipo.value} value={tipo.value}>
                            {tipo.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>
                      Número Documento <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        value={acomp.numero_documento}
                        onChange={(e) =>
                          actualizarHuesped(acomp.id, 'numero_documento', e.target.value)
                        }
                        onBlur={() => buscarHuesped(acomp.id, acomp.tipo_documento, acomp.numero_documento)}
                        placeholder="Tab para buscar"
                        required
                      />
                      {buscando[acomp.id] && (
                        <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {acomp.es_existente && !buscando[acomp.id] && (
                        <CheckCircle2 className="absolute right-3 top-2.5 h-4 w-4 text-green-500" />
                      )}
                    </div>
                    {acomp.es_existente && (
                      <Badge variant="secondary" className="mt-1 text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Existente
                      </Badge>
                    )}
                  </div>

                  <div>
                    <Label>Nacionalidad</Label>
                    <NacionalidadCombobox
                      value={acomp.nacionalidad}
                      onValueChange={(value) =>
                        actualizarHuesped(acomp.id, 'nacionalidad', value)
                      }
                    />
                  </div>

                  <div>
                    <Label>Procedencia (Dpto)</Label>
                    <DepartamentoCombobox
                      value={acomp.procedencia_departamento}
                      onValueChange={(value) =>
                        actualizarHuesped(acomp.id, 'procedencia_departamento', value)
                      }
                    />
                  </div>

                  <div>
                    <Label>Fecha Nacimiento</Label>
                    <Input
                      type="date"
                      value={acomp.fecha_nacimiento}
                      onChange={(e) =>
                        actualizarHuesped(acomp.id, 'fecha_nacimiento', e.target.value)
                      }
                    />
                  </div>

                  <div>
                    <Label>Correo</Label>
                    <Input
                      type="email"
                      value={acomp.correo}
                      onChange={(e) =>
                        actualizarHuesped(acomp.id, 'correo', e.target.value)
                      }
                    />
                  </div>

                  <div>
                    <Label>Teléfono</Label>
                    <Input
                      type="tel"
                      value={acomp.telefono}
                      onChange={(e) =>
                        actualizarHuesped(acomp.id, 'telefono', e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            ))}

          {huespedes.filter((h) => !h.es_titular).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay acompañantes registrados</p>
              <p className="text-sm">Haz clic en "Agregar Acompañante" para añadir</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* BOTÓN GUARDAR */}
      {showSubmitButton && (
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={loading} size="lg">
            {loading ? 'Procesando...' : submitButtonText}
          </Button>
        </div>
      )}
    </form>
  )
}
