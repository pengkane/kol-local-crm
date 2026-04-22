const express = require('express');
const cors = require('cors');

function createBridgeServer(store) {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/contacts', (req, res) => {
    try {
      const contacts = store.listContacts({
        search: req.query.search || '',
        status: req.query.status || '',
        tag: req.query.tag || ''
      });
      res.json({ contacts });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/contacts/filters', (_req, res) => {
    try {
      res.json(store.getFilterOptions());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/contacts', (req, res) => {
    try {
      const result = store.createContact(req.body);
      res.status(result.duplicate ? 409 : 201).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/contacts/upsert', (req, res) => {
    try {
      const result = store.upsertContact(req.body);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/contacts/:id', (req, res) => {
    try {
      const result = store.updateContact(req.params.id, req.body);
      res.status(result.duplicate ? 409 : 200).json(result);
    } catch (error) {
      const status = error.message === 'Contact not found' ? 404 : 400;
      res.status(status).json({ error: error.message });
    }
  });

  const server = app.listen(43112, '127.0.0.1');
  return server;
}

module.exports = { createBridgeServer };
