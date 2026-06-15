import { useApp } from '../context/AppContext.jsx'

export default function ToastContainer() {
  const { toasts, removeToast } = useApp()
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast-${t.type}`}
          onClick={() => removeToast(t.id)}
          style={{ cursor: 'pointer' }}
        >
          <span>{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
