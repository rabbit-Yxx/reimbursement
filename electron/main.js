import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import os from 'os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged
const DEV_URL = 'http://127.0.0.1:5173'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })

  // Show window only when content is ready
  mainWindow.once('ready-to-show', () => mainWindow.show())

  if (isDev) {
    mainWindow.loadURL(DEV_URL)
    mainWindow.webContents.openDevTools()

    // Auto-retry if Vite isn't ready yet
    mainWindow.webContents.on('did-fail-load', (_e, errCode) => {
      if (errCode === -102 || errCode === -6) {
        // ERR_CONNECTION_REFUSED or ERR_NAME_NOT_RESOLVED — retry after 800ms
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL(DEV_URL)
          }
        }, 800)
      }
    })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (mainWindow === null) createWindow() })

// ─── Window Controls ─────────────────────────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window-close', () => mainWindow?.close())


// ─── Config / Persistence ─────────────────────────────────────────────────────
const configPath = path.join(app.getPath('userData'), 'config.json')
const standardsPath = path.join(app.getPath('userData'), 'standards.json')

function readJSON(filePath, defaultVal = {}) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {}
  return defaultVal
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

ipcMain.handle('config:get', () => {
  return readJSON(configPath, {
    mealLimit: 140,
    taxiLimit: 112,
  })
})

ipcMain.handle('config:set', (_e, data) => {
  writeJSON(configPath, data)
  return true
})

ipcMain.handle('standards:get', () => readJSON(standardsPath, null))

ipcMain.handle('standards:set', (_e, data) => {
  writeJSON(standardsPath, data)
  return true
})

// ─── File Dialogs ─────────────────────────────────────────────────────────────
ipcMain.handle('dialog:openFile', async (_e, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options)
  return result
})

ipcMain.handle('dialog:saveFile', async (_e, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options)
  return result
})

ipcMain.handle('shell:openPath', (_e, filePath) => shell.openPath(filePath))

// ─── Standards: Parse Excel / PDF ────────────────────────────────────────────
ipcMain.handle('standards:parseFile', async (_e, filePath) => {
  const ext = path.extname(filePath).toLowerCase()
  try {
    if (ext === '.xlsx' || ext === '.xls') {
      return await parseStandardsExcel(filePath)
    } else if (ext === '.pdf') {
      return await parseStandardsPDF(filePath)
    }
    return { error: '不支持的文件格式' }
  } catch (err) {
    return { error: err.message }
  }
})

async function parseStandardsExcel(filePath) {
  const XLSX = await import('xlsx')
  const buf = fs.readFileSync(filePath)
  const workbook = XLSX.read(buf, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

  const cities = {}
  let currentProvince = ''

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length < 5) continue

    let col1 = String(row[1] || '').trim() // 省份/主要城市
    let col2 = String(row[2] || '').trim() // 详情/下级城市

    if (col1 === '地区' || col1.includes('城市')) continue

    if (col1) {
      currentProvince = col1
    }

    let targets = new Set()
    
    // 如果有省份或主要城市名字，加进去
    if (col1) targets.add(col1)

    // 解析详情列中的多个城市（如 "石家庄市、张家口市..."）
    if (col2 && col2 !== '全市' && !col2.includes('其他地区')) {
      const parts = col2.split(/[、，, \n]+/).map(s => s.trim()).filter(Boolean)
      parts.forEach(p => targets.add(p))
    }

    // 取“其他人员”的标准，如果没有再取“公司负责人”
    const accommodation = parseFloat(row[4]) || parseFloat(row[3]) || 0
    const taxi = parseFloat(row[9]) || 0
    const meal = parseFloat(row[10]) || 0

    if (accommodation > 0 || taxi > 0 || meal > 0) {
      for (const t of targets) {
        if (!cities[t]) cities[t] = {}
        // 只有没设置过才写入，防止"其他地区"覆盖省会标准
        if (!cities[t].accommodation && accommodation > 0) cities[t].accommodation = accommodation
        if (!cities[t].taxi && taxi > 0) cities[t].taxi = taxi
        if (!cities[t].meal && meal > 0) cities[t].meal = meal
      }
    }
  }

  return { data: cities }
}

async function parseStandardsPDF(filePath) {
  const { PDFParse } = await import('pdf-parse')
  const buffer = fs.readFileSync(filePath)
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  await parser.destroy()
  const text = result.text
  return extractStandardsFromText(text)
}

