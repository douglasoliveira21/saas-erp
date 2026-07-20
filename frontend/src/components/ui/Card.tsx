import { HTMLAttributes } from 'react'

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={`rounded-2xl border border-gray-100 bg-white p-4 shadow-card sm:p-6 ${className}`} {...props} />
}
