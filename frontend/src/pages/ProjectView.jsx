import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getProject, getJobs, syncProject } from '../services/api'

function ProjectView() {
  const { projectId } = useParams()
  const [project, setProject] = useState(null)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [projectId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [projectData, jobsData] = await Promise.all([
        getProject(projectId),
        getJobs(projectId)
      ])
      setProject(projectData)
      setJobs(jobsData)
    } catch (error) {
      console.error('Error fetching project:', error)
      toast.error('Failed to load project data')
    } finally {
      setLoading(false)
    }
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
    <div className="px-4 py-6">
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
        <h2 className="text-2xl font-bold text-dark-text-primary mb-4">Job History</h2>
        {jobs.length === 0 ? (
          <div className="bg-dark-card p-8 rounded-lg border border-dark-border text-center text-dark-text-secondary">
            No jobs submitted for this project yet.
          </div>
        ) : (
          <div className="bg-dark-card rounded-lg border border-dark-border overflow-hidden">
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
                    WandB
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-text-secondary uppercase tracking-wider">
                    Submitted
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
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        job.slurm_status === 'RUNNING' ? 'bg-accent-green/20 text-accent-green' :
                        job.slurm_status === 'PENDING' ? 'bg-yellow-900/20 text-yellow-400' :
                        job.slurm_status === 'COMPLETED' ? 'bg-blue-900/20 text-blue-400' :
                        job.slurm_status === 'FAILED' ? 'bg-red-900/20 text-red-400' :
                        'bg-dark-border text-dark-text-muted'
                      }`}>
                        {job.slurm_status || 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {job.wandb_run_url ? (
                        <a
                          href={job.wandb_run_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-green hover:text-accent-green-hover transition-colors"
                        >
                          View Run
                        </a>
                      ) : (
                        <span className="text-dark-text-muted">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-dark-text-secondary">
                      {new Date(job.submitted_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProjectView
