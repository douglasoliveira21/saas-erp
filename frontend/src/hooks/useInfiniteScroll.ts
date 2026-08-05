import { useState, useEffect, useCallback, useRef } from 'react'

interface UseInfiniteScrollOptions<T> {
  /** Function to fetch data - receives page number, returns items */
  fetchFn: (page: number) => Promise<T[]>
  /** Items per page */
  pageSize?: number
  /** Threshold in px before triggering next load */
  threshold?: number
  /** Initial data (optional) */
  initialData?: T[]
}

interface UseInfiniteScrollReturn<T> {
  items: T[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  error: string | null
  /** Ref to attach to the scroll sentinel element */
  sentinelRef: (node: HTMLElement | null) => void
  /** Reload from scratch */
  reload: () => void
  /** Set items externally (for search/filter changes) */
  setItems: (items: T[]) => void
}

export function useInfiniteScroll<T>({
  fetchFn,
  pageSize = 20,
  threshold = 200,
  initialData,
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollReturn<T> {
  const [items, setItems] = useState<T[]>(initialData || [])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(!initialData)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const isFetchingRef = useRef(false)

  const loadPage = useCallback(async (pageNum: number, append = false) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    if (append) setLoadingMore(true)
    else setLoading(true)

    try {
      const newItems = await fetchFn(pageNum)
      if (append) {
        setItems(prev => [...prev, ...newItems])
      } else {
        setItems(newItems)
      }
      setHasMore(newItems.length >= pageSize)
      setError(null)
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar dados')
    } finally {
      setLoading(false)
      setLoadingMore(false)
      isFetchingRef.current = false
    }
  }, [fetchFn, pageSize])

  // Initial load
  useEffect(() => {
    if (!initialData) {
      loadPage(1)
    }
  }, []) // eslint-disable-line

  const loadNext = useCallback(() => {
    if (!hasMore || isFetchingRef.current) return
    const nextPage = page + 1
    setPage(nextPage)
    loadPage(nextPage, true)
  }, [hasMore, page, loadPage])

  const reload = useCallback(() => {
    setPage(1)
    setHasMore(true)
    setError(null)
    loadPage(1, false)
  }, [loadPage])

  // Intersection Observer for sentinel
  const sentinelRef = useCallback((node: HTMLElement | null) => {
    if (observerRef.current) observerRef.current.disconnect()
    if (!node) return

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isFetchingRef.current) {
          loadNext()
        }
      },
      { rootMargin: `${threshold}px` }
    )
    observerRef.current.observe(node)
  }, [hasMore, loadNext, threshold])

  return { items, loading, loadingMore, hasMore, error, sentinelRef, reload, setItems }
}
