import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'

const MAX_AVATAR_BYTES = 3 * 1024 * 1024

export default function Home() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [season, setSeason] = useState(null)
  const [contestants, setContestants] = useState([])
  const [players, setPlayers] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: seasons } = await supabase
      .from('seasons')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)

    const activeSeason = seasons?.[0] ?? null
    setSeason(activeSeason)

    const [{ data: cons }, { data: profiles }] = await Promise.all([
      activeSeason
        ? supabase.from('contestants').select('*').eq('season_id', activeSeason.id).order('name')
        : Promise.resolve({ data: [] }),
      supabase.from('profiles').select('*').order('created_at', { ascending: true }),
    ])

    setContestants(cons ?? [])
    setPlayers(profiles ?? [])
    setLoading(false)
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose an image file.')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setUploadError('Image is too large (max 3MB).')
      return
    }

    setUploading(true)
    setUploadError('')

    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, cacheControl: '3600' })

    if (uploadErr) {
      setUploadError(uploadErr.message)
      setUploading(false)
      return
    }

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id)

    if (updateErr) {
      setUploadError(updateErr.message)
    } else {
      await load()
    }
    setUploading(false)
  }

  if (loading) return <div className="page"><p>Loading…</p></div>

  return (
    <div className="page">
      <h1>🍰 Bake Off Fantasy</h1>
      <p className="page-subtitle">{season ? season.name : 'No active season yet'}</p>

      <section className="home-section">
        <h2>How to Play</h2>
        <p>
          Each week, before results are revealed, submit your predictions for that episode:
        </p>
        <ul className="rules-list">
          <li>Will there be a <strong>Hollywood Handshake</strong>? (Yes / No)</li>
          <li>If yes — <strong>who</strong> gets it?</li>
          <li><strong>First</strong> in the Technical Challenge</li>
          <li><strong>Last</strong> in the Technical Challenge</li>
          <li><strong>Star Baker</strong></li>
          <li>Who's <strong>eliminated</strong></li>
        </ul>
        <p>Once the admin submits the real results, your week is scored:</p>
        <ul className="rules-list">
          <li><strong>+1</strong> for each correct pick — first, last, star baker, eliminated</li>
          <li><strong>Handshake Yes/No:</strong> +1 if you call it right, <strong>&minus;1</strong> if you don't</li>
          <li><strong>Handshake Who:</strong> an extra +1, but only if you guessed "Yes" <em>and</em> named the right baker — guessing "No" skips this pick entirely (no bonus, no penalty)</li>
        </ul>
        <p className="hint">Max 6 points in a handshake week, 5 points in a no-handshake week.</p>
      </section>

      <section className="home-section">
        <div className="section-header-row">
          <h2>This Series' Bakers</h2>
          <a
            className="external-link"
            href="https://thegreatbritishbakeoff.co.uk/meet-the-class-of-2026/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Meet the Contestants ↗
          </a>
        </div>
        {contestants.length === 0 ? (
          <p className="empty-state">No bakers added yet.</p>
        ) : (
          <div className="baker-grid">
            {contestants.map((c) => (
              <div key={c.id} className={c.is_active ? 'baker-card' : 'baker-card eliminated'}>
                <Avatar name={c.name} photoUrl={c.photo_url} size={96} />
                <span className="baker-name">{c.name}</span>
                {!c.is_active && <span className="badge badge-status-complete">out</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="home-section">
        <h2>Fantasy Players</h2>
        {players.length === 0 ? (
          <p className="empty-state">No one has signed up yet.</p>
        ) : (
          <div className="player-grid">
            {players.map((p) => {
              const isMe = p.id === user.id
              return (
                <div key={p.id} className="player-card">
                  <div
                    className={isMe ? 'avatar-wrap avatar-wrap-editable' : 'avatar-wrap'}
                    onClick={isMe ? () => fileInputRef.current?.click() : undefined}
                    title={isMe ? 'Change your photo' : undefined}
                  >
                    <Avatar name={p.display_name} photoUrl={p.avatar_url} size={96} />
                    {isMe && <span className="avatar-edit-badge">{uploading ? '…' : '✎'}</span>}
                  </div>
                  <span className="baker-name">{p.display_name}</span>
                  {p.is_admin && <span className="badge badge-saved">admin</span>}
                </div>
              )
            })}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleAvatarChange}
        />
        {uploadError && <p className="auth-error">{uploadError}</p>}
        <p className="hint">Click your own avatar above to upload a photo.</p>
      </section>
    </div>
  )
}
