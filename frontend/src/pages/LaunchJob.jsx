import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  getProject,
  getClusters,
  getGPUAvailability,
  getPartitions,
  createJob
} from '../services/api'

function LaunchJob() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  const [project, setProject] = useState(null)
  const [clusters, setClusters] = useState([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    cluster: '',
    partition: '',
    gpu_type: '',
    num_nodes: 1,
    gpus_per_node: 1,
  })

  const [gpuAvailability, setGpuAvailability] = useState([])
  const [partitions, setPartitions] = useState([])
  const [loadingResources, setLoadingResources] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchInitialData()
  }, [projectId])

  useEffect(() => {
    if (formData.cluster) {
      fetchClusterResources(formData.cluster)
    }
  }, [formData.cluster])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const [projectData, clustersData] = await Promise.all([
        getProject(projectId),
        getClusters()
      ])
      setProject(projectData)
      setClusters(clustersData)

      // Set default job name
      setFormData(prev => ({
        ...prev,
        name: `${projectData.name}-${Date.now()}`
      }))
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load project data')
    } finally {
      setLoading(false)
    }
  }

  const fetchClusterResources = async (clusterName) => {
    try {
      setLoadingResources(true)
      const [gpuData, partitionsData] = await Promise.all([
        getGPUAvailability(clusterName),
        getPartitions(clusterName)
      ])

      // GPU data now has structure: { total_free_gpus: N, gpus: [...] }
      const gpuList = gpuData.gpus || []
      setGpuAvailability(gpuList)
      setPartitions(partitionsData)

      // Set default partition and GPU type
      if (partitionsData.length > 0 && !formData.partition) {
        setFormData(prev => ({ ...prev, partition: partitionsData[0] }))
      }
      if (gpuList.length > 0 && !formData.gpu_type) {
        setFormData(prev => ({ ...prev, gpu_type: gpuList[0].gpu_type }))
      }
    } catch (error) {
      console.error('Error fetching cluster resources:', error)
      toast.error(`Failed to load cluster resources: ${error.response?.data?.detail || error.message}`)
    } finally {
      setLoadingResources(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'num_nodes' || name === 'gpus_per_node' ? parseInt(value) : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      const jobData = {
        project_id: projectId,
        ...formData
      }
      await createJob(jobData)
      toast.success('Job submitted successfully!')
      navigate(`/project/${projectId}`)
    } catch (error) {
      console.error('Error submitting job:', error)
      toast.error(`Failed to submit job: ${error.response?.data?.detail || error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  const selectedGPU = gpuAvailability.find(gpu => gpu.gpu_type === formData.gpu_type)

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Launch Job</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="text-sm text-gray-600">
          <div><span className="font-medium">Project:</span> {project?.name}</div>
          <div><span className="font-medium">Commit:</span> {project?.current_commit}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Job Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Job Name
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description (Optional)
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Brief description of this experiment..."
          />
        </div>

        {/* Cluster Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cluster
          </label>
          <select
            name="cluster"
            value={formData.cluster}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a cluster</option>
            {clusters.map(cluster => (
              <option key={cluster.name} value={cluster.name}>
                {cluster.name}
              </option>
            ))}
          </select>
        </div>

        {/* Resource Configuration - Only show if cluster selected */}
        {formData.cluster && (
          <>
            {loadingResources ? (
              <div className="text-center text-gray-600 py-4">
                Loading cluster resources...
              </div>
            ) : (
              <>
                {/* Partition */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Partition
                  </label>
                  <select
                    name="partition"
                    value={formData.partition}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {partitions.map(partition => (
                      <option key={partition} value={partition}>
                        {partition}
                      </option>
                    ))}
                  </select>
                </div>

                {/* GPU Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    GPU Type
                  </label>
                  <select
                    name="gpu_type"
                    value={formData.gpu_type}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {gpuAvailability.map(gpu => (
                      <option key={gpu.gpu_type} value={gpu.gpu_type}>
                        {gpu.gpu_type} ({gpu.available}/{gpu.total} available)
                      </option>
                    ))}
                  </select>
                  {selectedGPU && (
                    <div className="mt-2 text-sm space-y-1">
                      <div className="text-gray-600">
                        <span className="font-medium">Available:</span> {selectedGPU.available} |
                        <span className="font-medium"> In Use:</span> {selectedGPU.in_use}
                        {selectedGPU.pending > 0 && (
                          <span> | <span className="font-medium text-yellow-600">Pending:</span> {selectedGPU.pending}</span>
                        )}
                      </div>
                      {selectedGPU.nodes_with_free && selectedGPU.nodes_with_free.length > 0 && (
                        <div className="text-xs text-gray-500">
                          <span className="font-medium">Nodes:</span> {selectedGPU.nodes_with_free.slice(0, 3).join(', ')}
                          {selectedGPU.nodes_with_free.length > 3 && ` +${selectedGPU.nodes_with_free.length - 3} more`}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Number of Nodes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Nodes
                  </label>
                  <input
                    type="number"
                    name="num_nodes"
                    value={formData.num_nodes}
                    onChange={handleInputChange}
                    min="1"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* GPUs per Node */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    GPUs per Node
                  </label>
                  <input
                    type="number"
                    name="gpus_per_node"
                    value={formData.gpus_per_node}
                    onChange={handleInputChange}
                    min="1"
                    max="8"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Total Resources Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <div className="text-sm font-medium text-blue-900">
                    Total Resources Requested:
                  </div>
                  <div className="text-sm text-blue-800 mt-1">
                    {formData.num_nodes} node(s) × {formData.gpus_per_node} {formData.gpu_type} GPU(s) = {formData.num_nodes * formData.gpus_per_node} total GPUs
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Hydra Config (Placeholder) */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">
            Hydra Configuration
          </h3>
          <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-md">
            Hydra config overrides will be implemented in Phase 2.
            For now, default configs will be used.
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting || !formData.cluster}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-md font-medium"
          >
            {submitting ? 'Submitting...' : 'Submit Job'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/project/${projectId}`)}
            className="px-6 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default LaunchJob
