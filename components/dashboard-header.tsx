'use client'

import React from 'react'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

interface DashboardHeaderProps {
    breadcrumbs: {
        label: string
        href?: string
    }[]
}

export function DashboardHeader({ breadcrumbs }: DashboardHeaderProps) {
    return (
        <header className="sticky top-0 z-10 flex h-auto min-h-12 sm:min-h-14 md:min-h-16 shrink-0 items-center gap-2 border-b bg-background transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:min-h-12">
            <div className="flex items-center gap-2 px-2 sm:px-3 md:px-4 py-2 w-full">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-1 sm:mr-2 h-4" />
                <Breadcrumb>
                    <BreadcrumbList className="text-xs sm:text-sm">
                        {breadcrumbs.map((crumb, index) => (
                            <React.Fragment key={`breadcrumb-${index}`}>
                                {index > 0 && <BreadcrumbSeparator className="hidden sm:block" />}
                                <BreadcrumbItem className={index === 0 ? 'hidden md:block' : undefined}>
                                    {crumb.href ? (
                                        <BreadcrumbLink href={crumb.href} className="max-w-[150px] sm:max-w-none truncate">
                                            {crumb.label}
                                        </BreadcrumbLink>
                                    ) : (
                                        <BreadcrumbPage className="max-w-[200px] sm:max-w-none truncate">{crumb.label}</BreadcrumbPage>
                                    )}
                                </BreadcrumbItem>
                            </React.Fragment>
                        ))}
                    </BreadcrumbList>
                </Breadcrumb>
            </div>
        </header>
    )
}
