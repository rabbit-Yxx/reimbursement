import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
// The workerSrc must be set for pdfjs
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Ensure Tesseract uses local tessdata — use import.meta.url for correct base path
const basePath = import.meta.url ? new URL('.', import.meta.url).href : '';
const TESS_OPTIONS = {
  langPath: './tessdata',
  gzip: false
};

// ==========================================
// Parsing Logic (Copied from main.js)
// ==========================================

function detectExpenseType(text) {
  if (!text) return null
  const clean = text.replace(/\s+/g, '')
  if (/铁路|高铁|动车|12306/.test(clean)) return 'train'
  if (/航空|航班|机票|飞机/.test(clean)) return 'flight'
  if (/滴滴|小桔|DIDI/i.test(clean)) return 'taxi-didi'
  if (/出租|的士/.test(clean) && !/滴滴/.test(clean)) return 'taxi-cab'
  if (/餐饮|餐费|饭店|餐厅|食品|快餐|外卖|美团|饿了么|生煎|拉面|送餐|提号|光临|配送骑士|蜂鸟|餐具|豆腐|粉丝|打包费/.test(clean)) return 'meal'
  if (/入住时间|离店时间|房号.*入住|客房|住宿/.test(clean)) return 'accommodation'
  if (/酒店|宾馆|旅馆/.test(clean) && /入住|房型|离店/.test(clean)) return 'accommodation'
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

function extractAccommodationDates(text) {
  if (!text) return null
  const clean = text.replace(/\s+/g, '')
  const checkInMatch = clean.match(/(?:入住|到达|Check-in)[^\d]*(\d{4}[年\-\/]\d{1,2}[月\-\/]\d{1,2})/)
  const checkOutMatch = clean.match(/(?:离店|退房|离开|Check-out)[^\d]*(\d{4}[年\-\/]\d{1,2}[月\-\/]\d{1,2})/)
  const normalizeDate = (str) => {
    const m = str.match(/(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})/)
    if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`
    return str
  }
  if (checkInMatch || checkOutMatch) {
    return {
      checkIn: checkInMatch ? normalizeDate(checkInMatch[1]) : null,
      checkOut: checkOutMatch ? normalizeDate(checkOutMatch[1]) : null
    }
  }
  return null
}

function extractTaxiTripDate(text) {
  if (!text) return null
  const clean = text.replace(/\s+/g, '')
  const match = clean.match(/(?:行程起止日期|乘车日期|乘车时间)[^\d]*(\d{4}[年\-\/]\d{1,2}[月\-\/]\d{1,2})/)
  if (match) {
    const normalizeDate = (str) => {
      const m = str.match(/(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})/)
      if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`
      return str
    }
    return normalizeDate(match[1])
  }
  return null
}

