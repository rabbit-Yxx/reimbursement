// End-to-end test with the FIXED logic
const fs = require('fs');
const path = require('path');

const testFiles = [
  '上海出差 20260303-20260305/餐费 0304 62.70元 水单.pdf',
  '上海出差 20260303-20260305/餐费 0304 62.70元 支付记录.pdf',
  '上海出差 20260303-20260305/住宿 0305 1314.00元 水单.pdf',
  '上海出差 20260303-20260305/餐费 0303 54元 水单.pdf',
  '上海出差 20260303-20260305/火车票 0303 662.00元 发票.pdf',
  '上海出差 20260303-20260305/1.pdf',
  '上海出差 20260303-20260305/2.pdf',
];

function detectExpenseType(text) {
  if (!text) return null
  const clean = text.replace(/\s+/g, '')
  if (/铁路|高铁|动车|12306/.test(clean)) return 'train'
  if (/航空|航班|机票|飞机/.test(clean)) return 'flight'
  if (/滴滴|小桔|DIDI/i.test(clean)) return 'taxi-didi'
  if (/出租|的士/.test(clean) && !/滴滴/.test(clean)) return 'taxi-cab'
  if (/入住时间|离店时间|房号|客房|住宿/.test(clean)) return 'accommodation'
  if (/酒店|宾馆|旅馆/.test(clean) && /入住|房/.test(clean)) return 'accommodation'
  if (/餐饮|餐费|饭店|餐厅|食品|快餐|外卖|美团|饿了么|生煎|拉面|送餐|提号|光临|配送骑士|蜂鸟/.test(clean)) return 'meal'
  if (/酒店|宾馆|旅馆/.test(clean)) return 'accommodation'
  return null
}

function extractDate(text) {
  if (!text) return null
  const origPatterns = [
    /(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})[日号]?/,
    /(\d{4})\s+(\d{1,2})\s+(\d{1,2})\s+\d{2}:\d{2}/,
    /(\d{4})-(\d{1,2})-(\d{1,2})/,
  ]
  for (const p of origPatterns) {
    const m = text.match(p)
    if (m) {
      const y = parseInt(m[1]), mo = parseInt(m[2]), d = parseInt(m[3])
      if (y >= 2020 && y <= 2030 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      }
    }
  }
  const clean = text.replace(/\s+/g, '')
  const cleanPatterns = [
    /(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})[日号]?/,
    /(20\d{2})(\d{2})(\d{2})/,
  ]
  for (const p of cleanPatterns) {
    const m = clean.match(p)
    if (m) {
      const y = parseInt(m[1]), mo = parseInt(m[2]), d = parseInt(m[3])
      if (y >= 2020 && y <= 2030 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      }
    }
  }
  return null
}

function extractAmount(text) {
  if (!text) return null
  const clean = text.replace(/\s+/g, '')
  const priority = [
    /[零壹贰叁肆伍陆柒捌玖拾佰仟万亿圆角分整]+[¥￥](\d+(?:\.\d{1,2})?)/,
    /(?:价税合计|合计金额|总金额|实付金额|实付款|应收金额|实付|总价)[：:\*¥￥Y兰着#=-]*(\d+(?:\.\d{1,2})?)/,
    /(?:合计|总额|金额)[：:\*¥￥Y兰着#=-]*(\d+(?:\.\d{1,2})?)/,
    /(?:在线支付|支付方式[^\d]*)(?:[¥￥]?)(\d+(?:\.\d{1,2})?)/,
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

function detectRole(text, expenseType) {
  if (!text) return null
  const clean = text.replace(/\s+/g, '')
  if (/发票代码|发票号码|增值税|电子发票/.test(clean)) return 'invoice'
  if (/行程单|行程明细|订单明细/.test(clean)) return 'itinerary'
  if (/账单详情|支付记录|转账记录|交易记录|付款记录|支付时间/.test(clean)) return 'payment'
  if (/入住时间|离店时间|房号|仔细核对金额/.test(clean)) return 'receipt'
  if (/送餐|配送骑士|下单时间|订单已送达|提号/.test(clean)) return 'receipt'
  if (/水单|消费明细|消费记录|订单号/.test(clean)) return 'receipt'
  if (expenseType === 'train' || expenseType === 'flight') return 'invoice'
  if (expenseType === 'taxi-cab') return 'invoice'
  return null
}

async function main() {
  const { PDFParse } = await import('pdf-parse');
  const { createWorker } = await import('tesseract.js');

  let okCount = 0, totalCount = 0;
  
  for (const file of testFiles) {
    if (!fs.existsSync(file)) { console.log(`SKIP: ${file} not found`); continue; }
    totalCount++;
    console.log(`\n========== ${path.basename(file)} ==========`);
    const buffer = fs.readFileSync(file);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    let text = result.text || '';
    
    const strippedText = text.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '').trim();
    if (strippedText === '') {
      console.log('  [OCR mode]');
      try {
        const imgs = await parser.getImage({ imageBuffer: true });
        if (imgs && imgs.pages && imgs.pages[0] && imgs.pages[0].images.length > 0) {
          const worker = await createWorker('chi_sim');
          const { data: { text: ocrText } } = await worker.recognize(imgs.pages[0].images[0].data);
          await worker.terminate();
          text = ocrText;
        }
      } catch (e) {
        console.log('  [OCR error:', e.message, ']');
      }
    } else {
      console.log('  [PDF text mode]');
    }
    await parser.destroy();

    const expenseType = detectExpenseType(text);
    const date = extractDate(text);
    const amount = extractAmount(text);
    const role = detectRole(text, expenseType);
    const ok = !!(expenseType && date && amount && role);
    if (ok) okCount++;
    
    console.log('  Type:', expenseType, ' Date:', date, ' Amount:', amount, ' Role:', role);
    console.log('  Status:', ok ? 'OK ✅' : 'INCOMPLETE ❌');
    
    if (!ok) {
      const clean = text.replace(/\s+/g, '');
      console.log('  [DEBUG first 200:]', clean.substring(0, 200));
    }
  }
  
  console.log(`\n======== SUMMARY: ${okCount}/${totalCount} OK ========`);
}

main().catch(console.error);
