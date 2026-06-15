import { useState } from 'react'
import defaultStandards from '../data/default-standards.json'

export default function StandardsPage() {
  const [query, setQuery] = useState('')
  const [queryResults, setQueryResults] = useState(null)

  const handleQuery = () => {
    if (!query.trim()) return
    const q = query.trim()
    const results = []

    for (const l1 of defaultStandards) {
      // 1. Check if Level 1 matches
      const isL1Match = l1.level1.includes(q) || q.includes(l1.level1)
      
      if (isL1Match) {
        results.push({
          level1: l1.level1,
          cities: l1.level2s
        })
      } else {
        // 2. Check if any Level 2 matches
        const matchedL2s = l1.level2s.filter(c =>
          c.name.includes(q) || q.includes(c.name) || q.replace(/市|省|区/, '') === c.name.replace(/市|省|区/, '')
        )
        if (matchedL2s.length > 0) {
          results.push({
            level1: l1.level1,
            cities: matchedL2s
          })
        }
      }
    }

    setQueryResults(results)
  }

  const EXPENSE_LABELS = {
    meal: '餐费',
    taxi: '打车费',
    accommodation: '住宿',
  }

  const totalCities = defaultStandards.reduce((acc, l1) => acc + l1.level2s.length, 0)

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
      <div className="page-header" style={{ marginBottom: 0, flexShrink: 0 }}>
        <h1>📋 报销标准查询</h1>
        <p>内置公司最新报销标准，按一级分类（如省份、单列市）或二级分类（如城市、区）查询</p>
      </div>

      {/* Top: Query */}
      <div className="card" style={{ flexShrink: 0 }}>
        <div className="card-header">
          <div className="card-title">🔎 标准快速查询</div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input
            className="input"
            placeholder="输入分类名称，如：河北、青岛、天津、津南区"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleQuery()}
            style={{ maxWidth: 400 }}
          />
          <button className="btn btn-primary" onClick={handleQuery} disabled={!query.trim()}>
            查询
          </button>
        </div>
        
        {queryResults && queryResults.length === 0 && (
          <div className="alert alert-warning" style={{ maxWidth: 600 }}>
            <span>⚠️</span>
            <span>未找到「{query}」的报销标准，请尝试只输入一级分类或主要二级分类名</span>
          </div>
        )}
        
        {queryResults && queryResults.length > 0 && (
          <div className="fade-in" style={{ maxWidth: 800 }}>
            {queryResults.map((res, i) => (
              <div key={i} style={{ marginBottom: i < queryResults.length - 1 ? 24 : 0 }}>
                <div style={{
                  fontSize: 16, fontWeight: 600, marginBottom: 14,
                  color: 'var(--text-primary)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  📍 {res.level1} 报销标准 {res.cities.length === 1 ? ` - ${res.cities[0].name}` : ''}
                </div>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {res.cities.length > 1 && <th>二级分类</th>}
                        <th style={{ whiteSpace: 'nowrap' }}>餐费</th>
                        <th style={{ whiteSpace: 'nowrap' }}>打车费</th>
                        <th style={{ whiteSpace: 'nowrap' }}>住宿</th>
                        <th>备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {res.cities.map((city, idx) => (
                        <tr key={idx}>
                          {res.cities.length > 1 && <td style={{ fontWeight: 500 }}>{city.name}</td>}
                          <td style={{ whiteSpace: 'nowrap' }}><strong style={{ color: 'var(--text-accent)' }}>{city.meal} 元</strong></td>
                          <td style={{ whiteSpace: 'nowrap' }}><strong style={{ color: 'var(--text-accent)' }}>{city.taxi} 元</strong></td>
                          <td style={{ whiteSpace: 'nowrap' }}><strong style={{ color: 'var(--text-accent)' }}>{city.accommodation} 元</strong></td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            {city.peak ? `旺季(${city.peak.period}): ${city.peak.accommodation}元` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom: All categories overview */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div className="card-header">
          <div className="card-title">🗺️ 全部分类标准总览</div>
          <span className="badge badge-info">共 {totalCities} 个细分项</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '100px', position: 'sticky', top: 0, zIndex: 2 }}>一级分类</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2 }}>二级分类</th>
                  <th style={{ width: '80px', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2 }}>餐费</th>
                  <th style={{ width: '80px', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2 }}>打车费</th>
                  <th style={{ width: '80px', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2 }}>住宿</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2 }}>备注</th>
                </tr>
              </thead>
              <tbody>
                {defaultStandards.map((l1) => (
                  l1.level2s.map((l2, l2Index) => (
                    <tr key={l1.level1 + l2.name}>
                      {l2Index === 0 && (
                        <td 
                          rowSpan={l1.level2s.length} 
                          style={{ 
                            verticalAlign: 'middle', 
                            fontWeight: 600, 
                            backgroundColor: 'var(--bg-secondary)',
                            borderRight: '1px solid var(--border)'
                          }}
                        >
                          {l1.level1}
                        </td>
                      )}
                      <td style={{ fontWeight: 500 }}>{l2.name}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{l2.meal ? `${l2.meal}元` : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{l2.taxi ? `${l2.taxi}元` : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{l2.accommodation ? `${l2.accommodation}元` : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {l2.peak ? `旺季(${l2.peak.period}): ${l2.peak.accommodation}元` : ''}
                      </td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
