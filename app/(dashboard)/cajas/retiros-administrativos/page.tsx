import { RetirosAdministrativosClient } from './retiros-administrativos-client'
import { DashboardHeader } from '@/components/dashboard-header'

export default function RetirosAdministrativosPage() {
    return (
        <>
            <DashboardHeader 
                breadcrumbs={[
                    { label: 'Inicio', href: '/' },
                    { label: 'Cajas', href: '/cajas' },
                    { label: 'Retiros Administrativos' }
                ]}
            />
            <RetirosAdministrativosClient />
        </>
    )
}
