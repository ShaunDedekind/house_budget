export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 1L14 5V15H10V10H6V15H2V5L8 1Z" fill="white"/>
            </svg>
          </div>
          <span className="text-lg font-semibold text-zinc-900">Home Base</span>
        </div>
      </div>
      {children}
    </div>
  )
}
