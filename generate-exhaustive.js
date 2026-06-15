import fs from 'fs'
import * as XLSX from 'xlsx'

const citiesDb = JSON.parse(fs.readFileSync('./node_modules/province-city-china/dist/city.json', 'utf8'))
const provincesDb = JSON.parse(fs.readFileSync('./node_modules/province-city-china/dist/province.json', 'utf8'))

const cleanName = (name) => name.replace(/市$|省$|维吾尔自治区$|壮族自治区$|回族自治区$|自治区$|特别行政区$/g, '')

const provMap = {}
for (const p of provincesDb) {
  provMap[p.province] = cleanName(p.name)
}

// 1. Read Excel
const xlsFile = '2024-12-13 首证发〔2024〕188号 附件2-1：首创证券股份有限公司国内差旅住宿费、市内交通费、伙食补助费标准明细表.xls'
const buf = fs.readFileSync(xlsFile)
const workbook = XLSX.read(buf, { type: 'buffer' })
const sheetName = workbook.SheetNames[0]
const sheet = workbook.Sheets[sheetName]
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

// Build a hierarchy of standards
// standardsByProv = { "河北": { default: { acc: 412 }, specific: { "石家庄市": { acc: 465 } }, peak: { "张家口市": { period: "7-9月", acc: 698 } } } }
const standardsByProv = {}
let currentProvName = ''

for (let i = 0; i < rows.length; i++) {
  const row = rows[i]
  if (!row || row.length < 5) continue

  let col1 = String(row[1] || '').trim()
  let col2 = String(row[2] || '').trim()

  if (col1 === '地区' || col1.includes('城市')) continue

  if (col1) {
    currentProvName = cleanName(col1)
    if (!standardsByProv[currentProvName]) {
      standardsByProv[currentProvName] = { default: null, specific: {}, peak: {} }
    }
  }

  const accommodation = parseFloat(row[4]) || parseFloat(row[3]) || 0
  const taxi = parseFloat(row[9]) || 0
  const meal = parseFloat(row[10]) || 0

  if (accommodation > 0) {
    const std = { accommodation, taxi, meal }

    if (!col2 || col2 === '全市' || col2 === '其他地区') {
      standardsByProv[currentProvName].default = std
    } else {
      const parts = col2.split(/[、，, \n]+/).map(s => s.trim()).filter(Boolean)
      for (let p of parts) {
        if (!p.endsWith('区') && !p.endsWith('县') && !p.includes('中心城区') && !p.endsWith('旗')) {
           standardsByProv[currentProvName].specific[p] = std
           standardsByProv[currentProvName].specific[cleanName(p)] = std
        }
      }
    }
  }

  // Parse peak season info
  let col5 = String(row[5] || '').trim()
  let col6 = String(row[6] || '').trim()
  let peakAcc = parseFloat(row[8]) || parseFloat(row[7]) || 0
  
  if (col5 && col6 && peakAcc > 0 && currentProvName) {
    const peakParts = col5.split(/[、，, \n]+/).map(s => s.trim()).filter(Boolean)
    for (let p of peakParts) {
      if (p === '全市' || p === '其他地区') {
        standardsByProv[currentProvName].peak['全市'] = { period: col6, accommodation: peakAcc }
      } else {
        standardsByProv[currentProvName].peak[p] = { period: col6, accommodation: peakAcc }
        standardsByProv[currentProvName].peak[cleanName(p)] = { period: col6, accommodation: peakAcc }
      }
    }
  }
}

// Ensure all provinces have a default (fallback to the first specific city if '其他地区' is missing)
for (const prov of Object.values(standardsByProv)) {
  if (!prov.default && Object.values(prov.specific).length > 0) {
    // Just use the first one as a last-resort fallback
    prov.default = Object.values(prov.specific)[0]
  }
}

// 2. Map all cities in China
const finalStandards = []

for (const p of provincesDb) {
  const provObj = {
    province: p.name,
    cities: []
  }

  const pName = provMap[p.province]
  const provStd = standardsByProv[pName]
  
  if (provStd) {
    // Find all cities belonging to this province, filter out "行政区划"
    const citiesInProv = citiesDb.filter(c => c.province === p.province && !c.name.includes('行政区划'))
    
    for (const c of citiesInProv) {
      let std = provStd.specific[c.name] || provStd.specific[cleanName(c.name)]
      if (!std) {
        std = provStd.default
      }
      
      let peakInfo = provStd.peak[c.name] || provStd.peak[cleanName(c.name)] || provStd.peak['全市']

      if (std) {
        provObj.cities.push({
          name: c.name,
          peak: peakInfo ? peakInfo : null,
          ...std
        })
      }
    }
  }

  // 直辖市和特别行政区处理 (直辖市既是省也是市)
  if (['北京', '天津', '上海', '重庆'].includes(pName)) {
    if (standardsByProv[pName] && standardsByProv[pName].default) {
      let peakInfo = standardsByProv[pName].peak['全市']
      provObj.cities.push({
        name: p.name,
        peak: peakInfo ? peakInfo : null,
        ...standardsByProv[pName].default
      })
    }
  }

  if (provObj.cities.length > 0) {
    finalStandards.push(provObj)
  }
}

fs.writeFileSync('./src/data/default-standards.json', JSON.stringify(finalStandards, null, 2))
console.log('Exhaustive generation complete! Total provinces:', finalStandards.length)
