import ExcelJS from 'exceljs'

async function run() {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile('2024-12-13 首证发〔2024〕188号 附件2-1：首创证券股份有限公司国内差旅住宿费、市内交通费、伙食补助费标准明细表.xls').catch(async () => {
    // wait, it's a .xls file? exceljs might only support .xlsx.
    console.log('Maybe not xlsx format, let me check.')
  })
  const sheet = workbook.worksheets[0]
  if (!sheet) {
    console.log('No sheet found')
    return
  }
  
  const rows = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 10) {
      rows.push(row.values)
    }
  })
  console.log(JSON.stringify(rows, null, 2))
}
run()
