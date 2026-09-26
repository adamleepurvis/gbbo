import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import ContestantPicker from '../ContestantPicker'

const emptyForm = {
  handshake_occurred: '',
  handshake_contestant_ids: [],
  technical_first_id: '',
  technical_last_id: '',
  star_baker_id: '',
  eliminated_ids: [],
  no_elimination: false,
}

export default function ResultsForm({ season }) {
  const [weeks, setWeeks] = useState([])
  const [contestants, setContestants] = useState([])
  const [resultsByWeek, setResultsByWeek] = useState({})
  const [selectedWeekId, setSelectedWeekId] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season.id])

  useEffect(() => {
    const week = weeks.find((w) => w.id === selectedWeekId)
    if (!week) return
    if (week.status === 'complete' && resultsByWeek[week.id]) {
      const r = resultsByWeek[week.id]
      setForm({
        handshake_occurred: String(r.handshake_occurred),
        handshake_contestant_ids: r.handshake_contestant_ids ?? [],
        technical_first_id: r.technical_first_id,
        technical_last_id: r.technical_last_id,
        star_baker_id: r.star_baker_id,
        eliminated_ids: r.eliminated_ids ?? [],
        no_elimination: (r.eliminated_ids ?? []).length === 0,
      })
      setIsEditing(true)
    } else {
      setForm(emptyForm)
      setIsEditing(false)
    }
    setSuccess('')
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeekId])

  async function load() {
    const [{ data: wks }, { data: cons }, { data: res }] = await Promise.all([
      supabase.from('weeks').select('*').eq('season_id', season.id).order('week_number'),
      supabase.from('contestants').select('*').eq('season_id', season.id).order('name'),
      supabase.from('results').select('*, weeks!inner(season_id)').eq('weeks.season_id', season.id),
    ])
    setWeeks(wks ?? [])
    setContestants(cons ?? [])
    const map = {}
    for (const r of res ?? []) map[r.week_id] = r
    setResultsByWeek(map)
    if (!selectedWeekId) {
      const firstScorable = (wks ?? []).find((w) => w.status !== 'complete')
      setSelectedWeekId(firstScorable?.id ?? '')
    }
  }

  function update(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'handshake_occurred' && value !== 'true' ? { handshake_contestant_ids: [] } : {}),
      ...(field === 'no_elimination' && value ? { eliminated_ids: [] } : {}),
    }))
  }

  function isComplete() {
    if (form.handshake_occurred === '') return false
    if (form.handshake_occurred === 'true' && form.handshake_contestant_ids.length === 0) return false
    if (!form.technical_first_id || !form.technical_last_id || !form.star_baker_id) return false
    return form.no_elimination || form.eliminated_ids.length > 0
  }

  async function submit(e) {
    e.preventDefault()
    if (!selectedWeekId || !isComplete()) return
    setBusy(true)
    setError('')
    setSuccess('')

    const payload = {
      handshake_occurred: form.handshake_occurred === 'true',
      handshake_contestant_ids: form.handshake_occurred === 'true' ? form.handshake_contestant_ids : [],
      technical_first_id: form.technical_first_id,
      technical_last_id: form.technical_last_id,
      star_baker_id: form.star_baker_id,
      eliminated_ids: form.eliminated_ids,
    }

    const { error } = isEditing
      ? await supabase.from('results').update(payload).eq('week_id', selectedWeekId)
      : await supabase.from('results').insert({ week_id: selectedWeekId, ...payload })

    if (error) {
      setError(error.message)
    } else {
      setSuccess(isEditing ? 'Results updated.' : 'Results submitted — the week is now scored and eliminated baker(s) marked out.')
      load()
    }
    setBusy(false)
  }

  const scorableWeeks = weeks.filter((w) => w.status !== 'complete')
  const completedWeeks = weeks.filter((w) => w.status === 'complete')
  const selectedWeek = weeks.find((w) => w.id === selectedWeekId)
  const pickableContestants = isEditing ? contestants : contestants.filter((c) => c.is_active)

  return (
    <div>
      <label>
        Week to score
        <select value={selectedWeekId} onChange={(e) => setSelectedWeekId(e.target.value)}>
          <option value="" disabled>Select a week…</option>
          {scorableWeeks.map((w) => (
            <option key={w.id} value={w.id}>Week {w.week_number}{w.label ? ` — ${w.label}` : ''}</option>
          ))}
          {completedWeeks.map((w) => (
            <option key={w.id} value={w.id}>Week {w.week_number}{w.label ? ` — ${w.label}` : ''} (edit)</option>
          ))}
        </select>
      </label>

      {scorableWeeks.length === 0 && completedWeeks.length === 0 && (
        <p className="empty-state">No weeks yet — open one in the Weeks tab first.</p>
      )}

      {selectedWeek && (
        <form className="pick-card" onSubmit={submit}>
          <div className="pick-card-header">
            <h2>Week {selectedWeek.week_number}{selectedWeek.label ? ` — ${selectedWeek.label}` : ''}</h2>
            {isEditing && <span className="badge badge-status-locked">editing</span>}
          </div>

          <label>
            Did a Hollywood Handshake happen?
            <select value={form.handshake_occurred} onChange={(e) => update('handshake_occurred', e.target.value)} required>
              <option value="" disabled>Select…</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>

          {form.handshake_occurred === 'true' && (
            <div>
              <span className="picker-label">Who got the handshake? (tap all that apply)</span>
              <ContestantPicker
                contestants={pickableContestants}
                value={form.handshake_contestant_ids}
                onChange={(ids) => update('handshake_contestant_ids', ids)}
                multiple
              />
            </div>
          )}

          <div>
            <span className="picker-label">First in Technical</span>
            <ContestantPicker
              contestants={pickableContestants}
              value={form.technical_first_id}
              onChange={(id) => update('technical_first_id', id)}
            />
          </div>

          <div>
            <span className="picker-label">Last in Technical</span>
            <ContestantPicker
              contestants={pickableContestants}
              value={form.technical_last_id}
              onChange={(id) => update('technical_last_id', id)}
            />
          </div>

          <div>
            <span className="picker-label">Star Baker</span>
            <ContestantPicker
              contestants={pickableContestants}
              value={form.star_baker_id}
              onChange={(id) => update('star_baker_id', id)}
            />
          </div>

          <div>
            <span className="picker-label">Eliminated (tap all that apply)</span>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.no_elimination}
                onChange={(e) => update('no_elimination', e.target.checked)}
              />
              No one was eliminated this week
            </label>
            {!form.no_elimination && (
              <ContestantPicker
                contestants={pickableContestants}
                value={form.eliminated_ids}
                onChange={(ids) => update('eliminated_ids', ids)}
                multiple
              />
            )}
          </div>

          {error && <p className="auth-error">{error}</p>}
          {success && <p className="auth-info">{success}</p>}

          <button type="submit" className="btn btn-primary" disabled={!isComplete() || busy}>
            {busy ? 'Saving…' : isEditing ? 'Update Results' : 'Submit Results & Score Week'}
          </button>
        </form>
      )}

      {completedWeeks.length > 0 && (
        <>
          <h3 className="admin-subheading">Already Scored</h3>
          <ul className="admin-list">
            {completedWeeks.map((w) => (
              <li key={w.id} className="admin-list-item">
                <span className="flex-name">Week {w.week_number}{w.label ? ` — ${w.label}` : ''}</span>
                <span className="badge badge-status-complete">complete</span>
                <button className="btn btn-ghost" onClick={() => setSelectedWeekId(w.id)}>Edit</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
