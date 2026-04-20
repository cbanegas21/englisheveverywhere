import { useEffect, useState } from 'react'

export function useTimer(scheduledAt: string, durationMinutes: number): string | null {
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  useEffect(() => {
    const endTime = new Date(scheduledAt).getTime() + durationMinutes * 60 * 1000
    const update = () => setTimeLeft(Math.max(0, Math.floor((endTime - Date.now()) / 1000)))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [scheduledAt, durationMinutes])

  if (timeLeft === null) return null
  const m = Math.floor(timeLeft / 60)
  const s = timeLeft % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
