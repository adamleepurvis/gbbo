import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function ContestantManager({ season }) {
  const [contestants, setContestants] = useState([])
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season.id])

  async function load() {
    const { data } = await supabase.from('contestants').select('*').eq('season_id', season.id).order('name')
    setContestants(data ?? [])
  }

  async function addContestant(e) {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    const { error } = await supabase.from('contestants').insert({ season_id: season.id, name: name.trim() })
    if (error) setError(error.message)
    else {
      setName('')
      load()
    }
  }

  async function toggleActive(contestant) {
    setError('')
    const { error } = await supabase
      .from('contestants')
      .update({ is_active: !contestant.is_active })
      .eq('id', contestant.id)
    if (error) setError(error.message)
    else load()
  }

  return (
    <div>
      <form className="inline-form" onSubmit={addContestant}>
        <input
          type="text"
          placeholder="Baker's name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">Add Baker</button>
      </form>

      {error && <p className="auth-error">{error}</p>}

      <ul className="admin-list">
        {contestants.map((c) => (
          <li key={c.id} className="admin-list-item">
            <span className={c.is_active ? '' : 'strikethrough'}>{c.name}</span>
            <button className="btn btn-ghost" onClick={() => toggleActive(c)}>
              {c.is_active ? 'Mark Eliminated' : 'Mark Active'}
            </button>
          </li>
        ))}
        {contestants.length === 0 && <p className="empty-state">No bakers yet for {season.name} — add one above.</p>}
      </ul>
    </div>
  )
}
