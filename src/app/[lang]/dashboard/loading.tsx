import PageLoading from '@/components/ui/PageLoading'

// Suspense fallback for /dashboard and every student subpage that lacks its own
// loading.tsx (progreso keeps its bespoke skeleton). Shows on every navigation
// while the page's server data loads.
export default function Loading() {
  return <PageLoading />
}
