import Avatar from './Avatar'

export default function ContestantPicker({ contestants, value, onChange, multiple = false }) {
  function isSelected(c) {
    return multiple ? value.includes(c.id) : value === c.id
  }

  function handleClick(c) {
    if (multiple) {
      const next = value.includes(c.id) ? value.filter((id) => id !== c.id) : [...value, c.id]
      onChange(next)
    } else {
      onChange(value === c.id ? '' : c.id)
    }
  }

  return (
    <div className="contestant-picker">
      {contestants.map((c) => (
        <button
          type="button"
          key={c.id}
          className={isSelected(c) ? 'contestant-pick selected' : 'contestant-pick'}
          onClick={() => handleClick(c)}
        >
          <Avatar name={c.name} photoUrl={c.photo_url} size={64} />
          <span>{c.name}</span>
        </button>
      ))}
    </div>
  )
}
