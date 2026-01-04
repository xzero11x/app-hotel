import { DashboardHeader } from '@/components/dashboard-header'
import { CheckInForm } from './checkin-form'
import { getHabitacionesDisponibles } from '@/lib/actions/checkin'

export default async function CheckInPage() {
    const { habitaciones } = await getHabitacionesDisponibles()

    return (
        <>
            <DashboardHeader
                breadcrumbs={[
                    { label: 'Reservas', href: '/reservas' },
                    { label: 'Check-in' },
                ]}
            />

            <div className="flex flex-1 flex-col gap-6 p-6 overflow-x-hidden">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight">Check-in</h1>
                    <p className="text-sm text-muted-foreground">
                        Registra el ingreso de un nuevo huésped al hotel
                    </p>
                </div>

                <CheckInForm habitaciones={habitaciones || []} />
            </div>
        </>
    )
}
