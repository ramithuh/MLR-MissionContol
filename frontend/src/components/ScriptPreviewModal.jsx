import { useState } from 'react'

/**
 * Modal to preview SLURM script before submission or view historical scripts
 */
function ScriptPreviewModal({ script, onClose, onConfirm, isSubmitting, viewOnly = false }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(script)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-card rounded-lg border border-dark-border max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-dark-border">
          <h2 className="text-2xl font-bold text-dark-text-primary">SLURM Script Preview</h2>
          <button
            onClick={onClose}
            className="text-dark-text-secondary hover:text-dark-text-primary text-2xl"
          >
            ×
          </button>
        </div>

        {/* Script Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="relative">
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 px-3 py-1 text-xs bg-dark-bg hover:bg-dark-card-hover border border-dark-border rounded text-dark-text-primary transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <pre className="bg-dark-bg p-4 rounded border border-dark-border overflow-x-auto">
              <code className="text-sm text-dark-text-primary font-mono whitespace-pre">
                {script}
              </code>
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-dark-border">
          {viewOnly ? (
            <button
              onClick={onClose}
              className="px-6 py-3 bg-dark-border hover:bg-dark-card-hover text-dark-text-primary rounded-md transition-colors"
            >
              Close
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="px-6 py-3 border border-dark-border rounded-md text-dark-text-primary hover:bg-dark-card-hover transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isSubmitting}
                className="bg-accent-green hover:bg-accent-green-hover disabled:bg-dark-border disabled:text-dark-text-muted text-white px-6 py-3 rounded-md font-medium transition-colors"
              >
                {isSubmitting ? 'Submitting...' : 'Confirm & Submit Job'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ScriptPreviewModal
