import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const emptyResult = {
  handshake_occurred: '',
  handshake_contestant_id: '',
  technical_first_id: '',
  technical_last_id: '',
  star_baker_id: '',
  eliminated_id: '',
}

export default function ResultsForm({ season }) {
  const [weeks, setWeeks] = useState([])
  const [contestants, setContestants] = useState([])
  const [selectedWeekId, setSelectedWeekId] = useState('')
  const [form, setForm] = useState(emptyResult)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season.id])

  async function load() {
    const [{ data: wks }, { data: cons }] = await Promise.all([
      supabase.from('weeks').select('*').eq('season_id', season.id).order('week_number'),
      supabase.from('contestants').select('*').eq('season_id', season.id).order('name'),
    ])
    setWeeks(wks ?? [])
    setContestants(cons ?? [])
    const firstScorable = (wks ?? []).find((w) => w.status !== 'complete')
    setSelectedWeekId(firstScorable?.id ?? '')
  }

  function update(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'handshake_occurred' && value !== 'true' ? { handshake_contestant_id: '' } : {}),
    }))
  }

  function isComplete() {
    if (form.handshake_occurred === '') return false
    if (form.handshake_occurred === 'true' && !form.handshake_contestant_id) return false
    return form.technical_first_id && form.technical_last_id && form.star_baker_id && form.eliminated_id
  }

  async function submit(e) {
    e.preventDefault()
    if (!selectedWeekId || !isComplete()) return
    setBusy(true)
    setError('')
    setSuccess('')

    const { error } = await supabase.from('results').insert({
      week_id: selectedWeekId,
      handshake_occurred: form.handshake_occurred === 'true',
      handshake_contestant_id: form.handshake_occurred === 'true' ? form.handshake_contestant_id : null,
      technical_first_id: form.technical_first_id,
      technical_last_id: form.technical_last_id,
      star_baker_id: form.star_baker_id,
      eliminated_id: form.eliminated_id,
    })

    if (error) {
      setError(error.message)
    } else {
      setSuccess('Results submitted — the week is now scored and the eliminated baker is marked out.')
      setForm(emptyResult)
      load()
    }
    setBusy(false)
  }

  const scorableWeeks = weeks.filter((w) => w.status !== 'complete')
  const completedWeeks = weeks.filter((w) => w.status === 'complete')
  const selectedWeek = weeks.find((w) => w.id === selectedWeekId)

  return (
    <div>
      <label>
        Week to score
        <select value={selectedWeekId} onChange={(e) => { setSelectedWeekId(e.target.value); setSuccess('') }}>
          <option value="" disabled>Select a week…</option>
          {scorableWeeks.map((w) => (
            <option key={w.id} value={w.id}>Week {w.week_number}{w.label ? ` — ${w.label}` : ''}</option>
          ))}
        </select>
      </label>

      {scorableWeeks.length === 0 && (
        <p className="empty-state">Every week has been scored. Open a new week in the Weeks tab to continue.</p>
      )}

      {selectedWeek && (
        <form className="pick-card" onSubmit={submit}>
          <div className="pick-card-header">
            <h2>Week {selectedWeek.week_number}{selectedWeek.label ? ` — ${selectedWeek.label}` : ''}</h2>
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
            <label>
              Who got the handshake?
              <select value={form.handshake_contestant_id} onChange={(e) => update('handshake_contestant_id', e.target.value)} required>
                <option value="" disabled>Select a baker…</option>
                {contestants.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          )}

          <label>
            First in Technical
            <select value={form.technical_first_id} onChange={(e) => update('technical_first_id', e.target.value)} required>
              <option value="" disabled>Select a baker…</option>
              {contestants.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label>
            Last in Technical
            <select value={form.technical_last_id} onChange={(e) => update('technical_last_id', e.target.value)} required>
              <option value="" disabled>Select a baker…</option>
              {contestants.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label>
            Star Baker
            <select value={form.star_baker_id} onChange={(e) => update('star_baker_id', e.target.value)} required>
              <option value="" disabled>Select a baker…</option>
              {contestants.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label>
            Eliminated
            <select value={form.eliminated_id} onChange={(e) => update('eliminated_id', e.target.value)} required>
              <option value="" disabled>Select a baker…</option>
              {contestants.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          {error && <p className="auth-error">{error}</p>}
          {success && <p className="auth-info">{success}</p>}

          <button type="submit" className="btn btn-primary" disabled={!isComplete() || busy}>
            {busy ? 'Submitting…' : 'Submit Results & Score Week'}
          </button>
        </form>
      )}

      {completedWeeks.length > 0 && (
        <>
          <h3 className="admin-subheading">Already Scored</h3>
          <ul className="admin-list">
            {completedWeeks.map((w) => (
              <li key={w.id} className="admin-list-item">
                <span>Week {w.week_number}{w.label ? ` — ${w.label}` : ''}</span>
                <span className="badge badge-status-complete">complete</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
