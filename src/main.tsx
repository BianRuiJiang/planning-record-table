import { StrictMode } from 'react'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// 渲染异常时给出可见提示，避免整页白屏且没有错误信息。
class ErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state: { message: string | null } = { message: null }

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : '页面发生未知错误' }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('界面异常', error, info)
  }

  render() {
    if (this.state.message) {
      return (
        <main className="shell">
          <div className="card status-card">
            <h1>页面出错了</h1>
            <p className="error-text">{this.state.message}</p>
            <button className="primary-button" type="button" onClick={() => window.location.reload()}>
              重新加载
            </button>
          </div>
        </main>
      )
    }
    return this.props.children
  }
}

const container = document.getElementById('root')
if (!container) throw new Error('找不到 #root 挂载点')

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
