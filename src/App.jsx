import { Routes, Route } from 'react-router-dom'
import TitleBar from './components/TitleBar.jsx'
import Sidebar from './components/Sidebar.jsx'
import ToastContainer from './components/ToastContainer.jsx'
import HomePage from './pages/HomePage.jsx'
import StandardsPage from './pages/StandardsPage.jsx'
import OrganizePage from './pages/OrganizePage.jsx'
import CheckPage from './pages/CheckPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import { AppProvider } from './context/AppContext.jsx'

export default function App() {
  return (
    <AppProvider>
      <div className="app-layout">
        <TitleBar />
        <div className="app-body">
          <Sidebar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/standards" element={<StandardsPage />} />
              <Route path="/organize" element={<OrganizePage />} />
              <Route path="/check" element={<CheckPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
        <ToastContainer />
      </div>
    </AppProvider>
  )
}
