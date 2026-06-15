const texts = [
  "实 付 * 62.7",
  "实付 * 62.7",
  "实 付 Y3.7",
  "总 优惠 Y 14.5 实 付 *62.7",
  "总 价 兰 77.2"
];

for (const t of texts) {
  const cleanText = t.replace(/\s+/g, '');
  const m = cleanText.match(/(?:价税合计|合计金额|总金额|实付金额|实付款|应收金额|实付|总价)[：:\*¥￥Y兰着-]*(\d+(?:\.\d{1,2})?)/);
  console.log(t, " => ", m ? m[1] : null);
}
