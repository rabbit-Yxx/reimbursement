import { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { analyzeFiles, setAnalyzerProgressCallback } from '../utils/analyzer.js'
import { packageFiles } from '../utils/packager.js'
import { optimizeInvoices } from '../utils/optimizer.js'
import { stashFile, getStashMetadata, clearStash, exportStashAsZip, removeStashItem, createStashGroup, removeStashGroup, setStashCity, getStashCity } from '../utils/stashManager.js'
import JSZip from 'jszip'

const Wrapper = ({ children, title }) => (
  <div className="flex flex-col gap-4">
    {title && <h2 className="text-xl mb-2">{title}</h2>}
    {children}
  </div>
)

export default function TripFlow() {
  const { standards, rawStandards, config, addToast } = useApp()
  const [step, _setStep] = useState(0) // 0: Start, 1: Standards, 2: Active, 3: Checkout, 4: StashMode
  const [stashCityState, setStashCityState] = useState('')
  
  // Integrate with browser history for native back button support
  useEffect(() => {
    getStashCity().then(c => {
      if (c) setStashCityState(c)
    })

    if (!window.history.state || window.history.state.step === undefined) {
      window.history.replaceState({ step: 0 }, '')
    }

    const handlePopState = (e) => {
      if (e.state && e.state.step !== undefined) {
        _setStep(e.state.step)
      } else {
        _setStep(0)
      }
    }
    
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const setStep = (newStep) => {
    if (newStep !== step) {
      window.history.pushState({ step: newStep }, '')
      _setStep(newStep)
    }
  }
  
  // Trip Config
  const [city, setCity] = useState('')
  const [districtOptions, setDistrictOptions] = useState([])
  const [tripStandards, setTripStandards] = useState(null)
  const [pendingFiles, setPendingFiles] = useState([]) // Files imported from zip
  
  // Trip Data
  const [items, setItems] = useState([])
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeMsg, setAnalyzeMsg] = useState('正在识别发票...')
  const [optimizations, setOptimizations] = useState(null)
  const [packaging, setPackaging] = useState(false)
  
  // Stash Data
  const [stashedItems, setStashedItems] = useState([])

  // Load stash on mount if going to stash mode
  useEffect(() => {
    if (step === 4) {
      loadStash()
    }
  }, [step])

  const loadStash = async () => {
    const meta = await getStashMetadata()
    setStashedItems(meta)
  }

  // Handle ZIP Import
  const handleImportZip = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const zip = new JSZip()
    try {
      const contents = await zip.loadAsync(file)
      const folderGroups = {}
      let totalFiles = 0
      for (const [filename, zipEntry] of Object.entries(contents.files)) {
        if (!zipEntry.dir) {
          const parts = filename.split('/')
          const folder = parts.length > 1 ? parts[0] : '散件区'
          const name = parts[parts.length - 1]
          
          const blob = await zipEntry.async('blob')
          if (!folderGroups[folder]) folderGroups[folder] = []
          folderGroups[folder].push(new File([blob], name, { type: blob.type }))
          totalFiles++
        }
      }
      setPendingFiles(folderGroups)
      
      const nameParts = file.name.split('_')
      const extractedCity = nameParts[0] || ''
      
      if (extractedCity && extractedCity !== '未知城市' && extractedCity !== '手机发票暂存包裹') {
        setCity(extractedCity)
        const resolution = resolveCityStandards(extractedCity)
        if (resolution && resolution.type === 'single') {
          setTripStandards(resolution.standard)
          addToast(`已识别暂存地【${extractedCity}】，自动拉取标准并开始解析...`, 'success')
          startTrip(folderGroups)
        } else {
          setStep(0)
          addToast(`成功导入 ${totalFiles} 份文件，请确认出差具体区县`, 'success')
        }
      } else {
        setStep(0)
        addToast(`成功导入 ${totalFiles} 份文件，请输入出差目的地`, 'success')
      }
    } catch (err) {
      addToast('解压失败: ' + err.message, 'error')
    }
    e.target.value = ''
  }

  const resolveCityStandards = (cityString) => {
    const cities = cityString.split(/[,，、\s]+/).map(c => c.trim()).filter(Boolean)
    if (cities.length === 0) return null

    if (cities.length === 1) {
      const c = cities[0]
      const matchedCity = rawStandards.find(l1 => l1.level1 === c || l1.level1.includes(c) || c.includes(l1.level1))
      if (matchedCity) {
        if (matchedCity.level2s.length > 1 && !matchedCity.level2s.every(l => l.name === '全市' || l.name === '市辖区' || l.name === '其他')) {
          return { type: 'options', options: matchedCity.level2s }
        } else {
          return { type: 'single', standard: matchedCity.level2s.find(l => l.name === '全市' || l.name === '市辖区') || matchedCity.level2s[0] }
        }
      } else {
        const found = standards[c]
        if (found) return { type: 'single', standard: found }
        return { type: 'single', standard: { name: c, accommodation: 500 } }
      }
    }

    let maxAcc = 0
    let maxTaxi = 0
    
    for (const c of cities) {
      let std = null
      const matchedCity = rawStandards.find(l1 => l1.level1 === c || l1.level1.includes(c) || c.includes(l1.level1))
      if (matchedCity) {
        std = matchedCity.level2s.find(l => l.name === '全市' || l.name === '市辖区') || matchedCity.level2s[0]
      } else {
        std = standards[c] || { accommodation: 500 }
      }
      
      if (std.accommodation > maxAcc) maxAcc = std.accommodation
      if (std.taxi && std.taxi > maxTaxi) maxTaxi = std.taxi
    }

    return { 
      type: 'single', 
      standard: { 
        name: cities.join('、'), 
        accommodation: maxAcc, 
        taxi: maxTaxi || config.taxiLimit, 
        isMultiCity: true
      } 
    }
  }

  // Step 0: Find standards for city
  const handleNextToStandards = () => {
    if (!city.trim()) {
      addToast('请输入出差目的地城市', 'warning')
      return
    }
    
    const resolution = resolveCityStandards(city.trim())
    if (!resolution) return
    
    if (resolution.type === 'options') {
      setDistrictOptions(resolution.options)
      return
    }
    
    setTripStandards(resolution.standard)
    if (resolution.standard.isMultiCity) {
      addToast('检测到多城市连飞，已自动采用最高标准作为参考线', 'info')
    }
    setStep(1)
  }

  const startTrip = async (groupsToProcess = pendingFiles) => {
    setStep(2)
    const folders = Object.keys(groupsToProcess)
    if (folders.length > 0) {
      setAnalyzing(true)
      setAnalyzeMsg('正在识别发票...')
      setAnalyzerProgressCallback((msg) => setAnalyzeMsg(msg))
      
      let allResults = []
      for (const folder of folders) {
        const files = groupsToProcess[folder]
        const groupType = folder.startsWith('专项组') ? 'group' : 'other'
        
        try {
          const results = await analyzeFiles(files, groupType)
          allResults = [...allResults, ...results]
        } catch (e) {
          const fallbackItems = files.map(f => ({
            file: f, originalName: f.name, text: '', expenseType: null, date: null, amount: null, role: null, status: 'incomplete'
          }))
          allResults = [...allResults, ...fallbackItems]
          addToast(`解析 ${folder} 出错已保留：` + e.message, 'warning')
        }
      }
      
      if (allResults.length > 0) {
        setItems(prev => [...prev, ...allResults])
        const recognized = allResults.filter(r => r.amount || r.expenseType)
        if (recognized.length > 0) {
          addToast(`成功识别 ${recognized.length} 份发票`, 'success')
        } else {
          addToast(`已添加 ${allResults.length} 份文件（未能自动识别内容）`, 'info')
        }
      }
      
      setAnalyzing(false)
      setAnalyzerProgressCallback(null)
      setPendingFiles({})
    }
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

  // Stash Mode Handlers
  const handleStashFiles = async (files, groupId = null) => {
    if (!files || files.length === 0) return
    let count = 0
    for (let i = 0; i < files.length; i++) {
      await stashFile(files[i], groupId)
      count++
    }
    addToast(`成功暂存 ${count} 份文件`, 'success')
    loadStash()
  }

  const handleCreateStashGroup = async () => {
    const name = window.prompt('请输入新建专项组名称（如：6月14日晚餐、万豪酒店住宿）')
    if (name && name.trim()) {
      await createStashGroup(name.trim())
      addToast('分组创建成功', 'success')
      loadStash()
    }
  }

  const handleDeleteStashGroup = async (groupId, groupName) => {
    if (window.confirm(`确定要删除整组【${groupName}】吗？包含的文件也会被一并删除。`)) {
      await removeStashGroup(groupId)
      addToast('分组已删除', 'success')
      loadStash()
    }
  }

  const handleExportStash = async () => {
    try {
      await exportStashAsZip(stashCityState || city)
      addToast('打包导出成功！', 'success')
    } catch (e) {
      addToast(e.message, 'error')
    }
  }

  const handleClearStash = async () => {
    if (confirm('确定要清空所有暂存文件吗？')) {
      await clearStash()
      setStashCityState('')
      loadStash()
      addToast('已清空暂存区', 'info')
    }
  }

  return (
    <div className="w-full">
      {step === 0 && (
        <Wrapper title="欢迎使用报销助手">
          {stashCityState && (
            <div className="card mb-4 flex justify-between items-center bg-accent text-white" style={{ cursor: 'pointer' }} onClick={() => setStep(4)}>
              <div className="flex flex-col text-left">
                <span className="font-bold">📱 进行中的手机暂存</span>
                <span className="text-sm opacity-90">继续处理 {stashCityState} 的出差发票</span>
              </div>
              <span className="font-bold">&gt;</span>
            </div>
          )}

          <div className="card flex flex-col gap-4">
            <h3 className="text-lg font-bold text-accent">你要去哪里出差？</h3>
            <p className="text-sm text-muted">输入目的地城市，自动拉取差旅标准后，可选择【手机随手拍暂存】或【电脑端全量解析】。</p>
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
                <p className="text-sm font-bold">请选择具体区县标准：</p>
                <div className="grid-2">
                  {districtOptions.map(l2 => (
                    <button key={l2.name} className="btn btn-secondary w-full" onClick={() => selectDistrict(l2)}>
                      {l2.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button className="btn btn-primary w-full" onClick={handleNextToStandards}>
                查询出差标准
              </button>
            )}
          </div>

          <div className="card flex items-center gap-3 mt-4" onClick={() => document.getElementById('import-zip').click()} style={{cursor: 'pointer'}}>
            <div className="text-3xl">📥</div>
            <div className="flex flex-col text-left">
              <span className="font-bold text-lg">电脑端一键导入解析</span>
              <span className="text-sm text-muted">导入手机导出的暂存包，全自动识别测算</span>
            </div>
            <input type="file" id="import-zip" accept=".zip" style={{display: 'none'}} onChange={handleImportZip} />
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
            {tripStandards?.isMultiCity ? (
              <p className="text-sm text-accent mt-4">
                ⚠️ 检测到多城市连飞，系统已自动选取其中最高标准作为参考上限。如有严格要求，请在最终报销时微调。
              </p>
            ) : (
              <p className="text-sm text-muted mt-4">标准已就绪，你可以随时在旅途中拍照记账了。</p>
            )}
            <div className="flex flex-col gap-3 mt-4">
              <button className="btn btn-primary w-full flex items-center justify-center gap-2" onClick={async () => {
                await setStashCity(city)
                setStashCityState(city)
                setStep(4)
              }}>
                📱 开启随手拍暂存 <span className="text-xs opacity-80">(手机操作推荐)</span>
              </button>
              <button className="btn btn-secondary w-full" onClick={() => startTrip()}>
                💻 开始电脑端全量解析
              </button>
              <button className="btn btn-secondary w-full" style={{background: 'transparent', border: 'none', textDecoration: 'underline'}} onClick={() => setStep(0)}>
                返回修改目的地
              </button>
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

      {step === 4 && (() => {
        // Compute groups
        const groups = { null: { name: '散件区 (打车、高铁票等)', items: [] } }
        stashedItems.forEach(item => {
          if (item.type === 'group_definition') {
            if (!groups[item.groupId]) groups[item.groupId] = { name: item.name, items: [] }
          } else {
            const gid = item.groupId || null
            if (!groups[gid]) groups[gid] = { name: `未知分组_${gid}`, items: [] }
            groups[gid].items.push(item)
          }
        })
        const hasAnyItems = stashedItems.length > 0

        return (
          <Wrapper title="随手拍暂存">
            <div className="flex gap-3 mb-2">
              <button className="btn btn-secondary flex-1" onClick={handleCreateStashGroup}>➕ 新建专项组 (餐饮/住宿等)</button>
            </div>


            <div className="flex flex-col gap-5">
              {Object.keys(groups).map(gid => {
                const g = groups[gid]
                // Always render all groups. The 'null' group is the general bucket.
                
                return (
                  <div key={gid} className="card flex flex-col gap-3" style={{ padding: '16px', background: gid === 'null' ? 'transparent' : 'rgba(99,102,241,0.05)' }}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <h3 className="text-md font-bold text-accent">{g.name}</h3>
                        {gid !== 'null' && (
                          <button className="text-muted" style={{ background: 'transparent', padding: '0 4px' }} onClick={() => handleDeleteStashGroup(gid, g.name)}>
                            🗑️
                          </button>
                        )}
                      </div>
                      {gid !== 'null' && <span className="text-xs text-muted">{g.items.length} 份文件</span>}
                    </div>

                    {g.items.map((item) => (
                      <div key={item.id} className="flex justify-between items-center bg-background rounded p-2 border border-border">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-ellipsis overflow-hidden whitespace-nowrap" style={{ maxWidth: '180px' }}>{item.name}</span>
                        </div>
                        <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={async () => {
                          await removeStashItem(item.id)
                          loadStash()
                        }}>删除</button>
                      </div>
                    ))}
                    
                    {g.items.length === 0 && gid !== 'null' && (
                       <span className="text-sm text-muted text-center py-2">空分组，请补充文件</span>
                    )}

                    {/* Group specific upload buttons */}
                    <div className="flex gap-2 mt-2">
                      <label className="btn btn-secondary flex-1 text-center cursor-pointer" style={{ padding: '8px' }}>
                        <input type="file" accept="image/*" capture="environment" onChange={e => { handleStashFiles(e.target.files, gid === 'null' ? null : gid); e.target.value = '' }} style={{ display: 'none' }} />
                        📷 补充拍照
                      </label>
                      <label className="btn btn-secondary flex-1 text-center cursor-pointer" style={{ padding: '8px' }}>
                        <input type="file" multiple accept="image/*,.pdf" onChange={e => { handleStashFiles(e.target.files, gid === 'null' ? null : gid); e.target.value = '' }} style={{ display: 'none' }} />
                        📁 选图补充
                      </label>
                    </div>
                    <div
                      className="chat-paste-area w-full mt-2"
                      contentEditable
                      onPaste={(e) => {
                        e.preventDefault()
                        const clipboardItems = e.clipboardData.items
                        const files = []
                        for (let i = 0; i < clipboardItems.length; i++) {
                          const item = clipboardItems[i]
                          if (item.type.startsWith('image/')) {
                            const blob = item.getAsFile()
                            if (blob) files.push(new File([blob], `粘贴截图_${Date.now()}_${i}.png`, { type: blob.type }))
                          }
                        }
                        if (files.length > 0) {
                          handleStashFiles(files, gid === 'null' ? null : gid)
                        } else {
                          addToast('剪贴板里没有图片哦', 'warning')
                        }
                        e.target.textContent = ''
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
                      data-placeholder={gid === 'null' ? "在此粘贴截图存入【散件区】..." : `在此粘贴截图存入【${g.name}】...`}
                      style={{ minHeight: '36px', fontSize: '13px' }}
                    />
                  </div>
                )
              })}

              {hasAnyItems && (
                <div className="flex gap-3 mt-4">
                  <button className="btn btn-secondary flex-1" onClick={handleClearStash}>清空暂存区</button>
                  <button className="btn btn-primary flex-1" onClick={handleExportStash}>打包导出 ZIP</button>
                </div>
              )}
            </div>
            
            <button className="btn btn-secondary w-full mt-4" onClick={() => setStep(0)}>返回首页</button>
          </Wrapper>
        )
      })()}
    </div>
  )
}
