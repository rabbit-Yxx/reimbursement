const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Utility for getting real file path from File object (especially in dev mode http://)
  getFilePath: (file) => {
    if (webUtils && webUtils.getPathForFile) {
      return webUtils.getPathForFile(file)
    }
    return file.path
  },

  // Window controls
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),

  // Config
  configGet: () => ipcRenderer.invoke('config:get'),
  configSet: (data) => ipcRenderer.invoke('config:set', data),

  // Standards
  standardsGet: () => ipcRenderer.invoke('standards:get'),
  standardsSet: (data) => ipcRenderer.invoke('standards:set', data),
  standardsParseFile: (filePath) => ipcRenderer.invoke('standards:parseFile', filePath),

  // File dialogs
  dialogOpenFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  dialogSaveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  shellOpenPath: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),

  // File processing
  filesAnalyze: (filePaths, groupType) => ipcRenderer.invoke('files:analyze', filePaths, groupType),
  filesPackage: (confirmedItems) => ipcRenderer.invoke('files:package', confirmedItems),
})
