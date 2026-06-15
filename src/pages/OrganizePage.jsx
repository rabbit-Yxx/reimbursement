import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { analyzeFiles } from '../utils/analyzer.js'
import { packageFiles } from '../utils/packager.js'

const EXPENSE_TYPE_OPTIONS = [
  { value: 'train',         label: '高铁票' },
  { value: 'flight',        label: '机票' },
  { value: 'taxi-didi',     label: '打车-滴滴' },
  { value: 'taxi-cab',      label: '打车-出租车' },
  { value: 'meal',          label: '餐费' },
  { value: 'accommodation', label: '住宿' },
]

const ROLE_OPTIONS = [
  { value: 'invoice',      label: '发票' },
  { value: 'itinerary',    label: '行程单' },
  { value: 'receipt',      label: '水单' },
  { value: 'payment',      label: '支付记录' },
  { value: 'attachment1',  label: '附件1' },
  { value: 'attachment2',  label: '附件2' },
  { value: 'attachment3',  label: '附件3' },
  { value: 'attachment4',  label: '附件4' },
]

const TYPE_LABEL = Object.fromEntries(EXPENSE_TYPE_OPTIONS.map(o => [o.value, o.label]))
const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map(o => [o.value, o.label]))

function buildFilename(item) {
  const amountStr = item.amount ? `${item.amount}元` : 'XX元'
  const roleStr = ROLE_LABEL[item.role] || '未知'
  const dateStr = item.date ? item.date.replace(/-/g, '') : 'XXXXXXXX'
  const ext = (item.originalName || '').match(/\.[^.]+$/) || ['.pdf']
  const fileExt = ext[0]
  let typeStr = '未知'
  switch (item.expenseType) {
    case 'train': typeStr = '高铁票'; break
    case 'flight': typeStr = '机票'; break
    case 'taxi-didi':
    case 'taxi-cab': typeStr = '打车'; break
    case 'meal': typeStr = '餐费'; break
    case 'accommodation': {
      const endStr = item.endDate ? item.endDate.replace(/-/g, '') : dateStr
      return `${dateStr}-${endStr} 住宿 ${amountStr} ${roleStr}${fileExt}`
    }
  }
  return `${dateStr} ${typeStr} ${amountStr} ${roleStr}${fileExt}`
}

function isItemComplete(item) {
  return item.expenseType && item.date && item.amount && item.role
}

const UploadButton = ({ label, onFiles, isPrimary }) => {
  const fileInputRef = useRef()
  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.bmp,.tiff,.webp"
        multiple
        style={{ display: 'none' }}
        onChange={e => {
          if (e.target.files.length) {
            onFiles(e.target.files)
            e.target.value = ''
          }
        }}
      />
      <button 
        className={`btn ${isPrimary ? 'btn-primary' : 'btn-secondary'}`} 
        onClick={() => fileInputRef.current?.click()}
      >
        {label}
      </button>
    </>
  )
}

const STEPS = ['上传文件', '识别中', '确认预览', '打包下载']

