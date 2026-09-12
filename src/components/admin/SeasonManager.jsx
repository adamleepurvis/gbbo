import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function SeasonManager({ seasons, onChange }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  async function createSeason(e) {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    const { error } = await supabase.from('seasons').insert({ name: name.trim(), is_active: seasons.length === 0 })
    if (error) setError(error.message)
    else {
      setName('')
      onChange()
    }
  }

  async function makeActive(seasonId) {
    setError('')
    const { error: deactivateErr } = await supabase.from('seasons').update({ is_active: false }).neq('id', seasonId)
    const { error: activateErr } = await supabase.from('seasons').update({ is_active: true }).eq('id', seasonId)
    if (deactivateErr || activateErr) setError((deactivateErr || activateErr).message)
    onChange()
  }

  return (
    <div>
      <form className="inline-form" onSubmit={createSeason}>
        <input
          type="text"
          placeholder="e.g. Series 15"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">Add Season</button>
      </form>

      {error && <p className="auth-error">{error}</p>}

      <ul className="admin-list">
        {seasons.map((s) => (
          <li key={s.id} className="admin-list-item">
            <span>{s.name}</span>
            {s.is_active ? (
              <span className="badge badge-saved">Active</span>
            ) : (
              <button className="btn btn-ghost" onClick={() => makeActive(s.id)}>Make Active</button>
            )}
          </li>
        ))}
        {seasons.length === 0 && <p className="empty-state">No seasons yet — add one above.</p>}
      </ul>
    </div>
  )
}
