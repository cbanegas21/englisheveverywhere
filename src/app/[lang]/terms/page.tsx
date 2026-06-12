import type { Locale } from '@/lib/i18n/translations'
import Navbar from '@/components/landing/Navbar'
import Footer from '@/components/landing/Footer'

const CONTACT_EMAIL = 'hola@englishkolab.com'
const EFFECTIVE_DATE = 'April 21, 2026'

const t = {
  en: {
    title: 'Terms of Service',
    effective: `Effective date: ${EFFECTIVE_DATE}`,
    intro: `These Terms of Service ("Terms") govern your use of EnglishKolab (the "Service"), a service operated by Remote ACKtive LLC, a Wyoming limited liability company ("we", "us"). By creating an account or using the Service you agree to these Terms. If you do not agree, do not use the Service. Questions: ${CONTACT_EMAIL}.`,
    sections: [
      {
        heading: '1. The Service',
        body: [
          'EnglishKolab is an online platform connecting English-language learners ("Students") with English teachers ("Teachers") for live, one-on-one video classes. We facilitate scheduling, communication, video conferencing, and payments. We are not a party to the educational relationship between Student and Teacher and do not employ Teachers; Teachers are independent contractors.',
        ],
      },
      {
        heading: '2. Accounts',
        body: [
          'You must be at least 13 years old to use the Service. Users under 18 must have parental consent. You must provide accurate information and keep your credentials confidential. You are responsible for activity under your account.',
          'We may suspend or terminate accounts for violation of these Terms, fraudulent activity, or abuse of the Service.',
        ],
      },
      {
        heading: '3. Plans, classes, and payment',
        body: [
          'Plans are sold as a fixed number of classes at the prices displayed on the Service. Payment is a one-time charge processed by Stripe — there is no subscription or auto-renewal. By purchasing a plan you authorize us to charge your payment method for the plan amount plus any applicable taxes.',
          'Classes purchased under current plans do not expire. Unused classes remain in your account until used, and additional purchases stack with any classes you already have.',
          'Prices are shown in USD. We may display an estimated local-currency equivalent for reference only; all charges are processed in USD by Stripe.',
        ],
      },
      {
        heading: '4. Credits and refunds',
        body: [
          'We do not offer monetary refunds. Plans are sold as class credits, and your class credits never expire — they remain in your account until you use them, no matter how long that takes.',
          'Because credits never expire, there is no need for a cash refund: a class you do not use is not lost, it simply waits in your balance for whenever you are ready. Completed classes are consumed and cannot be returned.',
          'If a Teacher fails to attend a scheduled class, the class credit is returned to your (non-expiring) balance and you may re-book. Contact us at the email below if a class did not take place as expected.',
        ],
      },
      {
        heading: '5. Booking, cancellation, no-show',
        body: [
          'Classes must be booked at least 24 hours in advance. When a Student cancels at least 24 hours before the class, the class credit is returned to your (non-expiring) balance and can be used for any future class.',
          'Cancellations made less than 24 hours before the class, and no-shows, forfeit that class credit — the Teacher reserved that time for you and it can no longer be reassigned. No monetary refund is issued in any case.',
          'If a Teacher cancels, the credit is returned to your balance and you may re-book with any available Teacher.',
        ],
      },
      {
        heading: '6. Teacher terms (supplemental)',
        body: [
          'Teachers apply, are reviewed, and approved before providing paid classes. Teachers are independent contractors, not employees. Teachers set their availability, conduct classes professionally, and receive payouts via Stripe Connect after classes are completed. Teachers warrant they have the right to provide the services and that the content they provide does not infringe any third party rights.',
        ],
      },
      {
        heading: '7. Acceptable use',
        body: [
          'You agree not to: (a) share account credentials; (b) record or redistribute class content without the consent of all participants; (c) harass, discriminate against, or abuse any user; (d) use the Service for unlawful purposes; (e) interfere with the technical operation of the Service.',
        ],
      },
      {
        heading: '8. Intellectual property',
        body: [
          'The Service, including software, logos, and trademarks, is owned by Remote ACKtive LLC. Teacher-generated class materials remain owned by the Teacher; Students may use them for personal study only. Session recordings, if any, are owned by Remote ACKtive LLC and governed by our Privacy Policy.',
        ],
      },
      {
        heading: '9. Disclaimers',
        body: [
          'The Service is provided "as is" without warranties of any kind. We do not guarantee that classes will improve your English to any specific level. Teachers are independent contractors and are not our employees or agents.',
        ],
      },
      {
        heading: '10. Limitation of liability',
        body: [
          'To the maximum extent permitted by law, our aggregate liability to you for any claim arising out of or related to the Service is limited to the amount you paid us in the 12 months preceding the claim. We are not liable for indirect, incidental, consequential, or punitive damages.',
        ],
      },
      {
        heading: '11. Governing law and disputes',
        body: [
          'These Terms are governed by the laws of the State of Wyoming, USA, without regard to conflict of law principles. Any dispute shall be resolved in the state or federal courts located in Wyoming, and you consent to personal jurisdiction there.',
        ],
      },
      {
        heading: '12. Changes',
        body: [
          'We may update these Terms from time to time. Material changes will be communicated by email to active account holders. Continued use of the Service after changes take effect constitutes acceptance.',
        ],
      },
      {
        heading: '13. Contact',
        body: [
          `Remote ACKtive LLC, Wyoming, USA. Email: ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  es: {
    title: 'Términos del Servicio',
    effective: `Fecha de vigencia: ${EFFECTIVE_DATE}`,
    intro: `Estos Términos del Servicio ("Términos") regulan tu uso de EnglishKolab (el "Servicio"), un servicio operado por Remote ACKtive LLC, una sociedad de responsabilidad limitada de Wyoming ("nosotros"). Al crear una cuenta o usar el Servicio aceptas estos Términos. Si no estás de acuerdo, no uses el Servicio. Consultas: ${CONTACT_EMAIL}.`,
    sections: [
      {
        heading: '1. El Servicio',
        body: [
          'EnglishKolab es una plataforma en línea que conecta a estudiantes de inglés ("Estudiantes") con maestros de inglés ("Maestros") para clases en vivo, uno a uno, por video. Facilitamos la programación, la comunicación, la videoconferencia y los pagos. No somos parte de la relación educativa entre Estudiante y Maestro y no empleamos a los Maestros; los Maestros son contratistas independientes.',
        ],
      },
      {
        heading: '2. Cuentas',
        body: [
          'Debes tener al menos 13 años para usar el Servicio. Los usuarios menores de 18 años requieren consentimiento parental. Debes proporcionar información precisa y mantener tus credenciales confidenciales. Eres responsable de la actividad en tu cuenta.',
          'Podemos suspender o cancelar cuentas por violación de estos Términos, actividad fraudulenta o abuso del Servicio.',
        ],
      },
      {
        heading: '3. Planes, clases y pago',
        body: [
          'Los planes se venden como un número fijo de clases a los precios mostrados en el Servicio. El pago es un cargo único procesado por Stripe — no hay suscripción ni renovación automática. Al comprar un plan autorizas el cargo a tu método de pago por el importe del plan más los impuestos aplicables.',
          'Las clases compradas en los planes actuales no expiran. Las clases no utilizadas permanecen en tu cuenta hasta que las uses, y las compras adicionales se acumulan con las clases que ya tengas.',
          'Los precios se muestran en USD. Podemos mostrar un equivalente estimado en tu moneda local solo como referencia; todos los cargos se procesan en USD por Stripe.',
        ],
      },
      {
        heading: '4. Créditos y reembolsos',
        body: [
          'No ofrecemos reembolsos en efectivo. Los planes se venden como créditos de clase, y tus créditos de clase nunca expiran: permanecen en tu cuenta hasta que los uses, sin importar cuánto tiempo pase.',
          'Como los créditos nunca expiran, no hace falta un reembolso en dinero: una clase que no uses no se pierde, simplemente queda en tu saldo para cuando estés listo. Las clases completadas se consumen y no pueden devolverse.',
          'Si un Maestro no asiste a una clase agendada, el crédito de la clase se devuelve a tu saldo (que no expira) y puedes reagendar. Contáctanos al correo indicado abajo si una clase no se realizó como se esperaba.',
        ],
      },
      {
        heading: '5. Reserva, cancelación, inasistencia',
        body: [
          'Las clases deben reservarse con al menos 24 horas de anticipación. Cuando un Estudiante cancela con al menos 24 horas de anticipación, el crédito de la clase se devuelve a tu saldo (que no expira) y puede usarse para cualquier clase futura.',
          'Las cancelaciones con menos de 24 horas de anticipación y las inasistencias resultan en la pérdida de ese crédito de clase: el Maestro reservó ese tiempo para ti y ya no puede reasignarse. En ningún caso se emite un reembolso en efectivo.',
          'Si un Maestro cancela, el crédito se devuelve a tu saldo y puedes reagendar con cualquier Maestro disponible.',
        ],
      },
      {
        heading: '6. Términos para Maestros (suplementarios)',
        body: [
          'Los Maestros aplican, son evaluados y aprobados antes de impartir clases pagadas. Los Maestros son contratistas independientes, no empleados. Los Maestros fijan su disponibilidad, imparten clases profesionalmente y reciben pagos vía Stripe Connect tras la finalización de las clases. Los Maestros declaran tener derecho a prestar los servicios y que el contenido que proporcionan no infringe derechos de terceros.',
        ],
      },
      {
        heading: '7. Uso aceptable',
        body: [
          'Te comprometes a no: (a) compartir credenciales de cuenta; (b) grabar o redistribuir el contenido de clase sin el consentimiento de todos los participantes; (c) acosar, discriminar o abusar de ningún usuario; (d) usar el Servicio para fines ilegales; (e) interferir con la operación técnica del Servicio.',
        ],
      },
      {
        heading: '8. Propiedad intelectual',
        body: [
          'El Servicio, incluyendo el software, los logos y las marcas, es propiedad de Remote ACKtive LLC. Los materiales de clase generados por los Maestros siguen siendo propiedad del Maestro; los Estudiantes pueden usarlos únicamente para estudio personal. Las grabaciones de sesión, si las hubiere, son propiedad de Remote ACKtive LLC y se rigen por nuestra Política de Privacidad.',
        ],
      },
      {
        heading: '9. Renuncias',
        body: [
          'El Servicio se proporciona "tal cual" sin garantías de ningún tipo. No garantizamos que las clases mejoren tu inglés a un nivel específico. Los Maestros son contratistas independientes y no son nuestros empleados ni agentes.',
        ],
      },
      {
        heading: '10. Limitación de responsabilidad',
        body: [
          'En la máxima medida permitida por la ley, nuestra responsabilidad total hacia ti por cualquier reclamación relacionada con el Servicio se limita al monto que nos hayas pagado en los 12 meses previos a la reclamación. No somos responsables de daños indirectos, incidentales, consecuentes o punitivos.',
        ],
      },
      {
        heading: '11. Ley aplicable y disputas',
        body: [
          'Estos Términos se rigen por las leyes del Estado de Wyoming, EE. UU., sin considerar los principios de conflicto de leyes. Cualquier disputa se resolverá en los tribunales estatales o federales de Wyoming, y consientes a su jurisdicción personal.',
        ],
      },
      {
        heading: '12. Cambios',
        body: [
          'Podemos actualizar estos Términos periódicamente. Los cambios materiales se comunicarán por correo electrónico a los titulares de cuentas activas. El uso continuo del Servicio tras la entrada en vigor de los cambios constituye aceptación.',
        ],
      },
      {
        heading: '13. Contacto',
        body: [
          `Remote ACKtive LLC, Wyoming, USA. Correo: ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
} as const

export default async function TermsPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params
  const tx = t[lang]

  return (
    <>
      <Navbar lang={lang} />
      <main className="min-h-screen" style={{ background: 'var(--ek-paper)' }}>
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