function extractStandardsFromText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const cities = {}
  const cityPattern = /^([\u4e00-\u9fa5]{2,6}(?:市|省|区|县)?)/
  const amountPattern = /(\d+(?:\.\d+)?)\s*元/g

  let currentCity = null
  for (const line of lines) {
    const cityMatch = line.match(cityPattern)
    if (cityMatch) currentCity = cityMatch[1]
    if (!currentCity) continue
    if (!cities[currentCity]) cities[currentCity] = {}

    if (/餐/.test(line)) {
      const nums = [...line.matchAll(amountPattern)]
      if (nums.length) cities[currentCity].meal = parseFloat(nums[0][1])
    }
    if (/打车|交通|出租/.test(line)) {
      const nums = [...line.matchAll(amountPattern)]
      if (nums.length) cities[currentCity].taxi = parseFloat(nums[0][1])
    }
    if (/住宿|酒店|宾馆/.test(line)) {
      const nums = [...line.matchAll(amountPattern)]
      if (nums.length) cities[currentCity].accommodation = parseFloat(nums[0][1])
    }
  }
  return { data: cities }
}

function normalizeExpenseType(raw) {
  if (/餐/.test(raw)) return 'meal'
  if (/打车|交通|出租|滴滴/.test(raw)) return 'taxi'
  if (/住宿|酒店|宾馆/.test(raw)) return 'accommodation'
  return null
}

// ─── File Processing ──────────────────────────────────────────────────────────
ipcMain.handle('files:analyze', async (_e, filePaths, groupType) => {
  const results = []
  for (const fp of filePaths) {
    const result = await analyzeFile(fp)
    results.push(result)
  }
  if (groupType === 'meal') {
    return autoGroup(results)
  }
  
  // For 'other' (batch) uploads, auto-match taxi invoices with their itineraries by amount to inherit the actual trip date
  const taxiInvoices = results.filter(r => r.expenseType && r.expenseType.startsWith('taxi') && r.role === 'invoice')
  const taxiItineraries = results.filter(r => r.expenseType && r.expenseType.startsWith('taxi') && r.role === 'itinerary')
  
  for (const inv of taxiInvoices) {
    if (inv.amount) {
      const match = taxiItineraries.find(it => it.amount === inv.amount && it.amount > 0)
      if (match && match.date) {
        inv.date = match.date // Inherit the actual trip date
        inv.status = (inv.expenseType && inv.date && inv.amount && inv.role) ? 'ok' : 'incomplete'
      }
    }
  }

  return results
})

// After individual analysis, propagate invoice info to non-invoice files
function autoGroup(results) {
  // Find the "best" invoice: the one with most fields filled
  const invoice = results.find(r => r.role === 'invoice')
  if (!invoice) return results // no invoice found, return as-is

  // First, find the actual date from an attachment (usually water bill or payment record)
  let actualDate = invoice.date
  let actualEndDate = invoice.endDate || null
  const attachmentWithDate = results.find(r => r !== invoice && r.date)
  if (attachmentWithDate) {
    actualDate = attachmentWithDate.date
    if (attachmentWithDate.endDate) actualEndDate = attachmentWithDate.endDate
  }
  
  // Overwrite invoice date with the actual date
  invoice.date = actualDate
  invoice.endDate = actualEndDate
  invoice.status = (invoice.expenseType && invoice.date && invoice.amount && invoice.role) ? 'ok' : 'incomplete'

  let attachmentIdx = 1
  for (const item of results) {
    if (item === invoice) continue
    
    // Non-invoice files unconditionally inherit type/date/amount from the invoice
    item.expenseType = invoice.expenseType
    item.date = actualDate
    item.endDate = actualEndDate
    item.amount = invoice.amount
    
    // Assign attachment role if not already identified as invoice/itinerary
    if (item.role !== 'invoice' && item.role !== 'itinerary') {
      item.role = `attachment${attachmentIdx}`
      attachmentIdx++
    }
    item.status = (item.expenseType && item.date && item.amount && item.role) ? 'ok' : 'incomplete'
  }
  return results
}

ipcMain.handle('files:package', async (_e, items) => {
  const saveResult = await dialog.showSaveDialog(mainWindow, {
    title: '保存打包文件',
    defaultPath: '报销文件打包.zip',
    filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }]
  })
  
  if (saveResult.canceled || !saveResult.filePath) {
    return { canceled: true }
  }
  
  const zipPath = saveResult.filePath
  
  return new Promise((resolve) => {
    import('archiver').then(({ ZipArchive }) => {
      const output = fs.createWriteStream(zipPath)
      const archive = new ZipArchive({ zlib: { level: 9 } })
      
      output.on('close', () => {
        resolve({ success: true, savedPath: zipPath })
      })
      
      archive.on('error', (err) => {
        resolve({ success: false, error: err.message })
      })
      
      archive.pipe(output)
      
      for (const item of items) {
        if (fs.existsSync(item.originalPath) && item.newFilename) {
          archive.file(item.originalPath, { name: item.newFilename })
        }
      }
      
      archive.finalize()
    }).catch(err => {
      resolve({ success: false, error: '加载 archiver 失败: ' + err.message })
    })
  })
})

