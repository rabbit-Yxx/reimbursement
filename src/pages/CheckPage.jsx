import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'

const TYPE_LABEL = {
  train: '高铁票', flight: '机票',
  'taxi-didi': '打车(滴滴)', 'taxi-cab': '打车(出租)',
  meal: '餐费', accommodation: '住宿',
}

const DAILY_TYPES = ['meal', 'taxi-didi', 'taxi-cab']
const TAXI_TYPES = ['taxi-didi', 'taxi-cab']

function groupByDate(items) {
  const groups = {}
  for (const item of items) {
    if (!item.date || !item.expenseType) continue
    // Only count invoices for the limit check to avoid duplicating amounts from attachments
    if (item.role !== 'invoice') continue

    const d = item.date
    if (!groups[d]) groups[d] = { meal: [], taxi: [], accommodation: [] }
    if (item.expenseType === 'meal') groups[d].meal.push(item)
    if (TAXI_TYPES.includes(item.expenseType)) groups[d].taxi.push(item)
    if (item.expenseType === 'accommodation') groups[d].accommodation.push(item)
  }
  return groups
}

function generateSuggestion(items, total, limit) {
  // Sort by amount asc, suggest reducing the smallest
  const sorted = [...items].sort((a, b) => (a.amount || 0) - (b.amount || 0))
  const excess = total - limit
  let suggestion = null
  let accumulated = 0
  for (const item of sorted) {
    accumulated += (item.amount || 0)
    if (accumulated >= excess) {
      const newAmount = Math.max(0, (item.amount || 0) - excess + (accumulated - (item.amount || 0)))
      suggestion = {
        item,
        newAmount: Math.round(newAmount * 100) / 100,
      }
      break
    }
  }
  return suggestion
}

