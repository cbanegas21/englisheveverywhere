import PageLoading from '@/components/ui/PageLoading'

// Suspense fallback for the admin app and every /admin subpage (overview,
// students, teachers, bookings, payouts, biblioteca, whatsapp, seguridad, and
// the student/teacher CRM detail pages) while their server data loads.
export default function Loading() {
  return <PageLoading />
}
