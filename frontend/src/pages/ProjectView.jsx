import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getProject, getJobs, syncProject, archiveJob, unarchiveJob } from '../services/api'
import ScriptPreviewModal from '../components/ScriptPreviewModal'
import LogsModal from '../components/LogsModal'
import JobActionsDropdown from '../components/JobActionsDropdown'
import { formatRuntime } from '../utils/formatRuntime'

function ProjectView() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewingScript, setViewingScript] = useState(null)
  const [viewingLogs, setViewingLogs] = useState(null)
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    fetchData()

    // Auto-refresh every 30 seconds to pick up job status and WandB URL updates
    const interval = setInterval(() => {
      fetchData(false) // Don't show loading spinner on auto-refresh
    }, 30000)

    return () => clearInterval(interval)
  }, [projectId, showArchived])

  const fetchData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true)
      const [projectData, jobsData] = await Promise.all([
        getProject(projectId),
        getJobs(projectId, showArchived)  // Pass showArchived flag
      ])
      setProject(projectData)
      setJobs(jobsData)
    } catch (error) {
      console.error('Error fetching project:', error)
      if (showLoading) toast.error('Failed to load project data')
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  const handleArchiveJob = async (jobId) => {
    try {
      await archiveJob(jobId)
      toast.success('Job archived')
      fetchData(false) // Refresh without loading spinner
    } catch (error) {
      console.error('Error archiving job:', error)
      toast.error('Failed to archive job')
    }
  }

  const handleUnarchiveJob = async (jobId) => {
    try {
      await unarchiveJob(jobId)
      toast.success('Job unarchived')
      fetchData(false)
    } catch (error) {
      console.error('Error unarchiving job:', error)
      toast.error('Failed to unarchive job')
    }
  }

  const handleCloneRun = (job) => {
    // Navigate to launch page with cloned job config in state
    navigate(`/project/${projectId}/launch`, {
      state: {
        clonedFrom: {
          jobId: job.id,
          jobName: job.name,
          commitSha: job.commit_sha
        },
        config: {
          description: job.description || '',
          cluster_name: job.cluster,
          partition: job.partition,
          num_nodes: job.num_nodes,
          gpus_per_node: job.gpus_per_node,
          gpu_type: job.gpu_type || '',
          cpus_per_task: job.cpus_per_task,
          memory: job.memory,
          time_limit: job.time_limit,
          config_name: job.config_name || '',
          hydra_overrides: job.hydra_overrides || {},
          raw_hydra_overrides: job.raw_hydra_overrides || ''
        }
      }
    })
  }

  const handleSync = async () => {
    try {
      const updatedProject = await syncProject(projectId)
      setProject(updatedProject)
      toast.success('Project synced successfully!')
    } catch (error) {
      console.error('Error syncing project:', error)
      toast.error(`Failed to sync project: ${error.response?.data?.detail || error.message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-dark-text-secondary">Loading...</div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center text-dark-text-secondary">
        Project not found
      </div>
    )
  }

  return (
    <div className="py-6 w-full">
      {/* Project Header */}
      <div className="bg-dark-card rounded-lg border border-dark-border p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-dark-text-primary mb-2">{project.name}</h1>
            <div className="text-sm text-dark-text-secondary space-y-1">
              <div><span className="font-medium">Path:</span> {project.local_path}</div>
              <div><span className="font-medium">Remote:</span> {project.repo_url || 'N/A'}</div>
              <div><span className="font-medium">Branch:</span> {project.current_branch}</div>
              <div><span className="font-medium">Commit:</span> {project.current_commit}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSync}
              className="bg-dark-border hover:bg-dark-card-hover text-dark-text-primary px-4 py-2 rounded-md transition-colors"
            >
              Sync
            </button>
            <Link
              to={`/project/${projectId}/launch`}
              className="bg-accent-green hover:bg-accent-green-hover text-white px-4 py-2 rounded-md transition-colors"
            >
              Launch Job
            </Link>
          </div>
        </div>
      </div>

      {/* Job History */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-dark-text-primary">Job History</h2>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-4 py-2 rounded-md transition-colors ${
              showArchived
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                : 'bg-dark-bg hover:bg-dark-card-hover text-dark-text-primary border border-dark-border'
            }`}
          >
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </button>
        </div>
        {jobs.length === 0 ? (
          <div className="bg-dark-card p-8 rounded-lg border border-dark-border text-center text-dark-text-secondary">
            {showArchived ? 'No archived jobs.' : 'No jobs submitted for this project yet.'}
          </div>
        ) : (
          <div className="bg-dark-card rounded-lg border border-dark-border overflow-x-auto">
            <table className="min-w-full divide-y divide-dark-border">
              <thead className="bg-dark-bg">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-text-secondary uppercase tracking-wider">
                    Job Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-text-secondary uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-text-secondary uppercase tracking-wider">
                    Cluster
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-text-secondary uppercase tracking-wider">
                    Runtime
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-text-secondary uppercase tracking-wider">
                    WandB
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-text-secondary uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-dark-card divide-y divide-dark-border">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-dark-card-hover transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-dark-text-primary">{job.name}</div>
                      <div className="text-xs text-dark-text-muted">
                        {job.commit_sha?.substring(0, 7)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-dark-text-secondary">
                      {job.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-dark-text-secondary">
                      {job.cluster}
                      {job.gpu_type && (
                        <span className="text-dark-text-muted"> ({job.gpu_type})</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          job.slurm_status === 'RUNNING' ? 'bg-accent-green/20 text-accent-green' :
                          job.slurm_status === 'PENDING' ? 'bg-yellow-900/20 text-yellow-400' :
                          job.slurm_status === 'COMPLETED' ? 'bg-blue-900/20 text-blue-400' :
                          job.slurm_status === 'FAILED' ? 'bg-red-900/20 text-red-400' :
                          'bg-dark-border text-dark-text-muted'
                        }`}>
                          {job.slurm_status || 'UNKNOWN'}
                        </span>
                        {job.slurm_status === 'FAILED' && job.error_message && (
                          <div className="mt-1 text-xs text-red-400 max-w-xs break-words">
                            {job.error_message}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-dark-text-secondary">
                      {formatRuntime(job.runtime_seconds)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {job.wandb_run_url ? (
                        <div className="flex gap-3">
                          <a
                            href={job.wandb_run_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent-green hover:text-accent-green-hover transition-colors"
                          >
                            View Run
                          </a>
                          <span className="text-dark-text-muted">|</span>
                          <a
                            href={`${job.wandb_run_url}/logs`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            Logs
                          </a>
                        </div>
                      ) : (
                        <span className="text-dark-text-muted">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-dark-text-secondary">
                      {new Date(job.submitted_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <JobActionsDropdown
                        job={job}
                        showArchived={showArchived}
                        onViewScript={() => setViewingScript(job.slurm_script)}
                        onViewLogs={() => setViewingLogs({ id: job.id, name: job.name })}
                        onArchive={() => handleArchiveJob(job.id)}
                        onUnarchive={() => handleUnarchiveJob(job.id)}
                        onCloneRun={() => handleCloneRun(job)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Script Viewer Modal */}
      {viewingScript && (
        <ScriptPreviewModal
          script={viewingScript}
          onClose={() => setViewingScript(null)}
          onConfirm={() => setViewingScript(null)}
          isSubmitting={false}
          viewOnly={true}
        />
      )}

      {/* Logs Viewer Modal */}
      {viewingLogs && (
        <LogsModal
          jobId={viewingLogs.id}
          jobName={viewingLogs.name}
          onClose={() => setViewingLogs(null)}
        />
      )}
    </div>
  )
}

export default ProjectView
