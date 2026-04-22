function formatUpdatedAt(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

export default function ContactList({ contacts, selectedId, onSelect }) {
  return (
    <section className="list-panel">
      <div className="panel-header">
        <h2>All Contacts</h2>
        <span>{contacts.length}</span>
      </div>
      <div className="contact-list">
        {contacts.map((contact) => (
          <button
            key={contact.id}
            type="button"
            className={`contact-row ${selectedId === contact.id ? 'selected' : ''}`}
            onClick={() => onSelect(contact.id)}
          >
            <img
              className="avatar"
              src={contact.avatar_url || `https://unavatar.io/x/${contact.handle.replace('@', '')}`}
              alt={contact.display_name}
            />
            <div className="contact-main">
              <div className="row-top">
                <strong>{contact.display_name}</strong>
                <span className="status-badge">{contact.relationship_status}</span>
              </div>
              <div className="row-sub">
                <span>{contact.handle}</span>
                <span>{formatUpdatedAt(contact.updated_at)}</span>
              </div>
              <div className="row-tags">
                {contact.tags.slice(0, 4).map((tag) => (
                  <span className="tag-chip small" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
        {!contacts.length && <div className="empty-state">No contacts match the current filters.</div>}
      </div>
    </section>
  );
}
