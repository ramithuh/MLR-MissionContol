import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  getProject,
  getProjectConfig,
  getLastJobConfig,
  getClusters,
  getGPUAvailability,
  getPartitions,
  createJob,
  previewJob
} from '../services/api'
import HydraConfigForm from '../components/HydraConfigForm'
import ScriptPreviewModal from '../components/ScriptPreviewModal'

function LaunchJob() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  const [project, setProject] = useState(null)
  const [projectConfig, setProjectConfig] = useState(null)
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
    time_limit: '24:00:00',
  })

  const [gpuAvailability, setGpuAvailability] = useState([])
  const [partitions, setPartitions] = useState([])
  const [loadingResources, setLoadingResources] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [hydraOverrides, setHydraOverrides] = useState({})
  const [rawHydraOverrides, setRawHydraOverrides] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [previewScript, setPreviewScript] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

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
      const [projectData, projectConfigData, clustersData, lastJobData] = await Promise.all([
        getProject(projectId),
        getProjectConfig(projectId),
        getClusters(),
        getLastJobConfig(projectId)
      ])
      setProject(projectData)
      setProjectConfig(projectConfigData)
      setClusters(clustersData)

      // Set default job name
      const defaultName = `${projectData.name}-${Date.now()}`

      // If we have cached config from a previous job, populate the form
      if (lastJobData.success && lastJobData.config) {
        const cachedConfig = lastJobData.config
        setFormData(prev => ({
          ...prev,
          name: defaultName,
          cluster: cachedConfig.cluster_name || prev.cluster,
          partition: cachedConfig.partition || prev.partition,
          gpu_type: cachedConfig.gpu_type || prev.gpu_type,
          num_nodes: cachedConfig.num_nodes || prev.num_nodes,
          gpus_per_node: cachedConfig.gpus_per_node || prev.gpus_per_node,
          time_limit: cachedConfig.time_limit || prev.time_limit,
        }))

        // Populate Hydra overrides
        setHydraOverrides(cachedConfig.hydra_overrides || {})
        setRawHydraOverrides(cachedConfig.raw_hydra_overrides || '')

        toast.success('Form populated with previous job configuration', { duration: 3000 })
      } else {
        setFormData(prev => ({
          ...prev,
          name: defaultName
        }))
      }
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

  const handleHydraConfigChange = (config) => {
    setHydraOverrides(config)
  }

  const handlePreview = async (e) => {
    e.preventDefault()
    try {
      setPreviewLoading(true)
      const jobData = {
        project_id: projectId,
        ...formData,
        hydra_overrides: Object.keys(hydraOverrides).length > 0 ? hydraOverrides : null,
        raw_hydra_overrides: rawHydraOverrides.trim() || null
      }
      const result = await previewJob(jobData)
      setPreviewScript(result.script)
      setShowPreview(true)
    } catch (error) {
      console.error('Error previewing job:', error)
      toast.error(`Failed to preview script: ${error.response?.data?.detail || error.message}`)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleConfirmSubmit = async () => {
    try {
      setSubmitting(true)
      const jobData = {
        project_id: projectId,
        ...formData,
        hydra_overrides: Object.keys(hydraOverrides).length > 0 ? hydraOverrides : null,
        raw_hydra_overrides: rawHydraOverrides.trim() || null
      }
      await createJob(jobData)
      toast.success('Job submitted successfully!')
      navigate(`/project/${projectId}`)
    } catch (error) {
      console.error('Error submitting job:', error)
      toast.error(`Failed to submit job: ${error.response?.data?.detail || error.message}`)
      setShowPreview(false)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-dark-text-secondary">Loading...</div>
      </div>
    )
  }

  const selectedGPU = gpuAvailability.find(gpu => gpu.gpu_type === formData.gpu_type)

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-dark-text-primary mb-6">Launch Job</h1>

      <div className="bg-dark-card rounded-lg border border-dark-border p-6 mb-6">
        <div className="text-sm text-dark-text-secondary">
          <div><span className="font-medium">Project:</span> {project?.name}</div>
          <div><span className="font-medium">Commit:</span> {project?.current_commit}</div>
        </div>
      </div>

      {/* Project Configuration Info */}
      {projectConfig && (
        <div className="bg-dark-card rounded-lg border border-dark-border p-6 mb-6">
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-lg font-medium text-dark-text-primary">Project Configuration</h2>
            {projectConfig.exists ? (
              <span className="text-xs px-2 py-1 bg-green-900/20 text-green-400 rounded">
                ✓ Config Found
              </span>
            ) : (
              <span className="text-xs px-2 py-1 bg-yellow-900/20 text-yellow-400 rounded">
                ! Using Defaults
              </span>
            )}
          </div>

          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-dark-text-muted mb-1">Training Script</div>
                <div className="text-dark-text-primary font-mono bg-dark-bg px-2 py-1 rounded">
                  {projectConfig.train_script || 'train.py'}
                </div>
              </div>
              <div>
                <div className="text-dark-text-muted mb-1">Conda Environment</div>
                <div className="text-dark-text-primary font-mono bg-dark-bg px-2 py-1 rounded">
                  {projectConfig.conda_env || <span className="text-dark-text-muted italic">cluster default</span>}
                </div>
              </div>
            </div>

            {!projectConfig.exists && (
              <div className="mt-4 p-3 bg-blue-900/10 border border-blue-700/30 rounded text-xs">
                <div className="font-medium text-blue-400 mb-1">💡 Customize your project:</div>
                <div className="text-dark-text-secondary">
                  Create <code className="text-accent-green">.mlops-config.yaml</code> in your project root:
                </div>
                <pre className="mt-2 text-dark-text-primary bg-dark-bg p-2 rounded font-mono overflow-x-auto">
{`conda_env: "your_env_name"
train_script: "path/to/train.py"  # e.g., routines/train.py`}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handlePreview} className="bg-dark-card rounded-lg border border-dark-border p-6 space-y-6">
        {/* Job Name */}
        <div>
          <label className="block text-sm font-medium text-dark-text-primary mb-2">
            Job Name
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-accent-green"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-dark-text-primary mb-2">
            Description (Optional)
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows="3"
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green"
            placeholder="Brief description of this experiment..."
          />
        </div>

        {/* Cluster Selection */}
        <div>
          <label className="block text-sm font-medium text-dark-text-primary mb-2">
            Cluster
          </label>
          <select
            name="cluster"
            value={formData.cluster}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-accent-green"
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
              <div className="text-center text-dark-text-secondary py-4">
                Loading cluster resources...
              </div>
            ) : (
              <>
                {/* Partition */}
                <div>
                  <label className="block text-sm font-medium text-dark-text-primary mb-2">
                    Partition
                  </label>
                  <select
                    name="partition"
                    value={formData.partition}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-accent-green"
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
                  <label className="block text-sm font-medium text-dark-text-primary mb-2">
                    GPU Type
                  </label>
                  <select
                    name="gpu_type"
                    value={formData.gpu_type}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-accent-green"
                  >
                    {gpuAvailability.map(gpu => (
                      <option key={gpu.gpu_type} value={gpu.gpu_type}>
                        {gpu.gpu_type} ({gpu.available}/{gpu.total} available)
                      </option>
                    ))}
                  </select>
                  {selectedGPU && (
                    <div className="mt-2 text-sm space-y-1">
                      <div className="text-dark-text-secondary">
                        <span className="font-medium">Available:</span> {selectedGPU.available} |
                        <span className="font-medium"> In Use:</span> {selectedGPU.in_use}
                        {selectedGPU.pending > 0 && (
                          <span> | <span className="font-medium text-yellow-400">Pending:</span> {selectedGPU.pending}</span>
                        )}
                      </div>
                      {selectedGPU.nodes_with_free && selectedGPU.nodes_with_free.length > 0 && (
                        <div className="text-xs text-dark-text-muted">
                          <span className="font-medium">Nodes:</span> {selectedGPU.nodes_with_free.slice(0, 3).join(', ')}
                          {selectedGPU.nodes_with_free.length > 3 && ` +${selectedGPU.nodes_with_free.length - 3} more`}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Number of Nodes */}
                <div>
                  <label className="block text-sm font-medium text-dark-text-primary mb-2">
                    Number of Nodes
                  </label>
                  <input
                    type="number"
                    name="num_nodes"
                    value={formData.num_nodes}
                    onChange={handleInputChange}
                    min="1"
                    required
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-accent-green"
                  />
                </div>

                {/* GPUs per Node */}
                <div>
                  <label className="block text-sm font-medium text-dark-text-primary mb-2">
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
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-accent-green"
                  />
                </div>

                {/* Time Limit */}
                <div>
                  <label className="block text-sm font-medium text-dark-text-primary mb-2">
                    Time Limit
                    <span className="text-xs text-dark-text-muted ml-2">(HH:MM:SS or DD-HH:MM:SS)</span>
                  </label>
                  <input
                    type="text"
                    name="time_limit"
                    value={formData.time_limit}
                    onChange={handleInputChange}
                    placeholder="24:00:00"
                    required
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green"
                  />
                  <div className="mt-1 text-xs text-dark-text-muted">
                    Examples: 1:00:00 (1 hour), 24:00:00 (24 hours), 7-00:00:00 (7 days)
                  </div>
                </div>

                {/* Total Resources Summary */}
                <div className="bg-accent-green/10 border border-accent-green/30 rounded-md p-4">
                  <div className="text-sm font-medium text-accent-green">
                    Total Resources Requested:
                  </div>
                  <div className="text-sm text-dark-text-primary mt-1">
                    {formData.num_nodes} node(s) × {formData.gpus_per_node} {formData.gpu_type} GPU(s) = {formData.num_nodes * formData.gpus_per_node} total GPUs
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Hydra Config */}
        <div className="border-t border-dark-border pt-6">
          <h3 className="text-lg font-medium text-dark-text-primary mb-3">
            Hydra Configuration
          </h3>
          <HydraConfigForm
            projectId={projectId}
            onConfigChange={handleHydraConfigChange}
            initialValues={hydraOverrides}
          />

          {/* Raw Hydra Overrides */}
          <div className="mt-6 pt-6 border-t border-dark-border">
            <label className="block text-sm font-medium text-dark-text-primary mb-2">
              Raw Hydra Overrides
              <span className="text-xs text-dark-text-muted ml-2">(Advanced: merged with dropdown selections)</span>
            </label>
            <textarea
              value={rawHydraOverrides}
              onChange={(e) => setRawHydraOverrides(e.target.value)}
              placeholder="plinder_path=/net/galaxy/home/koes/ltoft/OMTRA/data/plinder +partial_ckpt=wandb_symlinks/run123/checkpoints/batch_370000.ckpt num_workers=6 trainer.devices=2 model.train_t_dist=beta"
              rows="4"
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green font-mono text-sm"
            />
            <div className="mt-2 text-xs text-dark-text-muted space-y-1">
              <div>Add additional overrides here. These will be <span className="text-accent-green font-medium">merged</span> with dropdown selections. Supports:</div>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li><code className="text-accent-green">key=value</code> - set parameter</li>
                <li><code className="text-accent-green">+key=value</code> - add new parameter</li>
                <li><code className="text-accent-green">~key</code> - delete parameter</li>
                <li><code className="text-accent-green">group/option=value</code> - config group selection</li>
                <li><code className="text-accent-green">nested.key=value</code> - nested config</li>
              </ul>
              {rawHydraOverrides && (
                <div className="mt-2 text-blue-400">
                  ℹ Raw overrides will be added after dropdown selections (same keys will override)
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={previewLoading || !formData.cluster}
            className="flex-1 bg-accent-green hover:bg-accent-green-hover disabled:bg-dark-border disabled:text-dark-text-muted text-white px-6 py-3 rounded-md font-medium transition-colors"
          >
            {previewLoading ? 'Loading Preview...' : 'Preview & Submit Job'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/project/${projectId}`)}
            className="px-6 py-3 border border-dark-border rounded-md text-dark-text-primary hover:bg-dark-card-hover transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Preview Modal */}
      {showPreview && (
        <ScriptPreviewModal
          script={previewScript}
          onClose={() => setShowPreview(false)}
          onConfirm={handleConfirmSubmit}
          isSubmitting={submitting}
        />
      )}
    </div>
  )
}

export default LaunchJob