async function analyzeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const basename = path.basename(filePath)
  let text = ''

  try {
    if (ext === '.pdf') {
      const { PDFParse } = await import('pdf-parse')
      const buffer = fs.readFileSync(filePath)
      const parser = new PDFParse({ data: buffer })
      const result = await parser.getText()
      text = result.text || ''
      // Strip page markers like "-- 1 of 1 --" before checking emptiness
      const strippedText = text.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '').trim()
      if (strippedText === '') {
        try {
          const imgs = await parser.getImage({ imageBuffer: true })
          if (imgs && imgs.pages && imgs.pages[0] && imgs.pages[0].images.length > 0) {
            text = await ocrImageBuffer(imgs.pages[0].images[0].data)
          }
        } catch (e) {
          console.error('PDF image extraction error:', e)
        }
      }
      await parser.destroy()
    } else if (['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'].includes(ext)) {
      // For images, we'll use a simplified keyword-based approach first
      // tesseract is heavy, defer to user manual input if OCR fails
      text = await ocrImage(filePath)
    }
  } catch (err) {
    console.error('File analysis error:', err)
  }

  const expenseType = detectExpenseType(text)
  let date = extractDate(text)
  let endDate = null
  const amount = extractAmount(text)
  const role = detectRole(text, expenseType)

  if (expenseType === 'accommodation') {
    const dates = extractAccommodationDates(text)
    if (dates) {
      date = dates.checkIn || date
      endDate = dates.checkOut || null
    }
  } else if (expenseType && expenseType.startsWith('taxi')) {
    const tripDate = extractTaxiTripDate(text)
    if (tripDate) {
      date = tripDate
    }
  }

  return {
    originalPath: filePath,
    originalName: basename,
    text,
    expenseType,
    date,
    endDate,
    amount,
    role,
    status: (expenseType && date && amount && role) ? 'ok' : 'incomplete',
    groupId: null,
  }
}

async function ocrImage(filePath) {
  try {
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker('chi_sim')
    const { data: { text } } = await worker.recognize(filePath)
    await worker.terminate()
    return text
  } catch {
    return ''
  }
}

async function ocrImageBuffer(buffer) {
  try {
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker('chi_sim')
    const { data: { text } } = await worker.recognize(buffer)
    await worker.terminate()
    return text
  } catch (e) {
    console.error('OCR Error:', e)
    return ''
  }
}

function detectExpenseType(text) {
  if (!text) return null
  const clean = text.replace(/\s+/g, '')
  if (/铁路|高铁|动车|12306/.test(clean)) return 'train'
  if (/航空|航班|机票|飞机/.test(clean)) return 'flight'
  if (/滴滴|小桔|DIDI/i.test(clean)) return 'taxi-didi'
  if (/出租|的士/.test(clean) && !/滴滴/.test(clean)) return 'taxi-cab'
  // Check meal FIRST - food delivery receipts often mention hotel as delivery address
  if (/餐饮|餐费|饭店|餐厅|食品|快餐|外卖|美团|饿了么|生煎|拉面|送餐|提号|光临|配送骑士|蜂鸟|餐具|豆腐|粉丝|打包费/.test(clean)) return 'meal'
  // Accommodation: must have stay-related keywords
  if (/入住时间|离店时间|房号.*入住|客房|住宿/.test(clean)) return 'accommodation'
  if (/酒店|宾馆|旅馆/.test(clean) && /入住|房型|离店/.test(clean)) return 'accommodation'
  return null
}

function extractDate(text) {
  if (!text) return null
  // First try patterns on original text (preserves space-separated dates like train tickets)
  const origPatterns = [
    /(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})[日号]?/,
    /(\d{4})\s+(\d{1,2})\s+(\d{1,2})\s+\d{2}:\d{2}/,
    /(\d{4})-(\d{1,2})-(\d{1,2})/,
  ]
  for (const p of origPatterns) {
    const m = text.match(p)
    if (m) {
      const y = parseInt(m[1]), mo = parseInt(m[2]), d = parseInt(m[3])
      if (y >= 2020 && y <= 2030 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      }
    }
  }
  // Then try on cleaned text for OCR results
  const clean = text.replace(/\s+/g, '')
  const cleanPatterns = [
    /(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})[日号]?/,
    /(20\d{2})(\d{2})(\d{2})/,
  ]
  for (const p of cleanPatterns) {
    const m = clean.match(p)
    if (m) {
      const y = parseInt(m[1]), mo = parseInt(m[2]), d = parseInt(m[3])
      if (y >= 2020 && y <= 2030 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      }
    }
  }
  return null
}

