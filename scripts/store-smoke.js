const os = require('os');
const path = require('path');
const fs = require('fs');
const {
  initializeDatabase,
  createContact,
  upsertContact,
  listContacts,
  getFilterOptions
} = require('../electron/store');

async function run() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kol-local-crm-'));
  await initializeDatabase(tmpDir);

  const created = createContact({
    display_name: 'Alice Creator',
    handle: '@alice',
    profile_url: 'https://x.com/alice',
    notes: 'First note',
    tags: ['creator'],
    relationship_status: 'potential'
  });

  const upserted = upsertContact({
    handle: '@alice',
    notes: 'Followed up',
    tags: ['follow_up']
  });

  const contacts = listContacts({ search: 'alice' });
  const filters = getFilterOptions();

  console.log(
    JSON.stringify(
      {
        created,
        upserted,
        contacts,
        filters
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
