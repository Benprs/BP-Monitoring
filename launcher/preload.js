console.log('Preload script loaded');

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  launchVite: () => ipcRenderer.invoke('launch-vite')
});