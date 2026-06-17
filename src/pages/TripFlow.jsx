import { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { analyzeFiles, setAnalyzerProgressCallback } from '../utils/analyzer.js'
import { packageFiles } from '../utils/packager.js'
import { optimizeInvoices } from '../utils/optimizer.js'

const Wrapper = ({ children, title }) => (
  <div className="flex flex-col gap-4">
    {title && <h2 className="text-xl mb-2">{title}</h2>}
    {children}
  </div>
)

export default function TripFlow() {
  const { standards, rawStandards, config, addToast } = useApp()
  const [step, setStep] = useState(0) // 0: Start, 1: Standards, 2: Active, 3: Checkout
  
  // Trip Config
  const [city, setCity] = useState('')
  const [districtOptions, setDistrictOptions] = useState([])
  const [tripStandards, setTripStandards] = useState(null)
  
  // Trip Data
  const [items, setItems] = useState([])
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeMsg, setAnalyzeMsg] = useState('正在识别发票...')
  const [optimizations, setOptimizations] = useState(null)
  const [packaging, setPackaging] = useState(false)

  // Step 0: Find standards for city
  const handleNextToStandards = () => {
    if (!city.trim()) {
      addToast('请输入出差目的地城市', 'warning')
      return
    }
    
    // Check if the input matches a level1 city in rawStandards
    const matchedCity = rawStandards.find(l1 => l1.level1 === city.trim() || l1.level1.includes(city.trim()) || city.trim().includes(l1.level1))
    
    if (matchedCity) {
      if (matchedCity.level2s.length > 1 && !matchedCity.level2s.every(l => l.name === '全市' || l.name === '市辖区' || l.name === '其他')) {
        // Has multiple districts, let user choose
        setDistrictOptions(matchedCity.level2s)
        return
      } else {
        // Only one main standard
        setTripStandards(matchedCity.level2s.find(l => l.name === '全市' || l.name === '市辖区') || matchedCity.level2s[0])
      }
    } else {
      let found = standards[city.trim()]
      if (found) {
        setTripStandards(found)
      } else {
        setTripStandards({ name: city, accommodation: 500 }) // fallback
        addToast('未找到该城市的特定标准，使用默认标准', 'info')
      }
    }
    setStep(1)
  }

  const selectDistrict = (l2) => {
    setTripStandards(l2)
    setDistrictOptions([])
    setStep(1)
  }

  // Step 2: Upload Files
  const handleFiles = async (files) => {
    if (!files || files.length === 0) return
    const fileArray = Array.from(files)
    setAnalyzing(true)
    setAnalyzeMsg('正在识别发票...')
    setAnalyzerProgressCallback((msg) => setAnalyzeMsg(msg))
    try {
      const results = await analyzeFiles(fileArray, 'other')
      if (results && results.length > 0) {
        setItems(prev => [...prev, ...results])
        const recognized = results.filter(r => r.amount || r.expenseType)
        if (recognized.length > 0) {
          addToast(`成功识别 ${recognized.length} 份发票`, 'success')
        } else {
          addToast(`已添加 ${results.length} 份文件（未能自动识别内容）`, 'info')
        }
      }
    } catch (e) {
      // Even on error, add files with minimal info so user doesn't lose them
      const fallbackItems = fileArray.map(f => ({
        file: f,
        originalName: f.name,
        text: '',
        expenseType: null,
        date: null,
        amount: null,
        role: null,
        status: 'incomplete',
      }))
      setItems(prev => [...prev, ...fallbackItems])
      addToast('识别出错，文件已保留：' + e.message, 'warning')
    }
    setAnalyzing(false)
    setAnalyzerProgressCallback(null)
  }

  // Step 3: Run Optimizer
  const handleEndTrip = () => {
    const incomplete = items.filter(i => !i.expenseType || !i.date || !i.amount)
    if (incomplete.length > 0) {
      addToast(`还有 ${incomplete.length} 个文件信息不完整，由于是自动模式，我们将尽量保留它们。`, 'warning')
    }
    
    const result = optimizeInvoices(items, tripStandards, config)
    setOptimizations(result)
    setStep(3)
  }

  const handlePackage = async () => {
    if (!optimizations) return
    setPackaging(true)
    try {
      // Map to proper filenames for packaging
      const itemsWithFilenames = optimizations.itemsToKeep.map((item, index) => {
        const ext = item.originalName.split('.').pop()
        // Format: 日期_类型_金额.ext
        const safeAmount = item.amount ? item.amount.toFixed(2) : '0.00'
        const typeStr = item.expenseType === 'meal' ? '餐饮' : item.expenseType === 'accommodation' ? '住宿' : item.expenseType?.startsWith('taxi') ? '打车' : item.expenseType === 'train' ? '高铁' : item.expenseType === 'flight' ? '机票' : '其他'
        const newFilename = `${item.date || '未知日期'}_${typeStr}_${safeAmount}元_${index}.${ext}`
        
        return { ...item, newFilename }
      })
      
      const result = await packageFiles(itemsWithFilenames)
      if (result.success) {
        addToast('打包成功！文件已开始下载', 'success')
      } else {
        addToast('打包失败：' + (result.error || '未知错误'), 'error')
      }
    } catch (e) {
      addToast('打包出错：' + e.message, 'error')
    }
    setPackaging(false)
  }


  return (
    <div className="w-full">
      {step === 0 && (
        <Wrapper title="你要去哪里出差？">
          <div className="card flex flex-col gap-4">
            <p className="text-muted">请输入目的地城市，我们将自动匹配差旅标准。</p>
            <div className="input-group">
              <input 
                type="text" 
                className="input" 
                placeholder="例如：北京、上海、青岛..." 
                value={city}
                onChange={e => {
                  setCity(e.target.value)
                  setDistrictOptions([]) // reset if typing
                }}
                onKeyDown={e => e.key === 'Enter' && handleNextToStandards()}
              />
            </div>
            
            {districtOptions.length > 0 ? (
              <div className="flex flex-col gap-3 mt-4">
                <p className="text-sm text-accent">请选择具体区县：</p>
                <div className="grid-2">
                  {districtOptions.map(l2 => (
                    <button key={l2.name} className="btn btn-secondary" onClick={() => selectDistrict(l2)}>
                      {l2.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button className="btn btn-primary mt-4" onClick={handleNextToStandards}>
                下一步
              </button>
            )}
          </div>
        </Wrapper>
      )}

      {step === 1 && (
        <Wrapper title="出差标准已确认">
          <div className="card flex flex-col gap-4">
            <div className="grid-3">
              <div className="flex flex-col gap-2">
                <span className="text-sm text-muted">目的地</span>
                <span className="text-lg font-bold">{tripStandards?.name || city}</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm text-muted">住宿上限</span>
                <span className="text-lg font-bold text-accent">¥ {tripStandards?.accommodation || 500}/天</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm text-muted">打车上限</span>
                <span className="text-lg font-bold text-accent">¥ {tripStandards?.taxi || config.taxiLimit}/天</span>
              </div>
            </div>
            <p className="text-sm text-muted mt-4">标准已就绪，你可以随时在旅途中拍照记账了。</p>
            <div className="flex gap-3 mt-4">
              <button className="btn btn-secondary flex-1" onClick={() => setStep(0)}>返回修改</button>
              <button className="btn btn-primary flex-1" onClick={() => setStep(2)}>开始出差</button>
            </div>
          </div>
        </Wrapper>
      )}

      {step === 2 && (
        <Wrapper title={`正在出差：${tripStandards?.name || city}`}>
          {/* Chat-style uploaded items list */}
          {items.length > 0 && (
            <div className="flex flex-col gap-3">
              {items.map((item, idx) => (
                <div key={idx} className="card flex justify-between items-center" style={{ padding: '12px 16px' }}>
                  <div className="flex flex-col gap-1">
                    <span className="font-bold">{item.date || '未知日期'} · {item.expenseType === 'meal' ? '餐饮' : item.expenseType === 'accommodation' ? '住宿' : item.expenseType?.startsWith('taxi') ? '打车' : item.expenseType === 'train' ? '高铁' : item.expenseType === 'flight' ? '机票' : '其他'}</span>
                    <span className="text-sm text-muted text-ellipsis overflow-hidden whitespace-nowrap" style={{ maxWidth: '200px' }}>{item.originalName}</span>
                  </div>
                  <div className="text-lg font-bold text-accent">
                    ¥ {item.amount || '0.00'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {items.length === 0 && (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <div className="empty-state-icon">📋</div>
              <h3>还没有发票</h3>
              <p>在下方粘贴截图，或点击📷/📁按钮上传</p>
            </div>
          )}

          {analyzing && (
            <div className="card flex items-center gap-3" style={{ padding: '12px 16px', borderColor: 'rgba(99,102,241,0.3)' }}>
              <div className="spinner"></div>
              <span className="text-sm text-accent">{analyzeMsg}</span>
            </div>
          )}

          {items.length > 0 && (
            <button className="btn btn-primary w-full" onClick={handleEndTrip}>
              结束出差并结算
            </button>
          )}

          {/* Chat-style input bar at bottom */}
          <div className="chat-input-bar">
            <label className="chat-action-btn">
              <input type="file" accept="image/*" capture="environment" onChange={e => { handleFiles(e.target.files); e.target.value = '' }} style={{ display: 'none' }} />
              📷
            </label>
            <label className="chat-action-btn">
              <input type="file" multiple accept="image/*,.pdf" onChange={e => { handleFiles(e.target.files); e.target.value = '' }} style={{ display: 'none' }} />
              📁
            </label>
            <div
              className="chat-paste-area"
              contentEditable
              onPaste={(e) => {
                e.preventDefault()
                const clipboardItems = e.clipboardData.items
                const files = []
                for (let i = 0; i < clipboardItems.length; i++) {
                  const item = clipboardItems[i]
                  if (item.type.startsWith('image/')) {
                    const blob = item.getAsFile()
                    if (blob) {
                      const file = new File([blob], `粘贴图片_${Date.now()}_${i}.png`, { type: blob.type })
                      files.push(file)
                    }
                  }
                }
                if (files.length > 0) {
                  handleFiles(files)
                  e.target.textContent = ''
                } else {
                  addToast('剪贴板里没有图片哦', 'warning')
                }
                e.target.textContent = ''
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault()
              }}
              data-placeholder="在这里粘贴发票截图..."
            />
          </div>
        </Wrapper>
      )}

      {step === 3 && optimizations && (
        <Wrapper title="智能结算报告">
          
          {optimizations.suggestions.length > 0 ? (
            <div className="flex flex-col gap-3 mb-6">
              <h3 className="text-lg text-warning">💡 优化建议</h3>
              {optimizations.suggestions.map((sug, idx) => (
                <div key={idx} className="card" style={{ padding: '16px', background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.2)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="badge badge-warn">{sug.type === 'remove' ? '建议剔除' : '建议截断'}</span>
                    <span className="font-bold">{sug.item.date} {sug.item.expenseType.startsWith('taxi') ? '打车' : '餐饮'}发票</span>
                  </div>
                  <p className="text-sm text-secondary">{sug.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="alert alert-success mb-6">
              <span>🎉 所有发票均未超标，完美合规！</span>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <h3 className="text-lg">打包清单 ({optimizations.itemsToKeep.length} 份)</h3>
            {optimizations.itemsToKeep.map((item, idx) => (
              <div key={idx} className="card flex justify-between items-center" style={{ padding: '12px 16px' }}>
                <div className="flex flex-col gap-1">
                  <span className="font-bold">{item.date || '未知日期'}</span>
                </div>
                <div className="text-lg font-bold">
                  ¥ {item.amount || '0.00'}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
            <button className="btn btn-secondary flex-1" onClick={() => setStep(2)}>返回补充</button>
            <button className="btn btn-primary flex-1" onClick={handlePackage} disabled={packaging}>
              {packaging ? '打包中...' : '一键打包下载'}
            </button>
          </div>
          
        </Wrapper>
      )}
    </div>
  )
}
