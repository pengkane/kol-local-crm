import { useMemo, useState } from 'react';

export default function TagInput({ value, onChange, suggestions }) {
  const [draft, setDraft] = useState('');

  const filteredSuggestions = useMemo(() => {
    const current = new Set(value);
    return suggestions.filter((tag) => !current.has(tag));
  }, [suggestions, value]);

  function addTag(rawTag) {
    const tag = rawTag.trim().replace(/\s+/g, '_');
    if (!tag || value.includes(tag)) return;
    onChange([...value, tag]);
    setDraft('');
  }

  function removeTag(tag) {
    onChange(value.filter((item) => item !== tag));
  }

  function toggleTag(tag) {
    if (value.includes(tag)) {
      removeTag(tag);
      return;
    }
    addTag(tag);
  }

  function handleChipMouseDown(event) {
    event.preventDefault();
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag(draft);
    }
    if (event.key === 'Backspace' && !draft && value.length) {
      removeTag(value[value.length - 1]);
    }
  }

  return (
    <div className="tag-input-wrap">
      <div className="tag-list">
        {value.map((tag) => (
          <button
            key={tag}
            type="button"
            className="tag-chip active"
            onMouseDown={handleChipMouseDown}
            onClick={() => toggleTag(tag)}
          >
            {tag}
          </button>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add tag"
        />
      </div>
      <div className="tag-suggestions">
        {filteredSuggestions.slice(0, 12).map((tag) => (
          <button
            key={tag}
            type="button"
            className="tag-chip"
            onMouseDown={handleChipMouseDown}
            onClick={() => toggleTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}
