import { redirect } from 'next/navigation'

interface Props { params: Promise<{ lang: string }> }

export default async function AdminRootPage({ params }: Props) {
  const { lang } = await params
  redirect(`/${lang}/admin/overview`)
}
