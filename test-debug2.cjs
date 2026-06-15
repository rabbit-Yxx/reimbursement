// Deep debug: analyze the two failing OCR texts
const fs = require('fs');
const path = require('path');

async function main() {
  const { PDFParse } = await import('pdf-parse');
  const { createWorker } = await import('tesseract.js');

  const files = [
    '上海出差 20260303-20260305/餐费 0304 62.70元 支付记录.pdf',
    '上海出差 20260303-20260305/住宿 0305 1314.00元 水单.pdf',
    '上海出差 20260303-20260305/餐费 0304 62.70元 水单.pdf',
  ];
  
  for (const file of files) {
    console.log(`\n============ ${path.basename(file)} ============`);
    const buffer = fs.readFileSync(file);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    let text = result.text || '';
    
    const strippedText = text.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '').trim();
    if (strippedText === '') {
      const imgs = await parser.getImage({ imageBuffer: true });
      if (imgs && imgs.pages && imgs.pages[0] && imgs.pages[0].images.length > 0) {
        const worker = await createWorker('chi_sim');
        const { data: { text: ocrText } } = await worker.recognize(imgs.pages[0].images[0].data);
        await worker.terminate();
        text = ocrText;
      }
    }
    await parser.destroy();
    
    console.log('--- FULL OCR TEXT ---');
    console.log(text);
    console.log('--- CLEAN TEXT ---');
    console.log(text.replace(/\s+/g, ''));
    console.log('---');
  }
}

main().catch(console.error);
