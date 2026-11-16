import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import Layout from './components/Layout'
import PatientList from './pages/PatientList'
import PatientProfile from './pages/PatientProfile'
import ConclusionPage from './pages/Conclusion'
import SimilarCases from './pages/SimilarCases'
import Notifications from './pages/Notifications'
import Placeholder from './pages/Placeholder'
import { RoleProvider } from './role'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RoleProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/patients" replace />} />
            <Route path="/patients" element={<PatientList />} />
            <Route path="/patients/:id" element={<PatientProfile />} />
            <Route path="/patients/:id/conclusion" element={<ConclusionPage />} />
            <Route path="/patients/:id/similar" element={<SimilarCases />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings" element={<Placeholder title="Nastavenia" />} />
            <Route path="/help" element={<Placeholder title="Pomoc" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </RoleProvider>
  </StrictMode>,
)
