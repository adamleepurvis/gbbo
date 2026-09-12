import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const emptyPick = {
  handshake_guess: '',
  handshake_contestant_id: '',
  technical_first_id: '',
  technical_last_id: '',
  star_baker_id: '',
  eliminated_id: '',
}

export default function PicksForm() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [season, setSeason] = useState(null)
  const [openWeeks, setOpenWeeks] = useState([])
  const [contestants, setContestants] = useState([])
  const [drafts, setDrafts] = useState({}) // week_id -> pick draft
  const [savedWeekIds, setSavedWeekIds] = useState(new Set())
  const [status, setStatus] = useState({}) // week_id -> 'saving' | 'saved' | error string

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setLoading(true)
    const { data: seasons } = await supabase
      .from('seasons')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)

    const activeSeason = seasons?.[0] ?? null
    setSeason(activeSeason)

    if (!activeSeason) {
      setLoading(false)
      return
    }

    const [{ data: weeks }, { data: cons }, { data: myPicks }] = await Promise.all([
      supabase.from('weeks').select('*').eq('season_id', activeSeason.id).eq('status', 'open').order('week_number'),
      supabase.from('contestants').select('*').eq('season_id', activeSeason.id).eq('is_active', true).order('name'),
      supabase.from('picks').select('*').eq('user_id', user.id),
    ])

    setOpenWeeks(weeks ?? [])
    setContestants(cons ?? [])

    const nextDrafts = {}
    const saved = new Set()
    for (const w of weeks ?? []) {
      const existing = (myPicks ?? []).find((p) => p.week_id === w.id)
      if (existing) {
        nextDrafts[w.id] = {
          handshake_guess: String(existing.handshake_guess),
          handshake_contestant_id: existing.handshake_contestant_id ?? '',
          technical_first_id: existing.technical_first_id,
          technical_last_id: existing.technical_last_id,
          star_baker_id: existing.star_baker_id,
          eliminated_id: existing.eliminated_id,
        }
        saved.add(w.id)
      } else {
        nextDrafts[w.id] = { ...emptyPick }
      }
    }
    setDrafts(nextDrafts)
    setSavedWeekIds(saved)
    setLoading(false)
  }

  function updateDraft(weekId, field, value) {
    setDrafts((prev) => ({
      ...prev,
      [weekId]: {
        ...prev[weekId],
        [field]: value,
        ...(field === 'handshake_guess' && value !== 'true' ? { handshake_contestant_id: '' } : {}),
      },
    }))
  }

  function isComplete(draft) {
    if (draft.handshake_guess === '') return false
    if (draft.handshake_guess === 'true' && !draft.handshake_contestant_id) return false
    return draft.technical_first_id && draft.technical_last_id && draft.star_baker_id && draft.eliminated_id
  }

  async function handleSubmit(weekId, e) {
    e.preventDefault()
    const draft = drafts[weekId]
    if (!isComplete(draft)) return

    setStatus((s) => ({ ...s, [weekId]: 'saving' }))

    const payload = {
      week_id: weekId,
      user_id: user.id,
      handshake_guess: draft.handshake_guess === 'true',
      handshake_contestant_id: draft.handshake_guess === 'true' ? draft.handshake_contestant_id : null,
      technical_first_id: draft.technical_first_id,
      technical_last_id: draft.technical_last_id,
      star_baker_id: draft.star_baker_id,
      eliminated_id: draft.eliminated_id,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('picks').upsert(payload, { onConflict: 'week_id,user_id' })

    if (error) {
      setStatus((s) => ({ ...s, [weekId]: error.message }))
    } else {
      setStatus((s) => ({ ...s, [weekId]: 'saved' }))
      setSavedWeekIds((prev) => new Set(prev).add(weekId))
    }
  }

  if (loading) return <div className="page"><p>Loading…</p></div>

  if (!season) {
    return (
      <div className="page">
        <h1>My Picks</h1>
        <p className="empty-state">No active season yet. Ask the admin to set one up.</p>
      </div>
    )
  }

  if (openWeeks.length === 0) {
    return (
      <div className="page">
        <h1>My Picks</h1>
        <p className="page-subtitle">{season.name}</p>
        <p className="empty-state">No weeks are open for picks right now. Check back once the admin opens the next week.</p>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>My Picks</h1>
      <p className="page-subtitle">{season.name}</p>

      {openWeeks.map((week) => {
        const draft = drafts[week.id] ?? emptyPick
        const st = status[week.id]
        return (
          <form key={week.id} className="pick-card" onSubmit={(e) => handleSubmit(week.id, e)}>
            <div className="pick-card-header">
              <h2>Week {week.week_number}{week.label ? ` — ${week.label}` : ''}</h2>
              {savedWeekIds.has(week.id) && st !== 'saving' && <span className="badge badge-saved">Saved</span>}
            </div>

            <label>
              Will there be a Hollywood Handshake?
              <select
                value={draft.handshake_guess}
                onChange={(e) => updateDraft(week.id, 'handshake_guess', e.target.value)}
                required
              >
                <option value="" disabled>Select…</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>

            {draft.handshake_guess === 'true' && (
              <label>
                Who gets the handshake?
                <select
                  value={draft.handshake_contestant_id}
                  onChange={(e) => updateDraft(week.id, 'handshake_contestant_id', e.target.value)}
                  required
                >
                  <option value="" disabled>Select a baker…</option>
                  {contestants.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            )}

            <label>
              First in Technical
              <select
                value={draft.technical_first_id}
                onChange={(e) => updateDraft(week.id, 'technical_first_id', e.target.value)}
                required
              >
                <option value="" disabled>Select a baker…</option>
                {contestants.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>

            <label>
              Last in Technical
              <select
                value={draft.technical_last_id}
                onChange={(e) => updateDraft(week.id, 'technical_last_id', e.target.value)}
                required
              >
                <option value="" disabled>Select a baker…</option>
                {contestants.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>

            <label>
              Star Baker
              <select
                value={draft.star_baker_id}
                onChange={(e) => updateDraft(week.id, 'star_baker_id', e.target.value)}
                required
              >
                <option value="" disabled>Select a baker…</option>
                {contestants.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>

            <label>
              Eliminated
              <select
                value={draft.eliminated_id}
                onChange={(e) => updateDraft(week.id, 'eliminated_id', e.target.value)}
                required
              >
                <option value="" disabled>Select a baker…</option>
                {contestants.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>

            <button type="submit" className="btn btn-primary" disabled={!isComplete(draft) || st === 'saving'}>
              {st === 'saving' ? 'Saving…' : savedWeekIds.has(week.id) ? 'Update Picks' : 'Submit Picks'}
            </button>
            {st && st !== 'saving' && st !== 'saved' && <p className="auth-error">{st}</p>}
          </form>
        )
      })}
    </div>
  )
}
