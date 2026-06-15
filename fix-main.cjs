const fs = require('fs');
let content = fs.readFileSync('electron/main.js', 'utf8');
const startIdx = content.indexOf('function detectExpenseType');
const newFunctions = `function detectExpenseType(text) {
  if (!text) return null
  const clean = text.replace(/\\s+/g, '')
  if (/铁路|高铁|动车|12306/.test(clean)) return 'train'
  if (/航空|航班|机票|飞机/.test(clean)) return 'flight'
  if (/滴滴|小桔|DIDI/i.test(clean)) return 'taxi-didi'
  if (/出租|的士/.test(clean) && !/滴滴/.test(clean)) return 'taxi-cab'
  if (/住宿|酒店|宾馆|旅馆|客房/.test(clean)) return 'accommodation'
  if (/餐饮|餐费|饭店|餐厅|食品|快餐|外卖|美团|饿了么|生煎/.test(clean)) return 'meal'
  return null
}

function extractDate(text) {
  if (!text) return null
  const clean = text.replace(/\\s+/g, '')
  const patterns = [
    /(\\d{4})[年\\-\\/](\\d{1,2})[月\\-\\/](\\d{1,2})[日号]?/,
    /(\\d{4})(\\d{2})(\\d{2})/,
  ]
  for (const p of patterns) {
    const m = clean.match(p)
    if (m) {
      return \`\${m[1]}-\${m[2].padStart(2, '0')}-\${m[3].padStart(2, '0')}\`
    }
  }
  return null
}

function extractAmount(text) {
  if (!text) return null
  const clean = text.replace(/\\s+/g, '')
  const priority = [
    /[零壹贰叁肆伍陆柒捌玖拾佰仟万亿圆角分整]+[¥￥](\\d+(?:\\.\\d{1,2})?)/,
    /(?:价税合计|合计金额|总金额|实付金额|实付款|应收金额|实付|总价)[：:\\*¥￥Y兰着-]*(\\d+(?:\\.\\d{1,2})?)/,
    /(?:合计|总额|金额)[：:\\*¥￥Y兰着-]*(\\d+(?:\\.\\d{1,2})?)/,
    /[¥￥](\\d+(?:\\.\\d{1,2})?)/,
    /(\\d+(?:\\.\\d{1,2})?)元/,
    /[:：](\\d+\\.\\d{2})/,
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

function detectRole(text, expenseType) {
  if (!text) return null
  const clean = text.replace(/\\s+/g, '')
  if (/发票代码|发票号码|增值税|电子发票/.test(clean)) return 'invoice'
  if (/行程单|行程明细|订单明细/.test(clean)) return 'itinerary'
  if (/支付记录|转账记录|交易记录|付款记录|支付时间/.test(clean)) return 'payment'
  if (/水单|消费明细|消费记录|账单|订单号/.test(clean)) return 'receipt'
  if (expenseType === 'train' || expenseType === 'flight') return 'invoice'
  if (expenseType === 'taxi-cab') return 'invoice'
  return null
}
`
content = content.substring(0, startIdx) + newFunctions;
fs.writeFileSync('electron/main.js', content);
