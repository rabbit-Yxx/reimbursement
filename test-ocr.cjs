const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

function extractAmount(text) {
  if (!text) return null
  const clean = text.replace(/\s+/g, '')
  const shifu = [...clean.matchAll(/实付[：:\*¥￥Y兰着#=-]*(\d+(?:\.\d{1,2})?)/g)]
  if (shifu.length > 0) {
    const amounts = shifu.map(m => parseFloat(m[1])).filter(v => v > 0 && v < 100000)
    if (amounts.length > 0) return Math.max(...amounts)
  }
  const priority = [
    /[零壹贰叁肆伍陆柒捌玖拾佰仟万亿圆角分整]+[¥￥](\d+(?:\.\d{1,2})?)/,
    /(?:价税合计|合计金额|总金额|实付金额|实付款|应收金额|总价)[：:\*¥￥Y兰着#=-]*(\d+(?:\.\d{1,2})?)/,
    /(?:合计|总额|金额)[：:\*¥￥Y兰着#=-]*(\d+(?:\.\d{1,2})?)/,
    /(?:在线支付|\u652f付方式[^\d]*)(?:[¥￥]?)(\d+(?:\.\d{1,2})?)/,
    /[¥￥](\d+(?:\.\d{1,2})?)/,
    /(\d+(?:\.\d{1,2})?)元/,
    /[:：](\d+\.\d{2})/,
  ]
  for (const p of priority) {
    const m = clean.match(p)
    if (m) {
      const val = parseFloat(m[1])
      if (val > 0 && val < 100000) return val
    }
  }
  return null
}

const dir = '上海出差 20260303-20260305';
async function test() {
  const files = ['餐费 0305 10元 支付记录1（高铁无水单）.pdf', '餐费 0305 52.00元 发票.pdf', '餐费 0305 63.00元 发票.pdf'];
  for (const f of files) {
    const p = path.join(dir, f);
    const buf = fs.readFileSync(p);
    const pdfData = await pdfParse(buf);
    let text = pdfData.text;
    console.log(f, ':', extractAmount(text));
    if (text.includes('3.57')) console.log('Contains 3.57!');
  }
}
test();
