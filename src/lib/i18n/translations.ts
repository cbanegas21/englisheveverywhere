export const locales = ['en', 'es'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'es'

export const translations = {
  en: {
    nav: {
      home: 'Home',
      howItWorks: 'How it works',
      pricing: 'Pricing',
      teachers: 'Teachers',
      login: 'Log in',
      getStarted: 'Get started',
    },
    hero: {
      badge: 'Personalized English classes',
      title: 'Learn English on',
      titleHighlight: 'your schedule',
      subtitle:
        'Live 1-on-1 sessions with certified teachers. No fixed timetables, no commitments. 100% adapted to your pace, goals, and level.',
      cta: 'Start today',
      ctaSecondary: 'See how it works',
      stats: {
        students: 'Active students',
        teachers: 'Certified teachers',
        countries: 'Latin American countries',
        satisfaction: 'Satisfaction rate',
      },
    },
    howItWorks: {
      title: 'Simple from day one',
      subtitle: 'Three steps and you are learning',
      steps: [
        {
          title: 'Take the placement test',
          desc: 'A short interactive test identifies your exact level in minutes.',
        },
        {
          title: 'Choose your teacher',
          desc: 'Browse verified profiles and book your first session for free.',
        },
        {
          title: 'Learn at your pace',
          desc: 'Classes happen inside the platform. No Zoom, no Meet, no extras.',
        },
      ],
    },
    pricing: {
      title: 'Transparent pricing',
      subtitle: 'No hidden fees. Cancel anytime.',
      perMonth: '/ month',
      classesPerMonth: 'classes per month',
      popular: 'Most popular',
      cta: 'Choose plan',
      includes: 'Everything includes:',
      features: [
        'Live video inside the platform',
        'Personalized curriculum',
        'Session recordings',
        'Progress tracking dashboard',
        'Teacher change anytime',
        'WhatsApp support',
      ],
    },
    teachers: {
      title: 'Meet your teachers',
      subtitle: 'Certified professionals, real experience',
      badge: 'Certified teacher',
    },
    footer: {
      tagline: 'The English platform built for Latin America.',
      links: 'Quick links',
      legal: 'Legal',
      terms: 'Terms of service',
      privacy: 'Privacy policy',
      rights: 'All rights reserved.',
    },
  },
  es: {
    nav: {
      home: 'Inicio',
      howItWorks: 'Cómo funciona',
      pricing: 'Precios',
      teachers: 'Maestros',
      login: 'Ingresar',
      getStarted: 'Comenzar',
    },
    hero: {
      badge: 'Clases de inglés personalizadas',
      title: 'Aprende inglés a',
      titleHighlight: 'tu ritmo',
      subtitle:
        'Sesiones 1 a 1 en vivo con maestros certificados. Sin horarios fijos, sin compromisos. 100% adaptado a tu ritmo, metas y nivel.',
      cta: 'Comenzar hoy',
      ctaSecondary: 'Ver cómo funciona',
      stats: {
        students: 'Estudiantes activos',
        teachers: 'Maestros certificados',
        countries: 'Países de Latinoamérica',
        satisfaction: 'Tasa de satisfacción',
      },
    },
    howItWorks: {
      title: 'Simple desde el primer día',
      subtitle: 'Tres pasos y estás aprendiendo',
      steps: [
        {
          title: 'Haz el placement test',
          desc: 'Una prueba interactiva corta identifica tu nivel exacto en minutos.',
        },
        {
          title: 'Elige tu maestro',
          desc: 'Explora perfiles verificados y agenda tu primera sesión gratis.',
        },
        {
          title: 'Aprende a tu ritmo',
          desc: 'Las clases ocurren dentro de la plataforma. Sin Zoom, sin Meet, sin extras.',
        },
      ],
    },
    pricing: {
      title: 'Precios transparentes',
      subtitle: 'Sin cargos ocultos. Cancela cuando quieras.',
      perMonth: '/ mes',
      classesPerMonth: 'clases por mes',
      popular: 'Más popular',
      cta: 'Elegir plan',
      includes: 'Todo incluye:',
      features: [
        'Video en vivo dentro de la plataforma',
        'Currículo personalizado',
        'Grabaciones de sesiones',
        'Dashboard de progreso',
        'Cambio de maestro en cualquier momento',
        'Soporte por WhatsApp',
      ],
    },
    teachers: {
      title: 'Conoce a tus maestros',
      subtitle: 'Profesionales certificados, experiencia real',
      badge: 'Maestro certificado',
    },
    footer: {
      tagline: 'La plataforma de inglés hecha para Latinoamérica.',
      links: 'Enlaces rápidos',
      legal: 'Legal',
      terms: 'Términos de servicio',
      privacy: 'Política de privacidad',
      rights: 'Todos los derechos reservados.',
    },
  },
}

export function getTranslations(lang: Locale) {
  return translations[lang] ?? translations[defaultLocale]
}
