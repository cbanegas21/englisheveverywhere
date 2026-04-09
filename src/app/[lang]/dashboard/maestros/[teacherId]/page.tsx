import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ lang: string; teacherId: string }>
}

export default async function TeacherProfilePage({ params }: Props) {
  const { lang } = await params
  redirect(`/${lang}/dashboard/maestros`)
}
