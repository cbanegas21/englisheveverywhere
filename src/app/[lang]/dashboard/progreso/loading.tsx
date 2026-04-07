export default function ProgresoLoading() {
  return (
    <div className="min-h-full animate-pulse" style={{ background: '#F9F9F9' }}>
      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <div className="h-6 w-32 rounded" style={{ background: '#E5E7EB' }} />
        <div className="h-4 w-48 rounded mt-2" style={{ background: '#F3F4F6' }} />
      </div>
      <div className="px-8 py-6 max-w-3xl mx-auto space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl p-5" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
              <div className="h-9 w-9 rounded mb-3" style={{ background: '#F3F4F6' }} />
              <div className="h-7 w-12 rounded mb-1" style={{ background: '#F3F4F6' }} />
              <div className="h-3 w-20 rounded" style={{ background: '#F9F9F9' }} />
            </div>
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl p-6" style={{ background: '#fff', border: '1px solid #E5E7EB', height: 140 }} />
        ))}
      </div>
    </div>
  )
}
