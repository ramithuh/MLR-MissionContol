import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import Dashboard from './pages/Dashboard'
import ProjectView from './pages/ProjectView'
import LaunchJob from './pages/LaunchJob'
import ClusterVisualization from './pages/ClusterVisualization'
import CanvasView from './pages/CanvasView'

function AppContent() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen bg-dark-bg transition-colors duration-300">
      {/* Toast notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: 'var(--accent-green)',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#EF4444',
              secondary: '#fff',
            },
          },
        }}
      />
      {/* Navigation */}
      <nav className="bg-dark-card border-b border-dark-border transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/" className="flex items-center">
                <span className="text-xl font-bold text-dark-text-primary">
                  MLOps Mission Control
                </span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/"
                className="text-dark-text-secondary hover:text-accent-green px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Dashboard
              </Link>
              <Link
                to="/clusters"
                className="text-dark-text-secondary hover:text-accent-green px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                GPU Clusters
              </Link>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="ml-2 p-2 rounded-full text-dark-text-secondary hover:text-accent-green hover:bg-dark-card-hover transition-colors"
                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              >
                {theme === 'dark' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <Routes>
        <Route path="/" element={<main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8"><Dashboard /></main>} />
        <Route path="/clusters" element={<main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8"><ClusterVisualization /></main>} />
        <Route path="/project/:projectId" element={<main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8"><ProjectView /></main>} />
        <Route path="/project/:projectId/launch" element={<main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8"><LaunchJob /></main>} />
        <Route path="/project/:projectId/canvas" element={<CanvasView />} />
      </Routes>
    </div>
  )
}

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </Router>
  )
}

export default App
