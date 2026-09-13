import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function WeekManager({ season }) {
  const [weeks, setWeeks] = useState([])
  const [players, setPlayers] = useState([])
  const [picksByWeek, setPicksByWeek] = useState({}) // week_id -> Set of user_id
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season.id])

  async function load() {
    const { data: wks } = await supabase.from('weeks').select('*').eq('season_id', season.id).order('week_number')
    setWeeks(wks ?? [])

    const weekIds = (wks ?? []).map((w) => w.id)
    const [{ data: profiles }, { data: picks }] = await Promise.all([
      supabase.from('profiles').select('id, display_name'),
      weekIds.length
        ? supabase.from('picks').select('week_id, user_id').in('week_id', weekIds)
        : Promise.resolve({ data: [] }),
    ])
    setPlayers(profiles ?? [])

    const map = {}
    for (const p of picks ?? []) {
      if (!map[p.week_id]) map[p.week_id] = new Set()
      map[p.week_id].add(p.user_id)
    }
    setPicksByWeek(map)
  }

  async function addWeek(e) {
    e.preventDefault()
    setError('')
    const nextNumber = weeks.length ? Math.max(...weeks.map((w) => w.week_number)) + 1 : 1
    const { error } = await supabase.from('weeks').insert({
      season_id: season.id,
      week_number: nextNumber,
      label: label.trim(),
      status: 'open',
    })
    if (error) setError(error.message)
    else {
      setLabel('')
      load()
    }
  }

  async function setStatus(week, status) {
    setError('')
    const { error } = await supabase.from('weeks').update({ status }).eq('id', week.id)
    if (error) setError(error.message)
    else load()
  }

  return (
    <div>
      <form className="inline-form" onSubmit={addWeek}>
        <input
          type="text"
          placeholder="Theme (optional), e.g. Bread Week"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">Open Next Week</button>
      </form>

      {error && <p className="auth-error">{error}</p>}

      <ul className="admin-list">
        {weeks.map((w) => {
          const submittedIds = picksByWeek[w.id] ?? new Set()
          const missing = players.filter((p) => !submittedIds.has(p.id))
          return (
            <li key={w.id} className="admin-list-item admin-list-item-stacked">
              <div className="admin-list-item-row">
                <span className="flex-name">Week {w.week_number}{w.label ? ` — ${w.label}` : ''}</span>
                <span className={`badge badge-status-${w.status}`}>{w.status}</span>
                {w.status === 'open' && (
                  <button className="btn btn-ghost" onClick={() => setStatus(w, 'locked')}>Lock Picks</button>
                )}
                {w.status === 'locked' && (
                  <button className="btn btn-ghost" onClick={() => setStatus(w, 'open')}>Reopen Picks</button>
                )}
                {w.status === 'complete' && <span className="hint">scored — see Results tab</span>}
              </div>
              {w.status !== 'complete' && players.length > 0 && (
                <p className="hint submission-status">
                  {submittedIds.size}/{players.length} submitted
                  {missing.length > 0 && ` — missing: ${missing.map((p) => p.display_name).join(', ')}`}
                </p>
              )}
            </li>
          )
        })}
        {weeks.length === 0 && <p className="empty-state">No weeks yet for {season.name} — open the first one above.</p>}
      </ul>
    </div>
  )
}
