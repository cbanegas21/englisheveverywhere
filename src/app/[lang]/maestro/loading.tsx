import PageLoading from '@/components/ui/PageLoading'

// Suspense fallback for the teacher area shell (e.g. /maestro/pending) while its
// server data loads.
export default function Loading() {
  return <PageLoading />
}
