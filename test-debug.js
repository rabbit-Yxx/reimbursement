import fs from 'fs'
import * as XLSX from 'xlsx'

const cleanName = (name) => name.replace(/市$|省$|维吾尔自治区$|壮族自治区$|回族自治区$|自治区$|特别行政区$/g, '')

const xlsFile = '2024-12-13 首证发〔2024〕188号 附件2-1：首创证券股份有限公司国内差旅住宿费、市内交通费、伙食补助费标准明细表.xls'
const buf = fs.readFileSync(xlsFile)
const workbook = XLSX.read(buf, { type: 'buffer' })
const sheetName = workbook.SheetNames[0]
const sheet = workbook.Sheets[sheetName]
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

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

  if (accommodation || taxi || meal) {
    const std = { accommodation, taxi, meal }

    if (!col2 || col2 === '全市') {
      standardsByProv[currentProvName].default = std
    } else if (col2 === '其他地区') {
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
}

console.log(JSON.stringify(standardsByProv['内蒙古'], null, 2))
