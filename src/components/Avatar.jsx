const BG_COLORS = ['#f6d8c8', '#dde6ef', '#e3f0e5', '#f0d9e8', '#fdeecb', '#dcebe9']
const SKIN_TONES = ['#f4c2a1', '#e8b088', '#c68863', '#8d5a3b', '#5c3a21']
const HAIR_COLORS = ['#3a2e2a', '#6b4226', '#a35c2f', '#d4a017', '#8a8f99', '#c8577a']

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function IllustratedAvatar({ name, size }) {
  const hash = hashString(name || '?')
  const bg = BG_COLORS[hash % BG_COLORS.length]
  const skin = SKIN_TONES[Math.floor(hash / 7) % SKIN_TONES.length]
  const hair = HAIR_COLORS[Math.floor(hash / 13) % HAIR_COLORS.length]

  return (
    <svg viewBox="0 0 56 56" width={size} height={size} role="img" aria-label={name}>
      <circle cx="28" cy="28" r="28" fill={bg} />
      <path d="M14 24 Q14 10 28 10 Q42 10 42 24 L38 24 Q38 15 28 15 Q18 15 18 24 Z" fill={hair} />
      <circle cx="28" cy="32" r="13" fill={skin} />
      <path
        d="M14 26 Q14 8 28 8 Q42 8 42 26 Q42 20 36 19 Q34 15 28 15 Q22 15 20 19 Q14 20 14 26 Z"
        fill="#ffffff"
        stroke="#ecdcc9"
        strokeWidth="1"
      />
      <circle cx="23.5" cy="32" r="1.6" fill="#2a2a2a" />
      <circle cx="32.5" cy="32" r="1.6" fill="#2a2a2a" />
      <path d="M23 37 Q28 41 33 37" stroke="#2a2a2a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
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
  return <IllustratedAvatar name={name} size={size} />
}