function extractAmount(text) {
  if (!text) return null
  const clean = text.replace(/\s+/g, '')
  
  const shifu = [...clean.matchAll(/实付[：:\*¥￥Y兰着#=-]*(\d+(?:\.\d{1,2})?)/g)]
  if (shifu.length > 0) {
    const amounts = shifu.map(m => parseFloat(m[1])).filter(v => v > 0 && v < 100000)
    if (amounts.length > 0) return Math.max(...amounts)
  }
  
  const explicitPriority = [
    /[零壹贰叁肆伍陆柒捌玖拾佰仟万亿圆角分整]+(?:圆|角|分|整|元)[：:\*¥￥Y兰着#=\(\)（）]*(\d+(?:\.\d{1,2})?)/,
    /(?:价税合计|合计金额|总金额|实付金额|实付款|应收金额|总价|小写)[：:\*¥￥Y兰着#=\(\)（）]*(\d+(?:\.\d{1,2})?)/,
    /(?:合计|总额|金额)[：:\*¥￥Y兰着#=\(\)（）]*(\d+(?:\.\d{1,2})?)/,
    /(?:在线支付|\u652f付方式[^\d]*)(?:[¥￥]?)(\d+(?:\.\d{1,2})?)/,
  ]
  for (const p of explicitPriority) {
    const m = clean.match(p)
    if (m) {
      const val = parseFloat(m[1])
      if (val > 0 && val < 100000) return val
    }
  }

  const currencyRegexes = [
    /[¥￥](\d+(?:\.\d{1,2})?)/g,
    /(\d+(?:\.\d{1,2})?)[¥￥元]/g,
    /[:：](\d+\.\d{2})/g,
  ]
  let maxCurrencyAmount = -1
  for (const p of currencyRegexes) {
    const matches = [...clean.matchAll(p)]
    if (matches.length > 0) {
      const amounts = matches.map(m => parseFloat(m[1])).filter(v => v > 0 && v < 100000)
      if (amounts.length > 0) maxCurrencyAmount = Math.max(maxCurrencyAmount, ...amounts)
    }
  }
  if (maxCurrencyAmount > 0) return maxCurrencyAmount
  
  const hotelMatch = clean.match(/(\d{3,})(\1)/)
  if (hotelMatch) {
    const val = parseFloat(hotelMatch[1])
    if (val > 0 && val < 100000) return val
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

function autoGroup(results) {
  const invoice = results.find(r => r.role === 'invoice')
  if (!invoice) return results

  let actualDate = invoice.date
  let actualEndDate = invoice.endDate || null
  const attachmentWithDate = results.find(r => r !== invoice && r.date)
  if (attachmentWithDate) {
    actualDate = attachmentWithDate.date
    if (attachmentWithDate.endDate) actualEndDate = attachmentWithDate.endDate
  }
  
  invoice.date = actualDate
  invoice.endDate = actualEndDate
  invoice.status = (invoice.expenseType && invoice.date && invoice.amount && invoice.role) ? 'ok' : 'incomplete'

  let attachmentIdx = 1
  for (const item of results) {
    if (item === invoice) continue
    item.expenseType = invoice.expenseType
    item.date = actualDate
    item.endDate = actualEndDate
    item.amount = invoice.amount
    if (item.role !== 'invoice' && item.role !== 'itinerary') {
      item.role = `attachment${attachmentIdx}`
      attachmentIdx++
    }
    item.status = (item.expenseType && item.date && item.amount && item.role) ? 'ok' : 'incomplete'
  }
  return results
}

// ==========================================
// Core Web File Processing
// ==========================================

async function extractPdfText(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;
    let fullText = '';

    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map(item => item.str);
      fullText += strings.join(' ') + '\n';
    }

    const strippedText = fullText.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '').trim();
    if (strippedText === '') {
       const page = await pdfDocument.getPage(1);
       const viewport = page.getViewport({ scale: 1.5 });
       const canvas = document.createElement('canvas');
       const context = canvas.getContext('2d');
       canvas.height = viewport.height;
       canvas.width = viewport.width;
       await page.render({ canvasContext: context, viewport: viewport }).promise;
       
       const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
       if (blob) {
         fullText = await extractImageText(blob);
       }
    }
    return fullText;
  } catch (error) {
    console.error('Error extracting PDF:', error);
    return '';
  }
}

async function extractImageText(fileOrBlob) {
  try {
    // Timeout after 30 seconds to prevent infinite hang
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('OCR 超时')), 30000)
    );
    const ocrPromise = (async () => {
      const worker = await createWorker('chi_sim', 1, TESS_OPTIONS);
      const { data: { text } } = await worker.recognize(fileOrBlob);
      await worker.terminate();
      return text;
    })();
    return await Promise.race([ocrPromise, timeoutPromise]);
  } catch (error) {
    console.error('Error extracting Image OCR:', error);
    return '';
  }
}

async function analyzeSingleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  let text = '';

  if (ext === 'pdf') {
    text = await extractPdfText(file);
  } else if (['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'webp'].includes(ext)) {
    text = await extractImageText(file);
  }

  const expenseType = detectExpenseType(text);
  let date = extractDate(text);
  let endDate = null;
  const amount = extractAmount(text);
  const role = detectRole(text, expenseType);

  if (expenseType === 'accommodation') {
    const dates = extractAccommodationDates(text);
    if (dates) {
      date = dates.checkIn || date;
      endDate = dates.checkOut || null;
    }
  } else if (expenseType && expenseType.startsWith('taxi')) {
    const tripDate = extractTaxiTripDate(text);
    if (tripDate) {
      date = tripDate;
    }
  }

  return {
    file, 
    originalName: file.name,
    text,
    expenseType,
    date,
    endDate,
    amount,
    role,
    status: (expenseType && date && amount && role) ? 'ok' : 'incomplete',
    groupId: null,
  };
}

export async function analyzeFiles(filesArray, groupType) {
  const results = [];
  for (const file of filesArray) {
    const result = await analyzeSingleFile(file);
    results.push(result);
  }

  if (groupType === 'meal') {
    return autoGroup(results);
  }

  const taxiInvoices = results.filter(r => r.expenseType && r.expenseType.startsWith('taxi') && r.role === 'invoice');
  const taxiItineraries = results.filter(r => r.expenseType && r.expenseType.startsWith('taxi') && r.role === 'itinerary');
  
  for (const inv of taxiInvoices) {
    if (inv.amount) {
      const match = taxiItineraries.find(it => it.amount === inv.amount && it.amount > 0);
      if (match && match.date) {
        inv.date = match.date;
        inv.status = (inv.expenseType && inv.date && inv.amount && inv.role) ? 'ok' : 'incomplete';
      }
    }
  }

  return results;
}