export default function CheckPage() {
  const { organizeItems, config, standards, addToast } = useApp()
  const navigate = useNavigate()
  const [city, setCity] = useState('')
  const [analyzed, setAnalyzed] = useState(false)
  const [results, setResults] = useState([])

  const handleAnalyze = () => {
    if (organizeItems.length === 0) {
      addToast('请先在「文件整理」模块上传并确认报销文件', 'error')
      return
    }
    const groups = groupByDate(organizeItems)
    const checkResults = []

    for (const [date, group] of Object.entries(groups).sort()) {
      // Check meals
      const mealTotal = group.meal.reduce((s, i) => s + (i.amount || 0), 0)
      if (group.meal.length > 0) {
        const over = mealTotal > config.mealLimit
        const suggestion = over ? generateSuggestion(group.meal, mealTotal, config.mealLimit) : null
        checkResults.push({
          date, type: 'meal', label: '餐费',
          items: group.meal, total: mealTotal,
          limit: config.mealLimit,
          over, suggestion,
        })
      }

      // Check taxi
      const taxiTotal = group.taxi.reduce((s, i) => s + (i.amount || 0), 0)
      if (group.taxi.length > 0) {
        const over = taxiTotal > config.taxiLimit
        const suggestion = over ? generateSuggestion(group.taxi, taxiTotal, config.taxiLimit) : null
        checkResults.push({
          date, type: 'taxi', label: '打车费',
          items: group.taxi, total: taxiTotal,
          limit: config.taxiLimit,
          over, suggestion,
        })
      }

      // Check accommodation
      if (group.accommodation.length > 0) {
        const cityStandard = city && standards ? (() => {
          const matchedKey = Object.keys(standards).find(k =>
            k.includes(city) || city.includes(k)
          )
          return matchedKey ? standards[matchedKey]?.accommodation : null
        })() : null

        // Find unique accommodation items (by groupId)
        const uniqueAccomm = group.accommodation.filter((item, idx, arr) =>
          arr.findIndex(a => a.groupId === item.groupId && a.role === 'invoice') === idx || item.role === 'invoice'
        )
        const accommTotal = uniqueAccomm.reduce((s, i) => s + (i.amount || 0), 0)
        const nights = uniqueAccomm.reduce((acc, item) => {
          if (item.date && item.endDate) {
            const d1 = new Date(item.date)
            const d2 = new Date(item.endDate)
            const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24))
            return acc + (diff > 0 ? diff : 1)
          }
          return acc + 1
        }, 0) || 1

        if (cityStandard && nights > 0) {
          const perNight = nights > 0 ? accommTotal / nights : accommTotal
          const over = perNight > cityStandard
          checkResults.push({
            date, type: 'accommodation', label: '住宿',
            items: uniqueAccomm, total: accommTotal,
            limit: cityStandard * nights,
            perNight, cityStandard, nights,
            over,
            suggestion: over ? {
              item: null,
              newAmount: cityStandard * nights,
              desc: `建议将住宿报销金额调整为 ${cityStandard * nights} 元（${cityStandard} × ${nights} 晚）`,
            } : null,
          })
        }
      }
    }

    setResults(checkResults)
    setAnalyzed(true)
  }

  const overCount = results.filter(r => r.over).length
  const okCount = results.filter(r => !r.over).length

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>✅ 每日超标检测</h1>
        <p>基于文件整理模块的识别结果，自动检测每日餐费、打车费是否超标</p>
      </div>

      {organizeItems.length === 0 && (
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          <span>ℹ️</span>
          <div>
            尚未有识别数据。请先前往「文件整理」模块上传并确认报销文件。
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/organize')}>
                → 前往文件整理
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">⚙️ 检测设置</div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="input-group" style={{ flex: 1, minWidth: 180 }}>
            <label className="input-label">出差目的地城市（用于检测住宿费）</label>
            <input
              className="input"
              placeholder="如：成都、北京（选填）"
              value={city}
              onChange={e => setCity(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--text-muted)', alignItems: 'center' }}>
            <span>每日餐费上限：<strong style={{ color: 'var(--text-accent)' }}>{config.mealLimit}元</strong></span>
            <span>每日打车上限：<strong style={{ color: 'var(--text-accent)' }}>{config.taxiLimit}元</strong></span>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleAnalyze}
            disabled={organizeItems.length === 0}
          >
            🔍 开始检测
          </button>
        </div>
      </div>

      {analyzed && results.length > 0 && (
        <div className="fade-in">
          {/* Summary */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{
              background: overCount > 0 ? 'var(--danger-bg)' : 'var(--success-bg)',
              border: `1px solid ${overCount > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '14px 20px',
              flex: 1,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: overCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {overCount}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>超标项</div>
            </div>
            <div style={{
              background: 'var(--success-bg)',
              border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 20px',
              flex: 1,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success)' }}>{okCount}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>正常项</div>
            </div>
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 20px',
              flex: 1,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{results.length}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>检测项总计</div>
            </div>
          </div>

          {/* Results */}
          {results.map((r, idx) => (
            <CheckItem key={idx} result={r} />
          ))}
        </div>
      )}

      {analyzed && results.length === 0 && (
        <div className="empty-state fade-in">
          <div className="empty-state-icon">🎉</div>
          <h3>所有费用均在标准范围内</h3>
          <p>未检测到超标项，报销数据符合公司规定</p>
        </div>
      )}
    </div>
  )
}

function CheckItem({ result }) {
  const [expanded, setExpanded] = useState(result.over)

  const buildFilename = (item) => {
    const amountStr = item.amount ? `${item.amount}元` : 'XX元'
    const dateStr = item.date ? item.date.replace(/-/g, '') : 'XXXXXXXX'
    const roleMap = { invoice: '发票', itinerary: '行程单', receipt: '水单', payment: '支付记录' }
    const roleStr = roleMap[item.role] || ''
    return `${dateStr} ${TYPE_LABEL[item.expenseType] || ''} ${amountStr} ${roleStr}.pdf`
  }

  return (
    <div className={`check-item ${result.over ? 'over-limit' : 'under-limit'}`}>
      <div className="check-item-header" onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
        <div className="check-item-title">
          <span>{result.over ? '📅' : '✅'}</span>
          <span>{result.date}</span>
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 13 }}>·</span>
          <span>{result.label}</span>
          {result.over
            ? <span className="badge badge-error">超标 {(result.total - result.limit).toFixed(2)} 元</span>
            : <span className="badge badge-ok">未超标</span>
          }
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            合计 <strong style={{ color: result.over ? 'var(--danger)' : 'var(--success)' }}>{result.total}</strong> 元
            / 上限 {result.limit} 元
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="fade-in">
          <div style={{ marginBottom: 8 }}>
            {result.items.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '5px 0',
                fontSize: 13, color: 'var(--text-secondary)',
                borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>• {buildFilename(item)}</span>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.amount} 元</span>
              </div>
            ))}
          </div>

          {result.suggestion && (
            <div className="suggestion-box">
              <span>💡</span>
              <div>
                {result.suggestion.desc || (
                  <>
                    建议将「<span style={{ fontFamily: 'monospace' }}>{buildFilename(result.suggestion.item)}</span>」
                    的报销金额改为 <strong>{result.suggestion.newAmount} 元</strong>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
