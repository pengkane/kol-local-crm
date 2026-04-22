import { useEffect, useState } from 'react';
import TagInput from './TagInput';
import { EMPTY_CONTACT } from '../constants';

function toHistoryLines(value) {
  return value.join('\n');
}

function fromHistoryLines(value) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function ContactForm({
  contact,
  mode,
  statuses,
  tags,
  onSubmit,
  onCancel,
  onOpenProfile,
  submitLabel,
  duplicateState,
  onUseDuplicate
}) {
  const [form, setForm] = useState(EMPTY_CONTACT);

  useEffect(() => {
    setForm({
      ...EMPTY_CONTACT,
      ...contact,
      tags: [...(contact?.tags || [])],
      contact_history: [...(contact?.contact_history || [])]
    });
  }, [contact]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await onSubmit({
      ...form,
      contact_history: fromHistoryLines(toHistoryLines(form.contact_history || []))
    });
  }

  return (
    <section className="detail-panel">
      <div className="panel-header">
        <h2>{mode === 'create' ? 'Add Contact' : 'Edit Contact'}</h2>
        {form.profile_url ? (
          <button type="button" className="secondary-button" onClick={() => onOpenProfile(form.profile_url)}>
            Open X Profile
          </button>
        ) : null}
      </div>

      {duplicateState ? (
        <div className="duplicate-banner">
          <strong>Already exists</strong>
          <span>
            {duplicateState.display_name} ({duplicateState.handle}) already exists. You can load it into the editor and continue updating it.
          </span>
          <button type="button" className="secondary-button" onClick={() => onUseDuplicate(duplicateState)}>
            Open Existing Record
          </button>
        </div>
      ) : null}

      <form className="contact-form" onSubmit={handleSubmit}>
        <div className="contact-form-grid">
        <label>
          <span>Display Name</span>
          <input value={form.display_name} onChange={(event) => updateField('display_name', event.target.value)} required />
        </label>

        <label>
          <span>Handle</span>
          <input value={form.handle} onChange={(event) => updateField('handle', event.target.value)} required />
        </label>

        <label>
          <span>Profile URL</span>
          <input value={form.profile_url} onChange={(event) => updateField('profile_url', event.target.value)} />
        </label>

        <label>
          <span>Bio</span>
          <textarea rows="2" value={form.bio} onChange={(event) => updateField('bio', event.target.value)} />
        </label>

        <label>
          <span>Avatar URL</span>
          <input value={form.avatar_url} onChange={(event) => updateField('avatar_url', event.target.value)} />
        </label>

        <label>
          <span>Notes</span>
          <textarea rows="3" value={form.notes} onChange={(event) => updateField('notes', event.target.value)} />
        </label>

        <label>
          <span>Tags</span>
          <TagInput value={form.tags || []} onChange={(value) => updateField('tags', value)} suggestions={tags} />
        </label>

        <label>
          <span>Relationship Status</span>
          <select value={form.relationship_status} onChange={(event) => updateField('relationship_status', event.target.value)}>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Last Contacted At</span>
          <input
            type="datetime-local"
            value={form.last_contacted_at ? form.last_contacted_at.slice(0, 16) : ''}
            onChange={(event) => updateField('last_contacted_at', event.target.value ? new Date(event.target.value).toISOString() : '')}
          />
        </label>

        <label>
          <span>Contact History</span>
          <textarea
            rows="3"
            value={toHistoryLines(form.contact_history || [])}
            onChange={(event) => updateField('contact_history', fromHistoryLines(event.target.value))}
            placeholder="One line per interaction"
          />
        </label>
        </div>

        <div className="form-actions">
          <button type="submit" className="primary-button">
            {submitLabel}
          </button>
          {mode === 'edit' ? (
            <button type="button" className="secondary-button" onClick={onCancel}>
              New Contact
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
