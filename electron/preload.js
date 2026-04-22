const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kolApi', {
  listContacts: (filters) => ipcRenderer.invoke('contacts:list', filters),
  getContact: (id) => ipcRenderer.invoke('contacts:get', id),
  createContact: (payload) => ipcRenderer.invoke('contacts:create', payload),
  updateContact: (id, payload) => ipcRenderer.invoke('contacts:update', id, payload),
  upsertContact: (payload) => ipcRenderer.invoke('contacts:upsert', payload),
  getFilterOptions: () => ipcRenderer.invoke('contacts:filters'),
  searchContacts: (query) => ipcRenderer.invoke('contacts:search', query),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
});
