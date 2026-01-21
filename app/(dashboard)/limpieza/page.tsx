import { getHabitacionesSucias } from '@/lib/actions/limpieza'
import { LimpiezaClient } from './limpieza-client'

export default async function LimpiezaPage() {
    const habitaciones = await getHabitacionesSucias()

    return <LimpiezaClient habitacionesIniciales={habitaciones} />
}
