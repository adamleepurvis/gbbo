import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import SeasonManager from './SeasonManager'
import ContestantManager from './ContestantManager'
import WeekManager from './WeekManager'
import ResultsForm from './ResultsForm'

const TABS = ['Seasons', 'Contestants', 'Weeks', 'Results']

export default function AdminPage() {
  const [tab, setTab] = useState('Seasons')
  const [seasons, setSeasons] = useState([])
  const [selectedSeasonId, setSelectedSeasonId] = useState('')

  useEffect(() => {
    loadSeasons()
  }, [])

  async function loadSeasons() {
    const { data } = await supabase.from('seasons').select('*').order('created_at', { ascending: false })
    setSeasons(data ?? [])
    if (!selectedSeasonId && data?.length) {
      const active = data.find((s) => s.is_active) ?? data[0]
      setSelectedSeasonId(active.id)
    }
  }

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId) ?? null

  return (
    <div className="page">
      <h1>Admin</h1>

      <div className="admin-season-picker">
        <label>
          Season
          <select value={selectedSeasonId} onChange={(e) => setSelectedSeasonId(e.target.value)}>
            {seasons.length === 0 && <option value="">No seasons yet</option>}
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.is_active ? ' (active)' : ''}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="admin-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={t === tab ? 'admin-tab active' : 'admin-tab'}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="admin-tab-content">
        {tab === 'Seasons' && <SeasonManager seasons={seasons} onChange={loadSeasons} />}
        {tab === 'Contestants' && selectedSeason && (
          <ContestantManager season={selectedSeason} />
        )}
        {tab === 'Weeks' && selectedSeason && (
          <WeekManager season={selectedSeason} />
        )}
        {tab === 'Results' && selectedSeason && (
          <ResultsForm season={selectedSeason} />
        )}
        {tab !== 'Seasons' && !selectedSeason && (
          <p className="empty-state">Create a season first.</p>
        )}
      </div>
    </div>
  )
}
