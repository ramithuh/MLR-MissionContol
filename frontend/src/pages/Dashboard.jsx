import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getProjects, createProject, getJobs } from '../services/api'

function Dashboard() {
  const [projects, setProjects] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddProject, setShowAddProject] = useState(false)
  const [newProjectPath, setNewProjectPath] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [projectsData, jobsData] = await Promise.all([
        getProjects(),
        getJobs()
      ])
      setProjects(projectsData)
      setJobs(jobsData)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddProject = async (e) => {
    e.preventDefault()
    try {
      await createProject(newProjectPath)
      setNewProjectPath('')
      setShowAddProject(false)
      fetchData()
    } catch (error) {
      console.error('Error adding project:', error)
      alert('Failed to add project. Check console for details.')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6">
      {/* Projects Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
          <button
            onClick={() => setShowAddProject(!showAddProject)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            + Add Project
          </button>
        </div>

        {/* Add Project Form */}
        {showAddProject && (
          <form onSubmit={handleAddProject} className="mb-4 bg-white p-4 rounded-lg shadow">
            <div className="flex gap-2">
              <input
                type="text"
                value={newProjectPath}
                onChange={(e) => setNewProjectPath(e.target.value)}
                placeholder="/path/to/your/ml-project"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowAddProject(false)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center text-gray-600">
            No projects yet. Add your first project to get started!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div key={project.id} className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{project.name}</h3>
                <div className="text-sm text-gray-600 mb-4">
                  <div className="truncate">{project.local_path}</div>
                  <div className="mt-1">
                    {project.current_branch} @ {project.current_commit?.substring(0, 7)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/project/${project.id}`}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center px-4 py-2 rounded-md"
                  >
                    View
                  </Link>
                  <Link
                    to={`/project/${project.id}/launch`}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white text-center px-4 py-2 rounded-md"
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
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Recent Jobs</h2>
        {jobs.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center text-gray-600">
            No jobs submitted yet.
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
                    Cluster
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resources
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
                      {job.description && (
                        <div className="text-sm text-gray-500">{job.description}</div>
                      )}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {job.num_nodes}x {job.gpus_per_node} {job.gpu_type || 'GPU'}
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

export default Dashboard
