import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function formatSigned(n) {
  return n > 0 ? `+${n}` : `${n}`
}

function catClass(points) {
  if (points == null) return ''
  return points > 0 ? 'pos' : 'neg'
}

export default function Scoreboard() {
  const [loading, setLoading] = useState(true)
  const [season, setSeason] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [weeks, setWeeks] = useState([])
  const [weekScores, setWeekScores] = useState([])
  const [picks, setPicks] = useState([])
  const [resultsByWeek, setResultsByWeek] = useState({})
  const [contestants, setContestants] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    load()

    const channel = supabase
      .channel('scoreboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weeks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'picks' }, load)
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

    const [{ data: lb, error: lbErr }, { data: wks }, { data: ws }, { data: cons }] = await Promise.all([
      supabase.from('leaderboard').select('*').eq('season_id', activeSeason.id).order('total_points', { ascending: false }),
      supabase.from('weeks').select('*').eq('season_id', activeSeason.id).order('week_number', { ascending: true }),
      supabase.from('week_scores').select('*').eq('season_id', activeSeason.id),
      supabase.from('contestants').select('*').eq('season_id', activeSeason.id),
    ])

    if (lbErr) setError(lbErr.message)
    setLeaderboard(lb ?? [])
    setWeeks(wks ?? [])
    setWeekScores(ws ?? [])
    setContestants(cons ?? [])

    const revealedWeekIds = (wks ?? []).filter((w) => w.status === 'locked' || w.status === 'complete').map((w) => w.id)

    if (revealedWeekIds.length > 0) {
      const [{ data: pk }, { data: res }] = await Promise.all([
        supabase.from('picks').select('*').in('week_id', revealedWeekIds),
        supabase.from('results').select('*').in('week_id', revealedWeekIds),
      ])
      setPicks(pk ?? [])
      const map = {}
      for (const r of res ?? []) map[r.week_id] = r
      setResultsByWeek(map)
    } else {
      setPicks([])
      setResultsByWeek({})
    }

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
  const revealedWeeks = weeks.filter((w) => w.status === 'locked' || w.status === 'complete').slice().reverse()

  function scoreFor(userId, weekId) {
    const row = weekScores.find((s) => s.user_id === userId && s.week_id === weekId)
    return row ? row.total_points : null
  }

  function contestantName(id) {
    return contestants.find((c) => c.id === id)?.name ?? '—'
  }

  function contestantNames(ids) {
    if (!ids || ids.length === 0) return '—'
    return ids.map(contestantName).join(', ')
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

      {revealedWeeks.length > 0 && (
        <>
          <h2 className="history-heading">Everyone's Picks</h2>
          {revealedWeeks.map((week) => {
            const result = resultsByWeek[week.id]
            return (
              <div key={week.id} className="pick-card pick-card-readonly">
                <div className="pick-card-header">
                  <h2>Week {week.week_number}{week.label ? ` — ${week.label}` : ''}</h2>
                  {!result && <span className="badge badge-status-locked">awaiting results</span>}
                </div>
                <div className="table-wrap">
                  <table className="leaderboard-table picks-compare-table">
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Handshake</th>
                        <th>First</th>
                        <th>Last</th>
                        <th>Star Baker</th>
                        <th>Eliminated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result && (
                        <tr className="correct-answer-row">
                          <td className="player-name">Correct Answer</td>
                          <td>{result.handshake_occurred ? `Yes — ${contestantNames(result.handshake_contestant_ids)}` : 'No'}</td>
                          <td>{contestantName(result.technical_first_id)}</td>
                          <td>{contestantName(result.technical_last_id)}</td>
                          <td>{contestantName(result.star_baker_id)}</td>
                          <td>{result.eliminated_ids?.length ? contestantNames(result.eliminated_ids) : 'No one'}</td>
                        </tr>
                      )}
                      {leaderboard.map((player) => {
                        const pick = picks.find((p) => p.week_id === week.id && p.user_id === player.user_id)
                        const scoreRow = weekScores.find((s) => s.week_id === week.id && s.user_id === player.user_id)
                        if (!pick) {
                          return (
                            <tr key={player.user_id}>
                              <td className="player-name">{player.display_name}</td>
                              <td colSpan={5} className="hint">No pick submitted</td>
                            </tr>
                          )
                        }
                        return (
                          <tr key={player.user_id}>
                            <td className="player-name">{player.display_name}</td>
                            <td className={catClass(scoreRow ? scoreRow.handshake_yn_points : null)}>
                              {pick.handshake_guess ? `Yes — ${contestantNames(pick.handshake_contestant_ids)}` : 'No'}
                            </td>
                            <td className={catClass(scoreRow ? scoreRow.first_points : null)}>{contestantName(pick.technical_first_id)}</td>
                            <td className={catClass(scoreRow ? scoreRow.last_points : null)}>{contestantName(pick.technical_last_id)}</td>
                            <td className={catClass(scoreRow ? scoreRow.star_baker_points : null)}>{contestantName(pick.star_baker_id)}</td>
                            <td className={catClass(scoreRow ? scoreRow.eliminated_points : null)}>{contestantNames(pick.eliminated_ids)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {result && (
                  <p className="hint">Total that week: {leaderboard.map((p) => {
                    const s = weekScores.find((sc) => sc.week_id === week.id && sc.user_id === p.user_id)
                    return s ? `${p.display_name} ${formatSigned(s.total_points)}` : null
                  }).filter(Boolean).join(' · ')}</p>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
