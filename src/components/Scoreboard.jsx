import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Scoreboard() {
  const [loading, setLoading] = useState(true)
  const [season, setSeason] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [weeks, setWeeks] = useState([])
  const [weekScores, setWeekScores] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    load()

    const channel = supabase
      .channel('scoreboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weeks' }, load)
      .subscribe()

    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    const { data: seasons, error: seasonErr } = await supabase
      .from('seasons')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)

    if (seasonErr) {
      setError(seasonErr.message)
      setLoading(false)
      return
    }

    const activeSeason = seasons?.[0] ?? null
    setSeason(activeSeason)

    if (!activeSeason) {
      setLoading(false)
      return
    }

    const [{ data: lb, error: lbErr }, { data: wks }, { data: ws }] = await Promise.all([
      supabase.from('leaderboard').select('*').eq('season_id', activeSeason.id).order('total_points', { ascending: false }),
      supabase.from('weeks').select('*').eq('season_id', activeSeason.id).order('week_number', { ascending: true }),
      supabase.from('week_scores').select('*').eq('season_id', activeSeason.id),
    ])

    if (lbErr) setError(lbErr.message)
    setLeaderboard(lb ?? [])
    setWeeks(wks ?? [])
    setWeekScores(ws ?? [])
    setLoading(false)
  }

  if (loading) return <div className="page"><p>Loading scoreboard…</p></div>

  if (!season) {
    return (
      <div className="page">
        <h1>Scoreboard</h1>
        <p className="empty-state">No active season yet. Ask the admin to set one up.</p>
      </div>
    )
  }

  const completedWeeks = weeks.filter((w) => w.status === 'complete')

  function scoreFor(userId, weekId) {
    const row = weekScores.find((s) => s.user_id === userId && s.week_id === weekId)
    return row ? row.total_points : null
  }

  return (
    <div className="page">
      <h1>Scoreboard</h1>
      <p className="page-subtitle">{season.name}</p>

      {leaderboard.length === 0 ? (
        <p className="empty-state">No scores yet — picks and results will show up here once the first week is scored.</p>
      ) : (
        <div className="table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Total</th>
                {completedWeeks.map((w) => (
                  <th key={w.id} title={w.label}>W{w.week_number}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row, i) => (
                <tr key={row.user_id}>
                  <td className="rank">{i + 1}</td>
                  <td className="player-name">{row.display_name}</td>
                  <td className="total-points">{row.total_points}</td>
                  {completedWeeks.map((w) => {
                    const pts = scoreFor(row.user_id, w.id)
                    return (
                      <td key={w.id} className={pts != null && pts < 0 ? 'neg' : pts > 0 ? 'pos' : ''}>
                        {pts == null ? '—' : pts}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="auth-error">{error}</p>}
    </div>
  )
}
