import { useState, useRef, useEffect } from 'react'

/**
 * Dropdown menu for job actions
 */
function JobActionsDropdown({
  job,
  showArchived,
  onViewScript,
  onViewLogs,
  onArchive,
  onUnarchive,
  onCloneRun
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleAction = (action) => {
    setIsOpen(false)
    action()
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-dark-text-secondary hover:text-dark-text-primary transition-colors p-1"
        title="Actions"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-dark-card border border-dark-border rounded-md shadow-lg z-10">
          <div className="py-1">
            {/* Clone Run */}
            <button
              onClick={() => handleAction(onCloneRun)}
              className="w-full text-left px-4 py-2 text-sm text-accent-green hover:bg-dark-card-hover transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Clone Run
            </button>

            {/* View Script */}
            {job.slurm_script && (
              <button
                onClick={() => handleAction(onViewScript)}
                className="w-full text-left px-4 py-2 text-sm text-blue-400 hover:bg-dark-card-hover transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                View Script
              </button>
            )}

            {/* View Logs */}
            {job.slurm_job_id && (
              <button
                onClick={() => handleAction(onViewLogs)}
                className="w-full text-left px-4 py-2 text-sm text-purple-400 hover:bg-dark-card-hover transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View Logs
              </button>
            )}

            {/* Divider */}
            <div className="border-t border-dark-border my-1"></div>

            {/* Archive/Unarchive */}
            {showArchived ? (
              <button
                onClick={() => handleAction(onUnarchive)}
                className="w-full text-left px-4 py-2 text-sm text-green-400 hover:bg-dark-card-hover transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Unarchive
              </button>
            ) : (
              <button
                onClick={() => handleAction(onArchive)}
                className="w-full text-left px-4 py-2 text-sm text-yellow-400 hover:bg-dark-card-hover transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Archive
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default JobActionsDropdown
