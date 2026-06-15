import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/',          icon: '🏠', label: '首页' },
  { to: '/standards', icon: '📋', label: '报销标准查询' },
  { to: '/organize',  icon: '📂', label: '文件整理' },
  { to: '/check',     icon: '✅', label: '超标检测' },
]

const BOTTOM_ITEMS = [
  { to: '/settings', icon: '⚙️', label: '设置' },
]

export default function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar-section-label">功能模块</div>
      {NAV_ITEMS.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}

      <div style={{ flex: 1 }} />
      <div className="divider" style={{ margin: '8px 0' }} />

      {BOTTOM_ITEMS.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
