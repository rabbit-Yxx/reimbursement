import fs from 'fs'
import * as XLSX from 'xlsx'

const xlsFile = '2024-12-13 首证发〔2024〕188号 附件2-1：首创证券股份有限公司国内差旅住宿费、市内交通费、伙食补助费标准明细表.xls'
const buf = fs.readFileSync(xlsFile)
const workbook = XLSX.read(buf, { type: 'buffer' })
const sheetName = workbook.SheetNames[0]
const sheet = workbook.Sheets[sheetName]
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

const cities = {}
let currentProvince = ''

for (let i = 0; i < rows.length; i++) {
  const row = rows[i]
  if (!row || row.length < 5) continue

  let col1 = String(row[1] || '').trim()
  let col2 = String(row[2] || '').trim()

  if (col1 === '地区' || col1.includes('城市')) continue
  if (col1) {
    currentProvince = col1.replace(/\s+/g, '')
  }

  let targets = new Set()
  if (col1) targets.add(currentProvince)

  if (col2 && col2 !== '全市' && !col2.includes('其他地区')) {
    const parts = col2.split(/[、，, \n]+/).map(s => s.trim()).filter(Boolean)
    parts.forEach(p => {
      // 过滤掉“区”、“县”、“中心城区”等
      if (!p.endsWith('区') && !p.endsWith('县') && !p.includes('中心城区') && !p.endsWith('旗')) {
         targets.add(p)
      }
    })
  }

  const accommodation = parseFloat(row[4]) || parseFloat(row[3]) || 0
  const taxi = parseFloat(row[9]) || 0
  const meal = parseFloat(row[10]) || 0

  if (accommodation > 0 || taxi > 0 || meal > 0) {
    for (const t of targets) {
      if (!cities[t]) cities[t] = {}
      if (!cities[t].accommodation && accommodation > 0) cities[t].accommodation = accommodation
      if (!cities[t].taxi && taxi > 0) cities[t].taxi = taxi
      if (!cities[t].meal && meal > 0) cities[t].meal = meal
    }
  }
}

// Write to JSON
fs.writeFileSync('./src/data/default-standards.json', JSON.stringify(cities, null, 2))
console.log('Saved to src/data/default-standards.json. Extracted', Object.keys(cities).length, 'cities.')
