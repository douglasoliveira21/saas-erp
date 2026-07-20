import { HTMLAttributes } from 'react'

export function TableContainer({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-card ${className}`} role="region" tabIndex={0} {...props}>
      {children}
    </div>
  )
}
