import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// Vercel Cron hits this on a schedule (see vercel.json). Protected by
// CRON_SECRET so a random internet request can't trigger a mass email.
export default async function handler(req, res) {
  const auth = req.headers.authorization
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { db: { schema: 'bakeoff' } }
  )
  const resend = new Resend(process.env.RESEND_API_KEY)

  const host = req.headers['x-forwarded-host'] || req.headers.host
  const picksUrl = `https://${host}/picks`

  const { data: seasons, error: seasonsErr } = await supabase
    .from('seasons')
    .select('id')
    .eq('is_active', true)

  if (seasonsErr) return res.status(500).json({ error: seasonsErr.message })
  if (!seasons?.length) return res.status(200).json({ sent: 0, note: 'no active season' })

  const { data: weeks, error: weeksErr } = await supabase
    .from('weeks')
    .select('id, week_number, label')
    .in('season_id', seasons.map((s) => s.id))
    .eq('status', 'open')

  if (weeksErr) return res.status(500).json({ error: weeksErr.message })
  if (!weeks?.length) return res.status(200).json({ sent: 0, note: 'no open weeks' })

  const { data: players, error: playersErr } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .eq('email_reminders_enabled', true)

  if (playersErr) return res.status(500).json({ error: playersErr.message })

  let sent = 0
  const errors = []

  for (const week of weeks) {
    const [{ data: picks }, { data: reminded }] = await Promise.all([
      supabase.from('picks').select('user_id').eq('week_id', week.id),
      supabase.from('reminder_log').select('user_id').eq('week_id', week.id),
    ])

    const alreadyHandled = new Set([
      ...(picks ?? []).map((p) => p.user_id),
      ...(reminded ?? []).map((r) => r.user_id),
    ])

    const toRemind = (players ?? []).filter((p) => !alreadyHandled.has(p.id))

    for (const player of toRemind) {
      const { error: sendErr } = await resend.emails.send({
        from: 'Bake Off Fantasy <onboarding@resend.dev>',
        to: player.email,
        subject: `Pick reminder: Week ${week.week_number}${week.label ? ` — ${week.label}` : ''}`,
        html: `
          <p>Hi ${player.display_name},</p>
          <p>You haven't submitted your picks yet for Week ${week.week_number}${week.label ? ` (${week.label})` : ''}.</p>
          <p><a href="${picksUrl}">Make your picks →</a></p>
        `,
      })

      if (sendErr) {
        errors.push({ user: player.email, week: week.week_number, error: sendErr.message })
        continue
      }

      await supabase.from('reminder_log').insert({ week_id: week.id, user_id: player.id })
      sent++
    }
  }

  return res.status(200).json({ sent, errors })
}
