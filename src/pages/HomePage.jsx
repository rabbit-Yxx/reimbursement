import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'

const MODULES = [
  {
    to: '/standards',
    icon: '📋',
    title: '报销标准查询',
    desc: '上传公司报销标准文件，按城市查询住宿、餐费、交通等各项标准',
    color: 'from-blue-600 to-indigo-600',
    gradient: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    tags: ['Excel/PDF 解析', '城市关键词查询', '标准持久化'],
  },
  {
    to: '/organize',
    icon: '📂',
    title: '文件整理与重命名',
    desc: '批量上传发票/行程单，自动识别并按规范命名，图片转 PDF，打包下载',
    gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
    tags: ['自动识别类型', '规范命名', 'ZIP 打包'],
  },
  {
    to: '/check',
    icon: '✅',
    title: '每日超标检测',
    desc: '自动汇总每日餐费、打车费，对比标准给出调整建议，精准到每张发票',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    tags: ['按日汇总', '超标告警', '调整建议'],
  },
]

export default function HomePage() {
  const navigate = useNavigate()
  const { standards, organizeItems } = useApp()

  return (
    <div className="fade-in">
      {/* Hero */}
      <div style={{ marginBottom: 36 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(124,111,247,0.12)',
          border: '1px solid rgba(124,111,247,0.25)',
          borderRadius: 20,
          padding: '5px 14px',
          fontSize: 12,
          color: 'var(--text-accent)',
          fontWeight: 600,
          marginBottom: 16,
          letterSpacing: '0.05em',
        }}>
          <span>✨</span> 报销材料整理工具 v1.0
        </div>
        <h1 style={{ fontSize: 28, marginBottom: 10 }}>
          告别手动整理，<br />
          <span style={{
            background: 'linear-gradient(135deg, var(--accent-from), var(--accent-to))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>一键规范报销文件</span>
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 480 }}>
          自动识别发票类型、提取日期金额、按规范重命名、检测每日超标 —
          把繁琐的报销整理工作交给工具，专注在真正重要的事情上。
        </p>
      </div>

      {/* Status Bar */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 32,
        flexWrap: 'wrap',
      }}>
        <StatusPill
          icon="📋"
          label={standards ? `报销标准已加载（${Object.keys(standards).length} 个城市）` : '报销标准未上传'}
          ok={!!standards}
          onClick={() => navigate('/standards')}
        />
        <StatusPill
          icon="📂"
          label={organizeItems.length > 0 ? `${organizeItems.length} 个文件待确认` : '尚未上传文件'}
          ok={organizeItems.length > 0}
          onClick={() => navigate('/organize')}
        />
      </div>

      {/* Module Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {MODULES.map(mod => (
          <ModuleCard key={mod.to} {...mod} onClick={() => navigate(mod.to)} />
        ))}
      </div>

      {/* Quick Guide */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <div className="card-title">🗺️ 推荐使用流程</div>
        </div>
        <div style={{ display: 'flex', gap: 0, alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { num: 1, text: '上传报销标准文件', sub: '/standards' },
            { num: 2, text: '批量上传报销票据', sub: '/organize' },
            { num: 3, text: '确认识别结果后打包', sub: '/organize' },
            { num: 4, text: '查看超标检测报告', sub: '/check' },
          ].map((step, i, arr) => (
            <div key={step.num} style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1 }}>
              <div style={{ textAlign: 'center', minWidth: 80 }}>
                <div style={{
                  width: 36, height: 36,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-from), var(--accent-to))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 8px',
                  fontWeight: 700, fontSize: 14, color: '#fff',
                  boxShadow: 'var(--shadow-accent)',
                }}>
                  {step.num}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>{step.text}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{step.sub}</div>
              </div>
              {i < arr.length - 1 && (
                <div style={{ flex: 1, height: 1, background: 'var(--border-strong)', minWidth: 16 }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatusPill({ icon, label, ok, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '7px 14px',
        borderRadius: 20,
        border: `1px solid ${ok ? 'rgba(34,197,94,0.25)' : 'var(--border-strong)'}`,
        background: ok ? 'rgba(34,197,94,0.08)' : 'var(--bg-elevated)',
        color: ok ? 'var(--success)' : 'var(--text-secondary)',
        fontSize: 12.5, fontWeight: 500,
        cursor: 'pointer',
        transition: 'all var(--transition)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {icon} {label} <span style={{ opacity: 0.6, fontSize: 11 }}>→</span>
    </button>
  )
}

function ModuleCard({ icon, title, desc, gradient, tags, onClick }) {
  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.5)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = ''
        e.currentTarget.style.borderColor = ''
      }}
    >
      {/* Gradient accent top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: gradient, borderRadius: '16px 16px 0 0',
      }} />

      <div style={{
        width: 48, height: 48,
        background: gradient,
        borderRadius: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
        marginBottom: 14,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}>
        {icon}
      </div>

      <h3 style={{ marginBottom: 8, color: 'var(--text-primary)' }}>{title}</h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>{desc}</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tags.map(tag => (
          <span key={tag} className="badge badge-neutral" style={{ fontSize: 11 }}>{tag}</span>
        ))}
      </div>
    </div>
  )
}
