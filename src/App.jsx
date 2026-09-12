import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './components/Login'
import Nav from './components/Nav'
import Scoreboard from './components/Scoreboard'
import PicksForm from './components/PicksForm'
import AdminPage from './components/admin/AdminPage'

function App() {
  const { user, isAdmin, loading } = useAuth()

  if (loading) {
    return <div className="app-loading">Loading…</div>
  }

  if (!user) {
    return <Login />
  }

  return (
    <div className="app">
      <Nav />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Scoreboard />} />
          <Route path="/picks" element={<PicksForm />} />
          <Route
            path="/admin"
            element={isAdmin ? <AdminPage /> : <Navigate to="/" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
