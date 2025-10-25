import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
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
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    try {
      const updatedProject = await syncProject(projectId)
      setProject(updatedProject)
    } catch (error) {
      console.error('Error syncing project:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center text-gray-600">
        Project not found
      </div>
    )
  }

  return (
    <div className="px-4 py-6">
      {/* Project Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{project.name}</h1>
            <div className="text-sm text-gray-600 space-y-1">
              <div><span className="font-medium">Path:</span> {project.local_path}</div>
              <div><span className="font-medium">Remote:</span> {project.repo_url || 'N/A'}</div>
              <div><span className="font-medium">Branch:</span> {project.current_branch}</div>
              <div><span className="font-medium">Commit:</span> {project.current_commit}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSync}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md"
            >
              Sync
            </button>
            <Link
              to={`/project/${projectId}/launch`}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
            >
              Launch Job
            </Link>
          </div>
        </div>
      </div>

      {/* Job History */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Job History</h2>
        {jobs.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center text-gray-600">
            No jobs submitted for this project yet.
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cluster
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    WandB
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{job.name}</div>
                      <div className="text-xs text-gray-500">
                        {job.commit_sha?.substring(0, 7)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {job.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {job.cluster}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        job.slurm_status === 'RUNNING' ? 'bg-green-100 text-green-800' :
                        job.slurm_status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                        job.slurm_status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                        job.slurm_status === 'FAILED' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
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
                          className="text-blue-600 hover:text-blue-800"
                        >
                          View Run
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
