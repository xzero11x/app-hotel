import { Suspense } from 'react'
import { RackContainer } from './rack-container'
import { Skeleton } from '@/components/ui/skeleton'

export default async function RackPage() {
  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      <Suspense fallback={<Skeleton className="h-full w-full" />}>
        <RackContainer />
      </Suspense>
    </div>
  )
}
