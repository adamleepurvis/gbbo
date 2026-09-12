import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function WeekManager({ season }) {
  const [weeks, setWeeks] = useState([])
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season.id])

  async function load() {
    const { data } = await supabase.from('weeks').select('*').eq('season_id', season.id).order('week_number')
    setWeeks(data ?? [])
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
        {weeks.map((w) => (
          <li key={w.id} className="admin-list-item">
            <span>Week {w.week_number}{w.label ? ` — ${w.label}` : ''}</span>
            <span className={`badge badge-status-${w.status}`}>{w.status}</span>
            {w.status === 'open' && (
              <button className="btn btn-ghost" onClick={() => setStatus(w, 'locked')}>Lock Picks</button>
            )}
            {w.status === 'locked' && (
              <button className="btn btn-ghost" onClick={() => setStatus(w, 'open')}>Reopen Picks</button>
            )}
            {w.status === 'complete' && <span className="hint">scored — see Results tab</span>}
          </li>
        ))}
        {weeks.length === 0 && <p className="empty-state">No weeks yet for {season.name} — open the first one above.</p>}
      </ul>
    </div>
  )
}
