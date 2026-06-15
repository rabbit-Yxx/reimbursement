import fs from 'fs'
import * as XLSX from 'xlsx'

const citiesDb = JSON.parse(fs.readFileSync('./node_modules/province-city-china/dist/city.json', 'utf8'))
const provincesDb = JSON.parse(fs.readFileSync('./node_modules/province-city-china/dist/province.json', 'utf8'))

const cleanName = (name) => name.replace(/市$|省$|维吾尔自治区$|壮族自治区$|回族自治区$|自治区$|特别行政区$/g, '')

const provMap = {}
for (const p of provincesDb) {
  provMap[p.province] = cleanName(p.name)
}

const xlsFile = '2024-12-13 首证发〔2024〕188号 附件2-1：首创证券股份有限公司国内差旅住宿费、市内交通费、伙食补助费标准明细表.xls'
const buf = fs.readFileSync(xlsFile)
const workbook = XLSX.read(buf, { type: 'buffer' })
const sheet = workbook.Sheets[workbook.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

const dataMap = {}
let currentLevel1 = ''
const level1Order = []

// Step 1: Parse Excel explicitly
for (let i = 0; i < rows.length; i++) {
  const row = rows[i]
  if (!row || row.length < 5) continue

  let col1 = String(row[1] || '').trim()
  let col2 = String(row[2] || '').trim()

  if (col1 === '地区' || col1.includes('城市')) continue

  if (col1) {
    currentLevel1 = col1.replace(/\n/g, '')
    if (!dataMap[currentLevel1]) {
      dataMap[currentLevel1] = { defaultStd: null, explicit: {}, peak: {} }
      level1Order.push(currentLevel1)
    }
  }

  if (!currentLevel1) continue

  const accommodation = parseFloat(row[4]) || parseFloat(row[3]) || 0
  const taxi = parseFloat(row[9]) || 0
  const meal = parseFloat(row[10]) || 0

  if (accommodation > 0 || (col2 && (taxi > 0 || meal > 0))) {
    const std = { accommodation, taxi, meal }
    
    if (!dataMap[currentLevel1].defaultStd) {
      dataMap[currentLevel1].defaultStd = { ...std }
    }

    if (col2 === '全市' || col2 === '其他地区') {
      dataMap[currentLevel1].explicit[col2] = { ...std }
      dataMap[currentLevel1].defaultStd = { ...std }
    } else if (col2) {
      // 展开天津的6个中心城区
      const replacedCol2 = col2.replace('6个中心城区', '和平区、河东区、河西区、南开区、河北区、红桥区')
      const parts = replacedCol2.split(/[、，, \n]+/).map(s => s.trim()).filter(Boolean)
      for (let p of parts) {
        dataMap[currentLevel1].explicit[p] = { ...std }
      }
    }
  }

  let col5 = String(row[5] || '').trim()
  let col6 = String(row[6] || '').trim()
  let peakAcc = parseFloat(row[8]) || parseFloat(row[7]) || 0
  
  if (col5 && col6 && peakAcc > 0) {
    const peakParts = col5.split(/[、，, \n]+/).map(s => s.trim()).filter(Boolean)
    for (let p of peakParts) {
      dataMap[currentLevel1].peak[p] = { period: col6, accommodation: peakAcc }
      dataMap[currentLevel1].peak[cleanName(p)] = { period: col6, accommodation: peakAcc }
    }
  }
}

const allLevel1Names = new Set(level1Order.map(cleanName))

for (const p of provincesDb) {
  const pCleanName = provMap[p.province]
  
  const l1Data = dataMap[pCleanName]
  if (!l1Data) continue

  const citiesInProv = citiesDb.filter(c => c.province === p.province && !c.name.includes('行政区划'))
  
  for (const c of citiesInProv) {
    const cClean = cleanName(c.name)
    if (allLevel1Names.has(cClean)) continue

    if (l1Data.explicit[c.name] || l1Data.explicit[cClean]) continue

    if (l1Data.defaultStd) {
      l1Data.explicit[c.name] = { ...l1Data.defaultStd }
    }
  }
}

const finalStandards = []
for (const l1 of level1Order) {
  const l1Data = dataMap[l1]
  const level2s = []

  for (const [l2Name, l2Data] of Object.entries(l1Data.explicit)) {
    // 移除“其他地区”，因为我们已经穷举了所有城市
    if (l2Name === '其他地区') continue

    let peakInfo = l1Data.peak[l2Name] || l1Data.peak[cleanName(l2Name)] || l1Data.peak['全市'] || l1Data.peak['其他地区'] || null

    level2s.push({
      name: l2Name,
      ...l2Data,
      peak: peakInfo
    })
  }
  
  for (const [peakCity, peakInfo] of Object.entries(l1Data.peak)) {
    if (peakCity === '全市' || peakCity === '其他地区') continue
    if (!level2s.find(l2 => l2.name === peakCity || cleanName(l2.name) === peakCity)) {
      level2s.push({
        name: peakCity,
        ...(l1Data.defaultStd || { accommodation: 0, taxi: 112, meal: 140 }),
        peak: peakInfo
      })
    }
  }

  level2s.sort((a, b) => {
    if (a.name === '全市') return 1
    if (b.name === '全市') return -1
    return 0
  })

  finalStandards.push({
    level1: l1,
    level2s: level2s
  })
}

fs.writeFileSync('./src/data/default-standards.json', JSON.stringify(finalStandards, null, 2))
console.log('Generation complete! Total Level 1 categories:', finalStandards.length)
