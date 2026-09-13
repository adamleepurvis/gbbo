import Avatar from './Avatar'

export default function ContestantPicker({ contestants, value, onChange }) {
  return (
    <div className="contestant-picker">
      {contestants.map((c) => (
        <button
          type="button"
          key={c.id}
          className={value === c.id ? 'contestant-pick selected' : 'contestant-pick'}
          onClick={() => onChange(value === c.id ? '' : c.id)}
        >
          <Avatar name={c.name} photoUrl={c.photo_url} size={64} />
          <span>{c.name}</span>
        </button>
      ))}
    </div>
  )
}
