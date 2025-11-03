import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getProjects, createProject, getJobs, getClusters } from '../services/api'
import ClusterConnectionCard from '../components/ClusterConnectionCard'

function Dashboard() {
  const [projects, setProjects] = useState([])
  const [jobs, setJobs] = useState([])
  const [clusters, setClusters] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddProject, setShowAddProject] = useState(false)
  const [newProjectPath, setNewProjectPath] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [projectsData, jobsData, clustersData] = await Promise.all([
        getProjects(),
        getJobs(),
        getClusters()
      ])
      setProjects(projectsData)
      setJobs(jobsData)
      setClusters(clustersData)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const handleAddProject = async (e) => {
    e.preventDefault()
    try {
      await createProject(newProjectPath)
      toast.success('Project added successfully!')
      setNewProjectPath('')
      setShowAddProject(false)
      fetchData()
    } catch (error) {
      console.error('Error adding project:', error)
      toast.error(`Failed to add project: ${error.response?.data?.detail || error.message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-dark-text-secondary">Loading...</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6">
      {/* Cluster Connection Status */}
      {clusters.some(c => c.requires_vpn || c.requires_manual_auth) && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-dark-text-primary mb-4">Cluster Connections</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clusters
              .filter(c => c.requires_vpn || c.requires_manual_auth)
              .map((cluster) => (
                <ClusterConnectionCard key={cluster.name} cluster={cluster} />
              ))}
          </div>
        </div>
      )}

      {/* Projects Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-dark-text-primary">Projects</h2>
          <button
            onClick={() => setShowAddProject(!showAddProject)}
            className="bg-accent-green hover:bg-accent-green-hover text-white px-4 py-2 rounded-md transition-colors"
          >
            + Add Project
          </button>
        </div>

        {/* Add Project Form */}
        {showAddProject && (
          <form onSubmit={handleAddProject} className="mb-4 bg-dark-card p-4 rounded-lg border border-dark-border">
            <div className="flex gap-2">
              <input
                type="text"
                value={newProjectPath}
                onChange={(e) => setNewProjectPath(e.target.value)}
                placeholder="/path/to/your/ml-project"
                className="flex-1 px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green"
                required
              />
              <button
                type="submit"
                className="bg-accent-green hover:bg-accent-green-hover text-white px-4 py-2 rounded-md transition-colors"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowAddProject(false)}
                className="bg-dark-border hover:bg-dark-card-hover text-dark-text-secondary px-4 py-2 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <div className="bg-dark-card p-8 rounded-lg border border-dark-border text-center text-dark-text-secondary">
            No projects yet. Add your first project to get started!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div key={project.id} className="bg-dark-card p-6 rounded-lg border border-dark-border hover:border-accent-green hover:bg-dark-card-hover transition-all">
                <h3 className="text-xl font-semibold text-dark-text-primary mb-2">{project.name}</h3>
                <div className="text-sm text-dark-text-secondary mb-4">
                  <div className="truncate">{project.local_path}</div>
                  <div className="mt-1">
                    {project.current_branch} @ {project.current_commit?.substring(0, 7)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/project/${project.id}`}
                    className="flex-1 bg-dark-border hover:bg-dark-card-hover text-dark-text-primary text-center px-4 py-2 rounded-md transition-colors"
                  >
                    View
                  </Link>
                  <Link
                    to={`/project/${project.id}/launch`}
                    className="flex-1 bg-accent-green hover:bg-accent-green-hover text-white text-center px-4 py-2 rounded-md transition-colors"
                  >
                    Launch Job
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Jobs Section */}
      <div>
        <h2 className="text-2xl font-bold text-dark-text-primary mb-4">Recent Jobs</h2>
        {jobs.length === 0 ? (
          <div className="bg-dark-card p-8 rounded-lg border border-dark-border text-center text-dark-text-secondary">
            No jobs submitted yet.
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
                    Cluster
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-text-secondary uppercase tracking-wider">
                    Resources
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
                      {job.description && (
                        <div className="text-sm text-dark-text-secondary">{job.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-dark-text-secondary">
                      {job.cluster}
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
                      {job.num_nodes}x {job.gpus_per_node} {job.gpu_type || 'GPU'}
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

export default Dashboard