function extractAccommodationDates(text) {
  if (!text) return null
  const clean = text.replace(/\s+/g, '')
  
  const checkInMatch = clean.match(/(?:入住|到达|Check-in)[^\d]*(\d{4}[年\-\/]\d{1,2}[月\-\/]\d{1,2})/)
  const checkOutMatch = clean.match(/(?:离店|退房|离开|Check-out)[^\d]*(\d{4}[年\-\/]\d{1,2}[月\-\/]\d{1,2})/)
  
  const normalizeDate = (str) => {
    const m = str.match(/(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})/)
    if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`
    return str
  }

  if (checkInMatch || checkOutMatch) {
    return {
      checkIn: checkInMatch ? normalizeDate(checkInMatch[1]) : null,
      checkOut: checkOutMatch ? normalizeDate(checkOutMatch[1]) : null
    }
  }
  return null
}

function extractTaxiTripDate(text) {
  if (!text) return null
  const clean = text.replace(/\s+/g, '')
  const match = clean.match(/(?:行程起止日期|乘车日期|乘车时间)[^\d]*(\d{4}[年\-\/]\d{1,2}[月\-\/]\d{1,2})/)
  if (match) {
    const normalizeDate = (str) => {
      const m = str.match(/(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})/)
      if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`
      return str
    }
    return normalizeDate(match[1])
  }
  return null
}

function extractAmount(text) {
  if (!text) return null
  const clean = text.replace(/\s+/g, '')
  
  // Strategy 1: Look for all "实付" amounts and take the largest (final total)
  const shifu = [...clean.matchAll(/实付[：:\*¥￥Y兰着#=-]*(\d+(?:\.\d{1,2})?)/g)]
  if (shifu.length > 0) {
    const amounts = shifu.map(m => parseFloat(m[1])).filter(v => v > 0 && v < 100000)
    if (amounts.length > 0) return Math.max(...amounts)
  }
  
  // Strategy 2: Explicit prefix patterns
  const explicitPriority = [
    /[零壹贰叁肆伍陆柒捌玖拾佰仟万亿圆角分整]+(?:圆|角|分|整|元)[：:\*¥￥Y兰着#=\(\)（）]*(\d+(?:\.\d{1,2})?)/,
    /(?:价税合计|合计金额|总金额|实付金额|实付款|应收金额|总价|小写)[：:\*¥￥Y兰着#=\(\)（）]*(\d+(?:\.\d{1,2})?)/,
    /(?:合计|总额|金额)[：:\*¥￥Y兰着#=\(\)（）]*(\d+(?:\.\d{1,2})?)/,
    /(?:在线支付|\u652f付方式[^\d]*)(?:[¥￥]?)(\d+(?:\.\d{1,2})?)/,
  ]
  for (const p of explicitPriority) {
    const m = clean.match(p)
    if (m) {
      const val = parseFloat(m[1])
      if (val > 0 && val < 100000) return val
    }
  }

  // Strategy 3: Find all standalone currency amounts and take the MAX (Total is usually the largest)
  const currencyRegexes = [
    /[¥￥](\d+(?:\.\d{1,2})?)/g,
    /(\d+(?:\.\d{1,2})?)[¥￥元]/g,
    /[:：](\d+\.\d{2})/g,
  ]
  let maxCurrencyAmount = -1
  for (const p of currencyRegexes) {
    const matches = [...clean.matchAll(p)]
    if (matches.length > 0) {
      const amounts = matches.map(m => parseFloat(m[1])).filter(v => v > 0 && v < 100000)
      if (amounts.length > 0) {
        maxCurrencyAmount = Math.max(maxCurrencyAmount, ...amounts)
      }
    }
  }
  if (maxCurrencyAmount > 0) return maxCurrencyAmount
  
  // Strategy 3: Hotel receipt pattern - look for repeated amount (debit=credit)
  const hotelMatch = clean.match(/(\d{3,})(\1)/)
  if (hotelMatch) {
    const val = parseFloat(hotelMatch[1])
    if (val > 0 && val < 100000) return val
  }
  
  return null
}

function detectRole(text, expenseType) {
  if (!text) return null
  const clean = text.replace(/\s+/g, '')
  if (/发票代码|发票号码|增值税|电子发票/.test(clean)) return 'invoice'
  if (/行程单|行程明细|订单明细/.test(clean)) return 'itinerary'
  if (/账单详情|支付记录|转账记录|交易记录|付款记录|支付时间/.test(clean)) return 'payment'
  // Receipt patterns: hotel folios, food delivery orders, bank slips
  if (/入住时间|离店时间|房号|仔细核对金额/.test(clean)) return 'receipt'
  if (/送餐|配送骑士|下单时间|订单已送达|提号/.test(clean)) return 'receipt'
  if (/水单|消费明细|消费记录|订单号/.test(clean)) return 'receipt'
  if (expenseType === 'train' || expenseType === 'flight') return 'invoice'
  if (expenseType === 'taxi-cab') return 'invoice'
  return null
}
