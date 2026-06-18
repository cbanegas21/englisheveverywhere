import PageLoading from '@/components/ui/PageLoading'

// Suspense fallback for the onboarding route while its server data loads.
export default function Loading() {
  return <PageLoading />
}
