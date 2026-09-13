import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ContestantPicker from './ContestantPicker'

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
  const [weeks, setWeeks] = useState([])
  const [contestants, setContestants] = useState([])
  const [myPicks, setMyPicks] = useState([])
  const [myScores, setMyScores] = useState([])
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

    const [{ data: wks }, { data: cons }, { data: picks }, { data: scores }] = await Promise.all([
      supabase.from('weeks').select('*').eq('season_id', activeSeason.id).order('week_number'),
      supabase.from('contestants').select('*').eq('season_id', activeSeason.id).order('name'),
      supabase.from('picks').select('*').eq('user_id', user.id),
      supabase.from('week_scores').select('*').eq('user_id', user.id).eq('season_id', activeSeason.id),
    ])

    const openWeeks = (wks ?? []).filter((w) => w.status === 'open')
    setWeeks(wks ?? [])
    setContestants(cons ?? [])
    setMyPicks(picks ?? [])
    setMyScores(scores ?? [])

    const nextDrafts = {}
    const saved = new Set()
    for (const w of openWeeks) {
      const existing = (picks ?? []).find((p) => p.week_id === w.id)
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

  function contestantName(id) {
    return contestants.find((c) => c.id === id)?.name ?? '—'
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

  const activeContestants = contestants.filter((c) => c.is_active)
  const openWeeks = weeks.filter((w) => w.status === 'open')
  const lockedWeeks = weeks.filter((w) => w.status === 'locked')
  const completedWeeks = weeks.filter((w) => w.status === 'complete').slice().reverse()

  return (
    <div className="page">
      <h1>My Picks</h1>
      <p className="page-subtitle">{season.name}</p>

      {openWeeks.length === 0 && (
        <p className="empty-state">No weeks are open for picks right now. Check back once the admin opens the next week.</p>
      )}

      {openWeeks.map((week) => {
        const draft = drafts[week.id] ?? emptyPick
        const st = status[week.id]
        return (
          <form key={week.id} className="pick-card" onSubmit={(e) => handleSubmit(week.id, e)}>
            <div className="pick-card-header">
              <h2>Week {week.week_number}{week.label ? ` — ${week.label}` : ''}</h2>
              {savedWeekIds.has(week.id) && st !== 'saving' && <span className="badge badge-saved">Saved</span>}
            </div>

            <div>
              <span className="picker-label">Will there be a Hollywood Handshake?</span>
              <div className="yn-picker">
                <button
                  type="button"
                  className={draft.handshake_guess === 'true' ? 'yn-btn selected' : 'yn-btn'}
                  onClick={() => updateDraft(week.id, 'handshake_guess', draft.handshake_guess === 'true' ? '' : 'true')}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className={draft.handshake_guess === 'false' ? 'yn-btn selected' : 'yn-btn'}
                  onClick={() => updateDraft(week.id, 'handshake_guess', draft.handshake_guess === 'false' ? '' : 'false')}
                >
                  No
                </button>
              </div>
            </div>

            {draft.handshake_guess === 'true' && (
              <div>
                <span className="picker-label">Who gets the handshake?</span>
                <ContestantPicker
                  contestants={activeContestants}
                  value={draft.handshake_contestant_id}
                  onChange={(id) => updateDraft(week.id, 'handshake_contestant_id', id)}
                />
              </div>
            )}

            <div>
              <span className="picker-label">First in Technical</span>
              <ContestantPicker
                contestants={activeContestants}
                value={draft.technical_first_id}
                onChange={(id) => updateDraft(week.id, 'technical_first_id', id)}
              />
            </div>

            <div>
              <span className="picker-label">Last in Technical</span>
              <ContestantPicker
                contestants={activeContestants}
                value={draft.technical_last_id}
                onChange={(id) => updateDraft(week.id, 'technical_last_id', id)}
              />
            </div>

            <div>
              <span className="picker-label">Star Baker</span>
              <ContestantPicker
                contestants={activeContestants}
                value={draft.star_baker_id}
                onChange={(id) => updateDraft(week.id, 'star_baker_id', id)}
              />
            </div>

            <div>
              <span className="picker-label">Eliminated</span>
              <ContestantPicker
                contestants={activeContestants}
                value={draft.eliminated_id}
                onChange={(id) => updateDraft(week.id, 'eliminated_id', id)}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={!isComplete(draft) || st === 'saving'}>
              {st === 'saving' ? 'Saving…' : savedWeekIds.has(week.id) ? 'Update Picks' : 'Submit Picks'}
            </button>
            {st && st !== 'saving' && st !== 'saved' && <p className="auth-error">{st}</p>}
          </form>
        )
      })}

      {lockedWeeks.map((week) => {
        const pick = myPicks.find((p) => p.week_id === week.id)
        return (
          <div key={week.id} className="pick-card pick-card-readonly">
            <div className="pick-card-header">
              <h2>Week {week.week_number}{week.label ? ` — ${week.label}` : ''}</h2>
              <span className="badge badge-status-locked">locked — awaiting results</span>
            </div>
            {pick ? (
              <ul className="pick-summary">
                <li>Handshake: <strong>{pick.handshake_guess ? 'Yes' : 'No'}</strong>{pick.handshake_guess && ` — ${contestantName(pick.handshake_contestant_id)}`}</li>
                <li>First: <strong>{contestantName(pick.technical_first_id)}</strong></li>
                <li>Last: <strong>{contestantName(pick.technical_last_id)}</strong></li>
                <li>Star Baker: <strong>{contestantName(pick.star_baker_id)}</strong></li>
                <li>Eliminated: <strong>{contestantName(pick.eliminated_id)}</strong></li>
              </ul>
            ) : (
              <p className="hint">You didn't submit a pick this week.</p>
            )}
          </div>
        )
      })}

      {completedWeeks.length > 0 && (
        <>
          <h2 className="history-heading">Past Weeks</h2>
          {completedWeeks.map((week) => {
            const pick = myPicks.find((p) => p.week_id === week.id)
            const score = myScores.find((s) => s.week_id === week.id)
            return (
              <div key={week.id} className="pick-card pick-card-readonly">
                <div className="pick-card-header">
                  <h2>Week {week.week_number}{week.label ? ` — ${week.label}` : ''}</h2>
                  <span className={score && score.total_points < 0 ? 'badge badge-negative' : 'badge badge-saved'}>
                    {score ? `${score.total_points} pts` : 'no pick'}
                  </span>
                </div>
                {pick && score ? (
                  <ul className="pick-summary">
                    <li>Handshake: <strong>{pick.handshake_guess ? 'Yes' : 'No'}</strong>{pick.handshake_guess && ` — ${contestantName(pick.handshake_contestant_id)}`} ({score.handshake_yn_points + score.handshake_who_points >= 0 ? '+' : ''}{score.handshake_yn_points + score.handshake_who_points})</li>
                    <li>First: <strong>{contestantName(pick.technical_first_id)}</strong> ({score.first_points > 0 ? '+1' : '0'})</li>
                    <li>Last: <strong>{contestantName(pick.technical_last_id)}</strong> ({score.last_points > 0 ? '+1' : '0'})</li>
                    <li>Star Baker: <strong>{contestantName(pick.star_baker_id)}</strong> ({score.star_baker_points > 0 ? '+1' : '0'})</li>
                    <li>Eliminated: <strong>{contestantName(pick.eliminated_id)}</strong> ({score.eliminated_points > 0 ? '+1' : '0'})</li>
                  </ul>
                ) : (
                  <p className="hint">You didn't submit a pick this week — 0 points.</p>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
