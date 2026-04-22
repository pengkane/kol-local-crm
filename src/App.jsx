import { useEffect, useMemo, useState } from 'react';
import ContactForm from './components/ContactForm';
import ContactList from './components/ContactList';
import Filters from './components/Filters';
import { EMPTY_CONTACT, DEFAULT_STATUSES, DEFAULT_TAGS } from './constants';
import { createContact, getFilterOptions, listContacts, openExternal, updateContact } from './lib/api';

const INITIAL_FILTERS = {
  search: '',
  status: '',
  tag: ''
};

export default function App() {
  const [contacts, setContacts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [options, setOptions] = useState({ tags: DEFAULT_TAGS, statuses: DEFAULT_STATUSES });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicateState, setDuplicateState] = useState(null);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedId) || null,
    [contacts, selectedId]
  );

  async function refresh(activeFilters = filters) {
    setLoading(true);
    setError('');
    try {
      const [nextContacts, nextOptions] = await Promise.all([
        listContacts(activeFilters),
        getFilterOptions()
      ]);
      setContacts(nextContacts);
      setOptions({
        tags: nextOptions.tags?.length ? nextOptions.tags : DEFAULT_TAGS,
        statuses: nextOptions.statuses?.length ? nextOptions.statuses : DEFAULT_STATUSES
      });
      if (selectedId && !nextContacts.some((contact) => contact.id === selectedId)) {
        setSelectedId(null);
      }
    } catch (nextError) {
      setError(nextError.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh(filters);
  }, []);

  async function handleFilterChange(nextFilters) {
    setFilters(nextFilters);
    await refresh(nextFilters);
  }

  async function handleSubmit(payload) {
    setSaving(true);
    setError('');
    setDuplicateState(null);

    try {
      const result = selectedContact
        ? await updateContact(selectedContact.id, payload)
        : await createContact(payload);

      setContacts((current) => {
        if (!result.record) return current;
        const existingIndex = current.findIndex((contact) => contact.id === result.record.id);
        if (existingIndex === -1) {
          return [result.record, ...current];
        }

        const next = [...current];
        next[existingIndex] = result.record;
        return next;
      });

      if (result.duplicate) {
        setDuplicateState(result.record);
        setSelectedId(result.record.id);
      } else {
        setSelectedId(result.record.id);
      }

      await refresh(filters);
    } catch (nextError) {
      setError(nextError.message || 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  }

  function resetEditor() {
    setSelectedId(null);
    setDuplicateState(null);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="app-header">
          <div>
            <p className="eyebrow">Local-first KOL CRM</p>
            <h1>X Contact Tracker</h1>
          </div>
          <button type="button" className="primary-button" onClick={resetEditor}>
            Manual Add
          </button>
        </div>

        <Filters filters={filters} options={options} onChange={handleFilterChange} onReset={() => handleFilterChange(INITIAL_FILTERS)} />

        {error ? <div className="error-banner">{error}</div> : null}
        {loading ? <div className="loading-state">Loading contacts...</div> : null}

        <ContactList contacts={contacts} selectedId={selectedId} onSelect={setSelectedId} />
      </aside>

      <section className="content">
        <ContactForm
          key={selectedContact?.id || 'new'}
          contact={selectedContact || EMPTY_CONTACT}
          mode={selectedContact ? 'edit' : 'create'}
          statuses={options.statuses}
          tags={options.tags}
          submitLabel={saving ? 'Saving...' : selectedContact ? 'Save Changes' : 'Save Contact'}
          duplicateState={duplicateState}
          onSubmit={handleSubmit}
          onCancel={resetEditor}
          onUseDuplicate={(record) => {
            setSelectedId(record.id);
            setDuplicateState(null);
          }}
          onOpenProfile={openExternal}
        />
      </section>
    </main>
  );
}
