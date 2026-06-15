import fs from 'fs'
import * as XLSX from 'xlsx'

const cleanName = (name) => name.replace(/市$|省$|维吾尔自治区$|壮族自治区$|回族自治区$|自治区$|特别行政区$/g, '')

const xlsFile = '2024-12-13 首证发〔2024〕188号 附件2-1：首创证券股份有限公司国内差旅住宿费、市内交通费、伙食补助费标准明细表.xls'
const buf = fs.readFileSync(xlsFile)
const workbook = XLSX.read(buf, { type: 'buffer' })
const sheet = workbook.Sheets[workbook.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

const jsonData = JSON.parse(fs.readFileSync('./src/data/default-standards.json', 'utf8'))

let currentLevel1 = ''
let mismatches = []

for (let i = 0; i < rows.length; i++) {
  const row = rows[i]
  if (!row || row.length < 5) continue

  let col1 = String(row[1] || '').trim()
  let col2 = String(row[2] || '').trim()

  if (col1 === '地区' || col1.includes('城市')) continue

  if (col1) {
    currentLevel1 = col1.replace(/\n/g, '')
  }

  if (!currentLevel1) continue

  const accommodation = parseFloat(row[4]) || parseFloat(row[3]) || 0
  const taxi = parseFloat(row[9]) || 0
  const meal = parseFloat(row[10]) || 0

  const l1Data = jsonData.find(d => d.level1 === currentLevel1)
  if (!l1Data) {
    mismatches.push(`[${currentLevel1}] missing from JSON completely!`)
    continue
  }

  if (accommodation > 0 || (col2 && (taxi > 0 || meal > 0))) {
    const replacedCol2 = col2.replace('6个中心城区', '和平区、河东区、河西区、南开区、河北区、红桥区')
    const parts = replacedCol2 ? replacedCol2.split(/[、，, \n]+/).map(s => s.trim()).filter(Boolean) : ['全市']
    
    for (let p of parts) {
      const cityData = l1Data.level2s.find(c => c.name === p)
      if (!cityData) {
        mismatches.push(`[${currentLevel1} - ${p}] missing from JSON!`)
        continue
      }
      if (cityData.accommodation !== accommodation) {
        mismatches.push(`[${currentLevel1} - ${p}] Accommodation mismatch: Excel ${accommodation}, JSON ${cityData.accommodation}`)
      }
      if (cityData.taxi !== taxi) {
        mismatches.push(`[${currentLevel1} - ${p}] Taxi mismatch: Excel ${taxi}, JSON ${cityData.taxi}`)
      }
      if (cityData.meal !== meal) {
        mismatches.push(`[${currentLevel1} - ${p}] Meal mismatch: Excel ${meal}, JSON ${cityData.meal}`)
      }
    }
  }

  // Check peak seasons
  let col5 = String(row[5] || '').trim()
  let col6 = String(row[6] || '').trim()
  let peakAcc = parseFloat(row[8]) || parseFloat(row[7]) || 0

  if (col5 && col6 && peakAcc > 0) {
    const peakParts = col5.split(/[、，, \n]+/).map(s => s.trim()).filter(Boolean)
    for (let p of peakParts) {
      // It might be stored under cleanName if original name wasn't explicitly in normal standard
      let cityData = l1Data.level2s.find(c => c.name === p || cleanName(c.name) === p)
      if (!cityData) {
        mismatches.push(`[${currentLevel1} - ${p} (Peak)] missing from JSON!`)
        continue
      }
      if (!cityData.peak) {
        mismatches.push(`[${currentLevel1} - ${p}] Peak data missing in JSON!`)
      } else {
        if (cityData.peak.accommodation !== peakAcc) {
          mismatches.push(`[${currentLevel1} - ${p}] Peak Accommodation mismatch: Excel ${peakAcc}, JSON ${cityData.peak.accommodation}`)
        }
        if (cityData.peak.period !== col6) {
          mismatches.push(`[${currentLevel1} - ${p}] Peak Period mismatch: Excel ${col6}, JSON ${cityData.peak.period}`)
        }
      }
    }
  }
}

if (mismatches.length === 0) {
  console.log('✅ ALL PERFECT! 0 mismatches found.')
} else {
  console.log(`❌ Found ${mismatches.length} mismatches:`)
  mismatches.forEach(m => console.log(m))
}
