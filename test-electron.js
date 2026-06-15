const { app } = require('electron')
const path = require('path')

app.whenReady().then(async () => {
  const main = await import('./dist-electron/main.js')
  console.log('App ready, running analyzeFile...')
  // call the inner analyzeFile by mocking IPC? 
  // Wait, main.js only exposes things via ipcMain.handle
  app.quit()
})