export default function OrganizePage() {
  const { setOrganizeItems, addToast } = useApp()
  const navigate = useNavigate()
  const [step, setStep] = useState(0) // 0=upload, 1=analyzing, 2=preview, 3=done
  const [items, setItems] = useState([])
  const [packaging, setPackaging] = useState(false)
  const [mealCount, setMealCount] = useState(1)
  const [showReference, setShowReference] = useState(false)

  const handleFiles = async (files, groupType) => {
    if (!files || files.length === 0) return
    const fileArray = Array.from(files)
    setStep(1)
    try {
      const results = await analyzeFiles(fileArray, groupType)
      if (results) {
        setItems(prev => {
          const newItems = [...prev, ...results]
          setOrganizeItems(newItems)
          return newItems
        })
        if (groupType === 'meal') setMealCount(prev => prev + 1)
        setStep(2)
        const incomplete = results.filter(r => !isItemComplete(r)).length
        if (incomplete > 0) {
          addToast(`新增 ${results.length} 个文件中，有 ${incomplete} 个未完全识别，请手动补填`, 'error')
        } else {
          addToast(`新增 ${results.length} 个文件识别完成`, 'info')
        }
      }
    } catch (e) {
      addToast('识别出错：' + e.message, 'error')
      setStep(prev => prev === 1 ? (items.length > 0 ? 2 : 0) : prev)
    }
  }

  const updateItem = (idx, field, value) => {
    setItems(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: value }
      return updated
    })
  }

  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const handlePackage = async () => {
    const incomplete = items.filter(i => !isItemComplete(i))
    if (incomplete.length > 0) {
      addToast(`还有 ${incomplete.length} 个文件信息不完整，请补填后再打包`, 'error')
      return
    }
    setPackaging(true)
    try {
      const itemsWithFilenames = items.map(item => ({
        ...item,
        newFilename: buildFilename(item)
      }))
      const result = await packageFiles(itemsWithFilenames)
      if (result?.success) {
        setOrganizeItems(items)
        setStep(3)
        addToast('打包成功！文件已开始下载', 'success')
      } else {
        addToast('打包失败：' + (result?.error || '未知错误'), 'error')
      }
    } catch (e) {
      addToast('打包出错：' + e.message, 'error')
    }
    setPackaging(false)
  }

  const resetAll = () => {
    setStep(0)
    setItems([])
    setMealCount(1)
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>📂 文件整理与重命名</h1>
          <p>批量上传报销文件，自动识别类型并按规范命名，打包成 ZIP 下载</p>
        </div>
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={() => setShowReference(true)}
          style={{ marginTop: 8 }}
        >
          📖 命名规范参考
        </button>
      </div>

      {/* Steps indicator */}
      <div className="steps">
        {STEPS.map((label, i) => (
          <div key={label} className={`step ${i === step ? 'active' : i < step ? 'done' : ''}`}>
            <div className="step-num">{i < step ? '✓' : i + 1}</div>
            <span className="step-label">{label}</span>
          </div>
        ))}
      </div>

      {/* Upload Zones (Visible in Step 0 and Step 2) */}
      {(step === 0 || step === 2) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-title" style={{ marginBottom: 8 }}>🍽️ 餐费 / 住宿区</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              每笔消费的“发票 + 支付记录 / 水单”需单独一次上传，系统会自动关联金额和入住日期等信息。
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 'auto' }}>
              <UploadButton 
                label={`+ 分组上传 (第 ${mealCount} 笔)`} 
                onFiles={f => handleFiles(f, 'meal')} 
                isPrimary 
              />
            </div>
          </div>
          
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-title" style={{ marginBottom: 8 }}>🚕 其他区（批量）</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              打车、高铁、机票等无需互相捆绑的费用，可一次性框选所有文件批量上传。
            </div>
            <div style={{ marginTop: 'auto' }}>
              <UploadButton 
                label="📁 批量上传其他文件" 
                onFiles={f => handleFiles(f, 'other')} 
                isPrimary={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Analyzing */}
      {step === 1 && (
        <div className="card" style={{ minHeight: 200, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>正在分析文件...</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>提取文本、识别类型、匹配关联文件</div>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {(step === 2 || step === 3) && items.length > 0 && (
        <div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
            }}>
              <div className="card-title">
                🔍 识别结果预览
                <span className="badge badge-neutral" style={{ marginLeft: 8 }}>{items.length} 个文件</span>
                {items.filter(i => !isItemComplete(i)).length > 0 && (
                  <span className="badge badge-error" style={{ marginLeft: 6 }}>
                    {items.filter(i => !isItemComplete(i)).length} 个需补填
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={resetAll}>重新上传</button>
                {step === 2 && (
                  <button
                    className="btn btn-primary"
                    onClick={handlePackage}
                    disabled={packaging}
                  >
                    {packaging ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> 打包中...</> : '📦 生成打包文件'}
                  </button>
                )}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th>原文件名</th>
                    <th>费用类型</th>
                    <th>日期</th>
                    <th>金额（元）</th>
                    <th>文件角色</th>
                    <th>新文件名预览</th>
                    <th>状态</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const complete = isItemComplete(item)
                    return (
                      <tr key={idx} className={complete ? '' : 'row-error'}>
                        <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-muted)' }}>
                          {item.originalName}
                        </td>
                        <td>
                          <select
                            className="select"
                            style={{ width: '100%', fontSize: 12.5, padding: '5px 8px' }}
                            value={item.expenseType || ''}
                            onChange={e => updateItem(idx, 'expenseType', e.target.value || null)}
                          >
                            <option value="">-- 未识别 --</option>
                            {EXPENSE_TYPE_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className={`table-input ${!item.date ? 'error' : ''}`}
                            type="date"
                            value={item.date || ''}
                            onChange={e => updateItem(idx, 'date', e.target.value || null)}
                            style={{ minWidth: 120 }}
                          />
                        </td>
                        <td>
                          <input
                            className={`table-input ${!item.amount ? 'error' : ''}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.amount || ''}
                            onChange={e => updateItem(idx, 'amount', parseFloat(e.target.value) || null)}
                            style={{ width: 80 }}
                          />
                        </td>
                        <td>
                          <select
                            className="select"
                            style={{ width: '100%', fontSize: 12.5, padding: '5px 8px' }}
                            value={item.role || ''}
                            onChange={e => updateItem(idx, 'role', e.target.value || null)}
                          >
                            <option value="">-- 未识别 --</option>
                            {ROLE_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-accent)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {complete ? buildFilename(item) : <span style={{ color: 'var(--danger)' }}>请补全信息</span>}
                        </td>
                        <td>
                          {complete
                            ? <span className="badge badge-ok">✅ 已识别</span>
                            : <span className="badge badge-error">⚠️ 需补填</span>
                          }
                        </td>
                        <td>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => removeItem(idx)}
                            title="移除此文件"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {step === 3 && (
            <div className="alert alert-success fade-in" style={{ marginTop: 16 }}>
              <span>✅</span>
              <div>
                <strong>打包完成！</strong> 文件已保存到您选择的位置。
                超标检测将基于此次整理结果进行分析。
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate('/check')}>
                    → 前往超标检测
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Naming Guide Modal */}
      {showReference && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }} onClick={() => setShowReference(false)}>
          <div className="card fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 800, width: '90%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title">📖 命名规范参考</div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowReference(false)} style={{ padding: '4px 8px' }}>✕ 关闭</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {[
                { type: '高铁票 / 机票', files: 1, example: '20260620 高铁票 360元 发票.pdf' },
                { type: '打车-滴滴', files: 2, example: '20260620 打车 20元 发票.pdf\n20260620 打车 20元 行程单.pdf' },
                { type: '打车-出租车', files: 1, example: '20260620 打车 20元 发票.pdf' },
                { type: '餐费（每笔一起传）', files: 3, example: '20260620 餐费 100元 发票.pdf\n20260620 餐费 100元 附件1.pdf\n20260620 餐费 100元 附件2.pdf' },
                { type: '住宿', files: 2, example: '20260618-20260620 住宿 500元 发票.pdf\n20260618-20260620 住宿 500元 附件1.pdf' },
              ].map(item => (
                <div key={item.type} style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{item.type}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>共 {item.files} 个文件</div>
                  <pre style={{
                    fontSize: 10.5, color: 'var(--text-accent)',
                    background: 'var(--bg-base)',
                    padding: '6px 8px', borderRadius: 4,
                    whiteSpace: 'pre-wrap', lineHeight: 1.7,
                    fontFamily: 'monospace',
                  }}>
                    {item.example}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
