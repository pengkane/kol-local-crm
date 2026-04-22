export default function Filters({ filters, options, onChange, onReset }) {
  return (
    <section className="filters-panel">
      <input
        className="search-input"
        type="search"
        value={filters.search}
        onChange={(event) => onChange({ ...filters, search: event.target.value })}
        placeholder="Search name, handle, notes, bio"
      />
      <select value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value })}>
        <option value="">All statuses</option>
        {options.statuses.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      <select value={filters.tag} onChange={(event) => onChange({ ...filters, tag: event.target.value })}>
        <option value="">All tags</option>
        {options.tags.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>
      <button type="button" className="secondary-button" onClick={onReset}>
        Reset
      </button>
    </section>
  );
}
