import type { Locale } from '@/lib/i18n/translations'
import Footer from '@/components/landing/Footer'

const CONTACT_EMAIL = 'c.banegaspaz2020@gmail.com'
const EFFECTIVE_DATE = 'April 21, 2026'

const t = {
  en: {
    title: 'Privacy Policy',
    effective: `Effective date: ${EFFECTIVE_DATE}`,
    intro: `EnglishKolab ("we", "us", "our") is a service operated by Remote ACKtive LLC, a Wyoming limited liability company. This Privacy Policy explains what personal information we collect, how we use it, and the choices you have. If you have questions, email ${CONTACT_EMAIL}.`,
    sections: [
      {
        heading: '1. Information we collect',
        body: [
          'Account information: name, email address, password (hashed), preferred language, and role (student, teacher, or admin).',
          'Profile information you provide: proficiency level, time zone, availability, bio, optional profile photo, and for teachers, CV and payout details.',
          'Booking and session data: class times, duration, attendance, teacher notes, and automatically generated session transcripts (stored only for teachers of the session).',
          'Payment information: we use Stripe to process payments. We never store full card numbers. Stripe provides us with a customer ID, subscription status, and last four digits for reconciliation.',
          'Technical data: IP address, browser, device, pages visited, and error logs. Collected through standard web analytics and error-monitoring tools.',
        ],
      },
      {
        heading: '2. How we use your information',
        body: [
          'To provide and operate the Service (scheduling classes, connecting students with teachers, processing payments, delivering live sessions).',
          'To communicate with you (booking confirmations, reminders, service announcements, replies to support requests).',
          'To maintain security, prevent fraud, and enforce our Terms of Service.',
          'To improve the Service through aggregated analytics.',
          'To comply with legal obligations.',
        ],
      },
      {
        heading: '3. Service providers',
        body: [
          'We share personal information with the following vendors only as necessary to provide the Service: Supabase (database and authentication), Stripe (payments), LiveKit (video sessions), Resend (transactional email), Vercel (hosting), and Anthropic (AI-generated session summaries — session transcripts may be sent to Anthropic\'s API for summarization).',
          'Each provider is contractually required to safeguard your data and use it only to perform services on our behalf.',
        ],
      },
      {
        heading: '4. International transfers',
        body: [
          'Our service providers operate in the United States. If you use the Service from another country, your information will be transferred to and processed in the United States.',
        ],
      },
      {
        heading: '5. Your rights',
        body: [
          'You may access, correct, or delete your account information from within the app. To request full deletion of your account and associated data, email us at the address above.',
          'Residents of the EU, UK, or California have additional rights (access, portability, erasure, objection, restriction). Contact us to exercise them.',
        ],
      },
      {
        heading: '6. Data retention',
        body: [
          'We retain account data for as long as your account is active. After account deletion, we retain minimal records (payment records, session logs) for up to 7 years as required by tax and accounting law.',
        ],
      },
      {
        heading: '7. Children',
        body: [
          'The Service is intended for users aged 13 and older. Users under 18 must have parental consent. We do not knowingly collect personal information from children under 13.',
        ],
      },
      {
        heading: '8. Changes to this policy',
        body: [
          'We may update this Privacy Policy from time to time. The "Effective date" above will reflect the latest revision. Material changes will be communicated by email to active account holders.',
        ],
      },
      {
        heading: '9. Contact',
        body: [
          `Remote ACKtive LLC, Wyoming, USA. Email: ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  es: {
    title: 'Política de Privacidad',
    effective: `Fecha de vigencia: ${EFFECTIVE_DATE}`,
    intro: `EnglishKolab ("nosotros", "nuestro") es un servicio operado por Remote ACKtive LLC, una sociedad de responsabilidad limitada de Wyoming. Esta Política de Privacidad explica qué información personal recopilamos, cómo la usamos y las opciones que tienes. Si tienes preguntas, escríbenos a ${CONTACT_EMAIL}.`,
    sections: [
      {
        heading: '1. Información que recopilamos',
        body: [
          'Información de cuenta: nombre, correo electrónico, contraseña (hasheada), idioma preferido y rol (estudiante, maestro o administrador).',
          'Información de perfil que proporcionas: nivel de dominio, zona horaria, disponibilidad, biografía, foto opcional y, para maestros, CV y datos de pago.',
          'Datos de reservas y sesiones: horarios de clase, duración, asistencia, notas del maestro y transcripciones de sesión generadas automáticamente (almacenadas únicamente para los maestros de la sesión).',
          'Información de pago: usamos Stripe para procesar pagos. Nunca almacenamos números de tarjeta completos. Stripe nos proporciona un ID de cliente, estado de suscripción y los últimos cuatro dígitos para conciliación.',
          'Datos técnicos: dirección IP, navegador, dispositivo, páginas visitadas y registros de errores. Recopilados mediante herramientas estándar de analítica web y monitoreo de errores.',
        ],
      },
      {
        heading: '2. Cómo usamos tu información',
        body: [
          'Para proporcionar y operar el Servicio (agendar clases, conectar estudiantes con maestros, procesar pagos, realizar sesiones en vivo).',
          'Para comunicarnos contigo (confirmaciones de reserva, recordatorios, anuncios del servicio, respuestas a solicitudes de soporte).',
          'Para mantener la seguridad, prevenir fraude y hacer cumplir nuestros Términos de Servicio.',
          'Para mejorar el Servicio mediante analítica agregada.',
          'Para cumplir con obligaciones legales.',
        ],
      },
      {
        heading: '3. Proveedores de servicios',
        body: [
          'Compartimos información personal con los siguientes proveedores solo en la medida necesaria para proporcionar el Servicio: Supabase (base de datos y autenticación), Stripe (pagos), LiveKit (sesiones de video), Resend (correo transaccional), Vercel (hosting) y Anthropic (resúmenes de sesión generados por IA — las transcripciones de sesión pueden enviarse a la API de Anthropic para su resumen).',
          'Cada proveedor está obligado contractualmente a proteger tus datos y usarlos únicamente para prestar servicios en nuestro nombre.',
        ],
      },
      {
        heading: '4. Transferencias internacionales',
        body: [
          'Nuestros proveedores operan en los Estados Unidos. Si usas el Servicio desde otro país, tu información será transferida a y procesada en los Estados Unidos.',
        ],
      },
      {
        heading: '5. Tus derechos',
        body: [
          'Puedes acceder, corregir o eliminar la información de tu cuenta desde la aplicación. Para solicitar la eliminación completa de tu cuenta y los datos asociados, escríbenos al correo indicado arriba.',
          'Los residentes de la UE, el Reino Unido o California tienen derechos adicionales (acceso, portabilidad, supresión, objeción, restricción). Contáctanos para ejercerlos.',
        ],
      },
      {
        heading: '6. Retención de datos',
        body: [
          'Conservamos los datos de la cuenta mientras tu cuenta esté activa. Tras la eliminación de la cuenta, retenemos registros mínimos (registros de pago, registros de sesión) por hasta 7 años según lo exija la ley fiscal y contable.',
        ],
      },
      {
        heading: '7. Menores',
        body: [
          'El Servicio está destinado a usuarios de 13 años o más. Los usuarios menores de 18 años deben contar con consentimiento parental. No recopilamos intencionalmente información personal de niños menores de 13 años.',
        ],
      },
      {
        heading: '8. Cambios a esta política',
        body: [
          'Podemos actualizar esta Política de Privacidad periódicamente. La "Fecha de vigencia" anterior reflejará la última revisión. Los cambios materiales se comunicarán por correo electrónico a los titulares de cuentas activas.',
        ],
      },
      {
        heading: '9. Contacto',
        body: [
          `Remote ACKtive LLC, Wyoming, USA. Correo: ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
} as const

export default async function PrivacyPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params
  const tx = t[lang]

  return (
    <>
      <main className="min-h-screen" style={{ background: '#F9F9F9' }}>
        <div className="max-w-3xl mx-auto px-6 py-16">
          <h1 className="text-[40px] font-black mb-2 tracking-tight" style={{ color: '#111111' }}>
            {tx.title}
          </h1>
          <p className="text-[13px] mb-10" style={{ color: '#6B7280' }}>{tx.effective}</p>
          <p className="text-[15px] leading-relaxed mb-10" style={{ color: '#1F2937' }}>
            {tx.intro}
          </p>
          <div className="space-y-10">
            {tx.sections.map(section => (
              <section key={section.heading}>
                <h2 className="text-[20px] font-bold mb-4" style={{ color: '#111111' }}>
                  {section.heading}
                </h2>
                <div className="space-y-4">
                  {section.body.map((p, i) => (
                    <p key={i} className="text-[15px] leading-relaxed" style={{ color: '#1F2937' }}>
                      {p}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
      <Footer lang={lang} />
    </>
  )
}
