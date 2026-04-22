const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_TAGS = [
  'connected',
  'collaborated',
  'potential',
  'replied',
  'no_response',
  'follow_up',
  'partner',
  'creator',
  'investor',
  'media',
  'competitor'
];

const DEFAULT_STATUSES = [
  'new',
  'connected',
  'collaborated',
  'potential',
  'replied',
  'no_response',
  'follow_up'
];

let db;
let dbPath;

function ensureDb() {
  if (!db) {
    throw new Error('Database not initialized');
  }
}

function persistDatabase() {
  ensureDb();
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function normalizeHandle(handle = '') {
  const trimmed = handle.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('@') ? trimmed.toLowerCase() : `@${trimmed.toLowerCase()}`;
}

function normalizeUrl(url = '', handle = '') {
  if (url?.trim()) return url.trim();
  if (!handle) return '';
  return `https://x.com/${normalizeHandle(handle).slice(1)}`;
}

function toJson(value, fallback) {
  try {
    return JSON.stringify(value ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function mapContact(row) {
  if (!row) return null;
  return {
    ...row,
    tags: parseJson(row.tags, []),
    contact_history: parseJson(row.contact_history, [])
  };
}

async function initializeDatabase(userDataPath) {
  fs.mkdirSync(userDataPath, { recursive: true });
  dbPath = path.join(userDataPath, 'kol-local-crm.sqlite');
  const SQL = await initSqlJs();
  const fileBuffer = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : undefined;
  db = new SQL.Database(fileBuffer);

  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL DEFAULT 'x',
      display_name TEXT NOT NULL,
      handle TEXT NOT NULL UNIQUE,
      profile_url TEXT NOT NULL,
      bio TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      relationship_status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_contacted_at TEXT DEFAULT '',
      contact_history TEXT NOT NULL DEFAULT '[]'
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_updated_at ON contacts(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_contacts_display_name ON contacts(display_name);
    CREATE INDEX IF NOT EXISTS idx_contacts_relationship_status ON contacts(relationship_status);
  `);

  persistDatabase();
}

function selectAll(sql, params = []) {
  ensureDb();
  const statement = db.prepare(sql, params);
  const rows = [];
  while (statement.step()) {
    rows.push(statement.getAsObject());
  }
  statement.free();
  return rows;
}

function selectOne(sql, params = []) {
  const rows = selectAll(sql, params);
  return rows[0] || null;
}

function runStatement(sql, params = {}) {
  ensureDb();
  const boundParams = Array.isArray(params)
    ? params
    : Object.fromEntries(Object.entries(params).map(([key, value]) => [`@${key}`, value]));
  db.run(sql, boundParams);
  persistDatabase();
}

function preparePayload(input, existing = null) {
  const now = new Date().toISOString();
  const handle = normalizeHandle(input.handle || existing?.handle || '');
  if (!handle) {
    throw new Error('Handle is required');
  }

  const tags = Array.from(
    new Set(
      (input.tags || existing?.tags || [])
        .map((tag) => String(tag).trim())
        .filter(Boolean)
    )
  );

  return {
    id: existing?.id || input.id || uuidv4(),
    platform: 'x',
    display_name: (input.display_name || existing?.display_name || handle.replace('@', '')).trim(),
    handle,
    profile_url: normalizeUrl(input.profile_url, handle),
    bio: (input.bio || existing?.bio || '').trim(),
    avatar_url: (input.avatar_url || existing?.avatar_url || '').trim(),
    notes: input.notes ?? existing?.notes ?? '',
    tags,
    relationship_status: input.relationship_status || existing?.relationship_status || 'new',
    created_at: existing?.created_at || now,
    updated_at: now,
    last_contacted_at: input.last_contacted_at ?? existing?.last_contacted_at ?? '',
    contact_history: input.contact_history ?? existing?.contact_history ?? []
  };
}

function listContacts(filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    clauses.push('(display_name LIKE ? OR handle LIKE ? OR notes LIKE ? OR bio LIKE ?)');
    params.push(term, term, term, term);
  }

  if (filters.status) {
    clauses.push('relationship_status = ?');
    params.push(filters.status);
  }

  if (filters.tag) {
    clauses.push('tags LIKE ?');
    params.push(`%"${filters.tag}"%`);
  }

  const sql = `
    SELECT *
    FROM contacts
    ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
    ORDER BY datetime(updated_at) DESC, lower(display_name) ASC
  `;

  return selectAll(sql, params).map(mapContact);
}

function searchContacts(query = '') {
  return listContacts({ search: query });
}

function getContact(id) {
  return mapContact(selectOne('SELECT * FROM contacts WHERE id = ?', [id]));
}

function getContactByHandle(handle) {
  return mapContact(selectOne('SELECT * FROM contacts WHERE handle = ?', [normalizeHandle(handle)]));
}

function insertPreparedContact(contact) {
  runStatement(`
    INSERT INTO contacts (
      id, platform, display_name, handle, profile_url, bio, avatar_url,
      notes, tags, relationship_status, created_at, updated_at,
      last_contacted_at, contact_history
    ) VALUES (
      @id, @platform, @display_name, @handle, @profile_url, @bio, @avatar_url,
      @notes, @tags, @relationship_status, @created_at, @updated_at,
      @last_contacted_at, @contact_history
    )
  `, {
    ...contact,
    tags: toJson(contact.tags, []),
    contact_history: toJson(contact.contact_history, [])
  });

  return getContact(contact.id);
}

function createContact(input) {
  const existing = getContactByHandle(input.handle);
  if (existing) {
    return {
      duplicate: true,
      record: existing
    };
  }

  return {
    duplicate: false,
    record: insertPreparedContact(preparePayload(input))
  };
}

function updateContact(id, input) {
  const existing = getContact(id);
  if (!existing) {
    throw new Error('Contact not found');
  }

  const prepared = preparePayload(input, existing);
  const duplicate = getContactByHandle(prepared.handle);
  if (duplicate && duplicate.id !== id) {
    return {
      duplicate: true,
      record: duplicate
    };
  }

  runStatement(`
    UPDATE contacts
    SET display_name = @display_name,
        handle = @handle,
        profile_url = @profile_url,
        bio = @bio,
        avatar_url = @avatar_url,
        notes = @notes,
        tags = @tags,
        relationship_status = @relationship_status,
        updated_at = @updated_at,
        last_contacted_at = @last_contacted_at,
        contact_history = @contact_history
    WHERE id = @id
  `, {
    ...prepared,
    tags: toJson(prepared.tags, []),
    contact_history: toJson(prepared.contact_history, [])
  });

  return {
    duplicate: false,
    record: getContact(id)
  };
}

function upsertContact(input) {
  const existing = getContactByHandle(input.handle);
  if (!existing) {
    return {
      duplicate: false,
      mode: 'created',
      record: insertPreparedContact(preparePayload(input))
    };
  }

  const merged = preparePayload(
    {
      ...input,
      notes: [existing.notes, input.notes].filter(Boolean).join(existing.notes && input.notes ? '\n\n' : ''),
      tags: Array.from(new Set([...(existing.tags || []), ...(input.tags || [])])),
      relationship_status: input.relationship_status || existing.relationship_status,
      bio: input.bio || existing.bio,
      avatar_url: input.avatar_url || existing.avatar_url,
      profile_url: input.profile_url || existing.profile_url,
      display_name: input.display_name || existing.display_name,
      contact_history: Array.from(new Set([...(existing.contact_history || []), ...(input.contact_history || [])]))
    },
    existing
  );

  runStatement(`
    UPDATE contacts
    SET display_name = @display_name,
        profile_url = @profile_url,
        bio = @bio,
        avatar_url = @avatar_url,
        notes = @notes,
        tags = @tags,
        relationship_status = @relationship_status,
        updated_at = @updated_at,
        last_contacted_at = @last_contacted_at,
        contact_history = @contact_history
    WHERE id = @id
  `, {
    ...merged,
    tags: toJson(merged.tags, []),
    contact_history: toJson(merged.contact_history, [])
  });

  return {
    duplicate: true,
    mode: 'updated',
    record: getContact(existing.id)
  };
}

function getFilterOptions() {
  const rows = selectAll('SELECT tags, relationship_status FROM contacts');
  const tags = new Set(DEFAULT_TAGS);
  const statuses = new Set(DEFAULT_STATUSES);

  rows.forEach((row) => {
    parseJson(row.tags, []).forEach((tag) => tags.add(tag));
    if (row.relationship_status) statuses.add(row.relationship_status);
  });

  return {
    tags: Array.from(tags).sort(),
    statuses: Array.from(statuses)
  };
}

module.exports = {
  DEFAULT_TAGS,
  DEFAULT_STATUSES,
  initializeDatabase,
  listContacts,
  searchContacts,
  getContact,
  createContact,
  updateContact,
  upsertContact,
  getFilterOptions,
  normalizeHandle
};
