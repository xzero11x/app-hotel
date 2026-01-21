import { RegistroLegalClient } from './registro-legal-client'
import { DashboardHeader } from '@/components/dashboard-header'

export const metadata = {
    title: 'Libro de Huéspedes | App Hotel',
    description: 'Generación de Registro de Huéspedes Legalizado',
}

export default function RegistroLegalPage() {
    return (
        <>
            <DashboardHeader
                breadcrumbs={[
                    { label: 'Inicio', href: '/' },
                    { label: 'Huéspedes', href: '/huespedes' },
                    { label: 'Libro Legal' }
                ]}
            />
            <div className="flex-1 space-y-3 sm:space-y-4 p-3 sm:p-4 md:p-8 pt-4 sm:pt-6">
                <RegistroLegalClient />
            </div>
        </>
    )
}
