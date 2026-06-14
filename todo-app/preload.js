const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('todos', {
  load: () => ipcRenderer.invoke('todos:load'),
  save: (todos) => ipcRenderer.invoke('todos:save', todos),
});
