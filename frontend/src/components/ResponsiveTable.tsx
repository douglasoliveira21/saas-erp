export function ResponsiveTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-6 px-6 lg:mx-0 lg:px-0">
      <div className="inline-block min-w-full align-middle">
        {children}
      </div>
    </div>
  )
}
