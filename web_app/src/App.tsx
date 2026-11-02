import { Route, Routes } from 'react-router'
import Layout from './components/layout/Layout'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import FaqPage from './pages/FaqPage'
import HomePage from './pages/HomePage'
import HowItWorksPage from './pages/HowItWorksPage'
import NotFoundPage from './pages/NotFoundPage'
import PredictPage from './pages/PredictPage'
import ResultsPage from './pages/ResultsPage'
import AnalysisProvider from './state/AnalysisProvider'

/** Providers and routes: the router is supplied by main.tsx (BrowserRouter) or by tests (MemoryRouter). */
export default function App() {
  return (
    <AnalysisProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="how-it-works" element={<HowItWorksPage />} />
          <Route path="predict" element={<PredictPage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="faq" element={<FaqPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AnalysisProvider>
  )
}
