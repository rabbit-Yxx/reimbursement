import fs from 'fs'
import * as XLSX from 'xlsx'

const files = fs.readdirSync('.')
const xlsFile = files.find(f => f.includes('住宿费') && f.endsWith('.xls'))

if (xlsFile) {
  const buf = fs.readFileSync(xlsFile)
  const workbook = XLSX.read(buf, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1 })

  console.log(JSON.stringify(json.slice(0, 30), null, 2))
} else {
  console.log("File not found")
}
