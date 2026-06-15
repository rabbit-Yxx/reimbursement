// Test autoGroup logic
const results = [
  { originalName: '1.pdf', expenseType: 'meal', date: '2026-03-04', amount: 54, role: 'invoice', status: 'ok' },
  { originalName: 'IMG_001.pdf', expenseType: null, date: null, amount: null, role: null, status: 'incomplete' },
  { originalName: 'screenshot.pdf', expenseType: 'meal', date: '2026-03-04', amount: null, role: 'payment', status: 'incomplete' },
]

function autoGroup(results) {
  const invoice = results.find(r => r.role === 'invoice')
  if (!invoice) return results

  let attachmentIdx = 1
  for (const item of results) {
    if (item === invoice) continue
    if (!item.expenseType && invoice.expenseType) item.expenseType = invoice.expenseType
    if (!item.date && invoice.date) item.date = invoice.date
    if (!item.amount && invoice.amount) item.amount = invoice.amount
    if (item.role !== 'invoice' && item.role !== 'itinerary') {
      item.role = `attachment${attachmentIdx}`
      attachmentIdx++
    }
    item.status = (item.expenseType && item.date && item.amount && item.role) ? 'ok' : 'incomplete'
  }
  return results
}

const grouped = autoGroup(results)
for (const item of grouped) {
  console.log(`${item.originalName}: type=${item.expenseType}, date=${item.date}, amount=${item.amount}, role=${item.role}, status=${item.status}`)
}
