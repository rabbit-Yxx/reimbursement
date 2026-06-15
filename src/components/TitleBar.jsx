export default function TitleBar() {
  const api = window.electronAPI

  return (
    <div className="titlebar">
      <div className="titlebar-logo">
        <div className="logo-icon">💼</div>
        <span className="logo-text">报销材料整理工具</span>
      </div>
      <div className="titlebar-drag" />
      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={() => api?.windowMinimize()} title="最小化">
          ─
        </button>
        <button className="titlebar-btn" onClick={() => api?.windowMaximize()} title="最大化">
          □
        </button>
        <button className="titlebar-btn close" onClick={() => api?.windowClose()} title="关闭">
          ✕
        </button>
      </div>
    </div>
  )
}
