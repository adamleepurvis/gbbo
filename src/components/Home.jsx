import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function initials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [season, setSeason] = useState(null)
  const [contestants, setContestants] = useState([])
  const [players, setPlayers] = useState([])

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: seasons } = await supabase
      .from('seasons')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)

    const activeSeason = seasons?.[0] ?? null
    setSeason(activeSeason)

    const [{ data: cons }, { data: profiles }] = await Promise.all([
      activeSeason
        ? supabase.from('contestants').select('*').eq('season_id', activeSeason.id).order('name')
        : Promise.resolve({ data: [] }),
      supabase.from('profiles').select('*').order('created_at', { ascending: true }),
    ])

    setContestants(cons ?? [])
    setPlayers(profiles ?? [])
    setLoading(false)
  }

  if (loading) return <div className="page"><p>Loading…</p></div>

  return (
    <div className="page">
      <h1>🍰 Bake Off Fantasy</h1>
      <p className="page-subtitle">{season ? season.name : 'No active season yet'}</p>

      <section className="home-section">
        <h2>How to Play</h2>
        <p>
          Each week, before results are revealed, submit your predictions for that episode:
        </p>
        <ul className="rules-list">
          <li>Will there be a <strong>Hollywood Handshake</strong>? (Yes / No)</li>
          <li>If yes — <strong>who</strong> gets it?</li>
          <li><strong>First</strong> in the Technical Challenge</li>
          <li><strong>Last</strong> in the Technical Challenge</li>
          <li><strong>Star Baker</strong></li>
          <li>Who's <strong>eliminated</strong></li>
        </ul>
        <p>Once the admin submits the real results, your week is scored:</p>
        <ul className="rules-list">
          <li><strong>+1</strong> for each correct pick — first, last, star baker, eliminated</li>
          <li><strong>Handshake Yes/No:</strong> +1 if you call it right, <strong>&minus;1</strong> if you don't</li>
          <li><strong>Handshake Who:</strong> an extra +1, but only if you guessed "Yes" <em>and</em> named the right baker — guessing "No" skips this pick entirely (no bonus, no penalty)</li>
        </ul>
        <p className="hint">Max 6 points in a handshake week, 5 points in a no-handshake week.</p>
      </section>

      <section className="home-section">
        <div className="section-header-row">
          <h2>This Series' Bakers</h2>
          <a
            className="external-link"
            href="https://thegreatbritishbakeoff.co.uk/meet-the-class-of-2026/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Meet the Contestants ↗
          </a>
        </div>
        {contestants.length === 0 ? (
          <p className="empty-state">No bakers added yet.</p>
        ) : (
          <div className="baker-grid">
            {contestants.map((c) => (
              <div key={c.id} className={c.is_active ? 'baker-card' : 'baker-card eliminated'}>
                <div className="baker-avatar">{initials(c.name)}</div>
                <span className="baker-name">{c.name}</span>
                {!c.is_active && <span className="badge badge-status-complete">out</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="home-section">
        <h2>Fantasy Players</h2>
        {players.length === 0 ? (
          <p className="empty-state">No one has signed up yet.</p>
        ) : (
          <div className="player-grid">
            {players.map((p) => (
              <div key={p.id} className="player-card">
                <div className="baker-avatar player-avatar">{initials(p.display_name)}</div>
                <span className="baker-name">{p.display_name}</span>
                {p.is_admin && <span className="badge badge-saved">admin</span>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
