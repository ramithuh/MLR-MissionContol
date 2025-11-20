import { useEffect, useState } from 'react'
import { getJobLogs } from '../services/api'

function LogsModal({ jobId, jobName, onClose }) {
  const [logs, setLogs] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchLogs()
  }, [jobId])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getJobLogs(jobId)
      setLogs(data.logs || 'No logs available')
    } catch (err) {
      console.error('Error fetching logs:', err)
      setError(err.response?.data?.detail || 'Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-card rounded-lg border border-dark-border max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-dark-border">
          <h2 className="text-xl font-bold text-dark-text-primary">
            Job Logs: {jobName}
          </h2>
          <button
            onClick={onClose}
            className="text-dark-text-secondary hover:text-dark-text-primary transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-dark-text-secondary">Loading logs...</div>
            </div>
          ) : error ? (
            <div className="bg-red-900/20 border border-red-700/30 rounded-md p-4">
              <div className="text-red-400 font-medium mb-2">Error Loading Logs</div>
              <div className="text-dark-text-secondary">{error}</div>
            </div>
          ) : (
            <pre className="bg-dark-bg rounded-md p-4 text-sm text-dark-text-primary font-mono overflow-x-auto whitespace-pre-wrap break-words">
              {logs}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-dark-border">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-4 py-2 bg-dark-bg hover:bg-dark-card-hover text-dark-text-primary rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Refresh
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-accent-green hover:bg-accent-green-hover text-white rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default LogsModal
