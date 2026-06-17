export function optimizeInvoices(items, standards, config) {
  // Assume config has mealLimit, taxiLimit
  // standards has accommodation, meal, taxi (daily limits)
  
  const suggestions = []
  const itemsToKeep = []
  const itemsToRemove = []

  // Group items by date and expenseType
  const dailyGroups = {}
  
  items.forEach(item => {
    if (!item.date || !item.amount || !item.expenseType) {
      itemsToKeep.push(item) // Keep incomplete/unknown items as is
      return
    }
    
    if (item.expenseType !== 'taxi-didi' && item.expenseType !== 'taxi-cab' && item.expenseType !== 'meal' && item.expenseType !== 'accommodation') {
      itemsToKeep.push(item) // keep train/flight
      return
    }
    
    const key = `${item.date}_${item.expenseType.startsWith('taxi') ? 'taxi' : item.expenseType}`
    if (!dailyGroups[key]) dailyGroups[key] = []
    dailyGroups[key].push(item)
  })

  Object.keys(dailyGroups).forEach(key => {
    const groupItems = dailyGroups[key]
    const [date, type] = key.split('_')
    
    let limit = 0
    if (type === 'meal') limit = standards?.meal || config.mealLimit || 140
    else if (type === 'taxi') limit = standards?.taxi || config.taxiLimit || 112
    else if (type === 'accommodation') limit = standards?.accommodation || 500

    // Sort items by amount descending
    groupItems.sort((a, b) => b.amount - a.amount)
    
    let currentTotal = 0
    
    for (const item of groupItems) {
      if (currentTotal >= limit) {
        // We already hit the limit, suggest removing this item
        itemsToRemove.push(item)
        suggestions.push({
          type: 'remove',
          item,
          reason: `${date} 的 ${type === 'meal' ? '餐饮' : type === 'taxi' ? '打车' : '住宿'} 额度已满，无需提交此发票（金额 ${item.amount}元）。`
        })
      } else if (currentTotal + item.amount > limit) {
        // This item pushes us over the limit, cap it
        itemsToKeep.push(item)
        const allowedAmount = limit - currentTotal
        suggestions.push({
          type: 'cap',
          item,
          originalAmount: item.amount,
          suggestedAmount: allowedAmount,
          reason: `${date} 的发票金额 ${item.amount}元 超出剩余上限。只需在报销系统填写 ${allowedAmount.toFixed(2)}元 即可。`
        })
        currentTotal += item.amount // Over limit now
      } else {
        itemsToKeep.push(item)
        currentTotal += item.amount
      }
    }
  })

  return { suggestions, itemsToKeep, itemsToRemove }
}
