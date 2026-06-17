import { Routes, Route } from 'react-router-dom'
import TripFlow from './pages/TripFlow.jsx'
import ToastContainer from './components/ToastContainer.jsx'
import { AppProvider } from './context/AppContext.jsx'

export default function App() {
  return (
    <AppProvider>
      <div className="app-layout">
        <div className="app-container">
          <main className="main-content">
            <Routes>
              <Route path="/" element={<TripFlow />} />
            </Routes>
          </main>
          <ToastContainer />
        </div>
      </div>
    </AppProvider>
  )
}
