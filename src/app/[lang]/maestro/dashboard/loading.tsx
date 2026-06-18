import PageLoading from '@/components/ui/PageLoading'

// Suspense fallback for the teacher dashboard and every /maestro/dashboard
// subpage (agenda, disponibilidad, estudiantes, materiales, tareas,
// configuracion, ganancias) while their server data loads.
export default function Loading() {
  return <PageLoading />
}
