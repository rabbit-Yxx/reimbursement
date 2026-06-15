import fs from 'fs'
import pdfParse from 'pdf-parse'

async function run() {
  const buf = fs.readFileSync('上海出差 20260303-20260305/1.pdf')
  const data = await pdfParse(buf)
  console.log('---TEXT START---')
  console.log(data.text)
  console.log('---TEXT END---')
}
run().catch(console.error)
