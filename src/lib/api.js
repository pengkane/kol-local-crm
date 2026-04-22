export async function listContacts(filters = {}) {
  return window.kolApi.listContacts(filters);
}

export async function getFilterOptions() {
  return window.kolApi.getFilterOptions();
}

export async function createContact(payload) {
  return window.kolApi.createContact(payload);
}

export async function updateContact(id, payload) {
  return window.kolApi.updateContact(id, payload);
}

export async function openExternal(url) {
  return window.kolApi.openExternal(url);
}
