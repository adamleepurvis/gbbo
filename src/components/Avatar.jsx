const BG_COLORS = ['#f6d8c8', '#dde6ef', '#e3f0e5', '#f0d9e8', '#fdeecb', '#dcebe9']
const CAKES = ['🍰', '🧁', '🎂', '🍩', '🍪', '🥧', '🍮', '🍭', '🍫', '🥐', '🍦', '🥯']

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function CakeAvatar({ name, size }) {
  const hash = hashString(name || '?')
  const bg = BG_COLORS[hash % BG_COLORS.length]
  const cake = CAKES[Math.floor(hash / 7) % CAKES.length]

  return (
    <div
      role="img"
      aria-label={name}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.55,
        lineHeight: 1,
      }}
    >
      {cake}
    </div>
  )
}

export default function Avatar({ name, photoUrl, size = 56 }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        className="avatar-photo"
        style={{ width: size, height: size }}
      />
    )
  }
  return <CakeAvatar name={name} size={size} />
}
