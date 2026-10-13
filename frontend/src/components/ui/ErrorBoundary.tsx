import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'

// scope="page": erro dentro de uma tela mostra um aviso no lugar do conteúdo e mantém o menu e o
// resto do sistema funcionando (sem isso um erro em um menu derrubava a aplicação inteira).
interface Props { children: ReactNode; scope?: 'app' | 'page' }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro não tratado na interface', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    if (this.props.scope === 'page') {
      return (
        <section className="mx-auto mt-10 w-full max-w-lg rounded-2xl border border-red-100 bg-white p-8 text-center shadow-card" role="alert">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-500" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Não foi possível exibir esta tela</h2>
          <p className="mt-2 text-sm text-gray-500">Algum dado desta tela veio em formato inesperado. Você pode continuar usando os outros menus.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => this.setState({ error: null })}>Tentar novamente</Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>Recarregar página</Button>
          </div>
        </section>
      )
    }
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <section className="w-full max-w-lg rounded-2xl border border-red-100 bg-white p-8 text-center shadow-card" role="alert">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-500" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold text-gray-900">Não foi possível exibir esta página</h1>
          <p className="mt-2 text-sm text-gray-500">Ocorreu um erro inesperado. Recarregue a página para tentar novamente.</p>
          <Button className="mt-6" onClick={() => window.location.reload()}>Recarregar página</Button>
        </section>
      </main>
    )
  }
}
