export type UserRole = 'student' | 'teacher' | 'admin'
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing'
export type EnglishLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export interface Profile {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  role: UserRole
  timezone: string
  preferred_language: 'es' | 'en'
  created_at: string
}

export interface Teacher {
  id: string
  profile_id: string
  bio: string
  specializations: string[]
  hourly_rate: number
  rating: number
  total_sessions: number
  stripe_account_id: string | null
  is_active: boolean
  profile?: Profile
}

export interface Student {
  id: string
  profile_id: string
  level: EnglishLevel | null
  classes_remaining: number
  stripe_customer_id: string | null
  placement_test_done: boolean
  profile?: Profile
}

export interface Plan {
  id: string
  name: string
  name_es: string
  classes_per_month: number
  price_usd: number
  stripe_price_id: string
  description: string
  description_es: string
  is_popular: boolean
}

export interface Booking {
  id: string
  student_id: string
  teacher_id: string
  scheduled_at: string
  duration_minutes: number
  status: BookingStatus
  video_room_url: string | null
  notes: string | null
  student?: Student & { profile: Profile }
  teacher?: Teacher & { profile: Profile }
}

export interface Locale {
  lang: 'en' | 'es'
}
