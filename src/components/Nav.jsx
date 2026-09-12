import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Nav() {
  const { profile, isAdmin, signOut } = useAuth()

  return (
    <nav className="nav">
      <div className="nav-brand">🍰 Bake Off Fantasy</div>
      <div className="nav-links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          Scoreboard
        </NavLink>
        <NavLink to="/picks" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          My Picks
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Admin
          </NavLink>
        )}
      </div>
      <div className="nav-user">
        <span className="nav-name">{profile?.display_name}</span>
        <button className="btn btn-ghost" onClick={signOut}>Sign out</button>
      </div>
    </nav>
  )
}
