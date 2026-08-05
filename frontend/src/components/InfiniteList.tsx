import { Loader2 } from 'lucide-react'

interface InfiniteListProps {
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  itemCount: number
  sentinelRef: (node: HTMLElement | null) => void
  emptyMessage?: string
  emptyIcon?: React.ReactNode
  children: React.ReactNode
}

export function InfiniteList({
  loading,
  loadingMore,
  hasMore,
  itemCount,
  sentinelRef,
  emptyMessage = 'Nenhum registro encontrado',
  emptyIcon,
  children,
}: InfiniteListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl skeleton" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 skeleton" />
                <div className="h-3 w-32 skeleton" />
              </div>
              <div className="h-8 w-20 skeleton" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (itemCount === 0) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 text-center">
        {emptyIcon || (
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
        )}
        <p className="text-gray-500 text-sm font-medium">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div>
      {children}

      {/* Scroll sentinel */}
      <div ref={sentinelRef} className="scroll-sentinel" />

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="flex items-center justify-center py-6 gap-2">
          <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
          <span className="text-sm text-gray-500">Carregando mais...</span>
        </div>
      )}

      {/* End indicator */}
      {!hasMore && itemCount > 0 && (
        <div className="flex items-center justify-center py-4">
          <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
            Todos os {itemCount} registros carregados
          </span>
        </div>
      )}
    </div>
  )
}
