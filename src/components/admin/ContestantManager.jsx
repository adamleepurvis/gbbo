import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Avatar from '../Avatar'

const MAX_PHOTO_BYTES = 3 * 1024 * 1024

export default function ContestantManager({ season }) {
  const [contestants, setContestants] = useState([])
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [uploadingId, setUploadingId] = useState(null)
  const pendingContestantId = useRef(null)
  const fileInputRef = useRef(null)

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

  function triggerPhotoUpload(contestantId) {
    pendingContestantId.current = contestantId
    fileInputRef.current?.click()
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    const contestantId = pendingContestantId.current
    e.target.value = ''
    if (!file || !contestantId) return

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError('Image is too large (max 3MB).')
      return
    }

    setError('')
    setUploadingId(contestantId)

    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${contestantId}/photo.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('contestant-photos')
      .upload(path, file, { upsert: true, cacheControl: '3600' })

    if (uploadErr) {
      setError(uploadErr.message)
      setUploadingId(null)
      return
    }

    const { data: publicUrlData } = supabase.storage.from('contestant-photos').getPublicUrl(path)
    const photoUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`

    const { error: updateErr } = await supabase
      .from('contestants')
      .update({ photo_url: photoUrl })
      .eq('id', contestantId)

    if (updateErr) setError(updateErr.message)
    else await load()
    setUploadingId(null)
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
            <div
              className="avatar-wrap avatar-wrap-editable"
              onClick={() => triggerPhotoUpload(c.id)}
              title="Upload a photo"
            >
              <Avatar name={c.name} photoUrl={c.photo_url} size={36} />
              <span className="avatar-edit-badge">{uploadingId === c.id ? '…' : '✎'}</span>
            </div>
            <span className={c.is_active ? 'flex-name' : 'flex-name strikethrough'}>{c.name}</span>
            <button className="btn btn-ghost" onClick={() => toggleActive(c)}>
              {c.is_active ? 'Mark Eliminated' : 'Mark Active'}
            </button>
          </li>
        ))}
        {contestants.length === 0 && <p className="empty-state">No bakers yet for {season.name} — add one above.</p>}
      </ul>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handlePhotoChange}
      />
      <p className="hint">Click a baker's avatar to upload their photo.</p>
    </div>
  )
}
