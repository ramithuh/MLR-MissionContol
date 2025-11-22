import axios from 'axios'

// Always use /api (works for both local dev via Vite proxy and production via Cloudflare Tunnel)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Projects
export const getProjects = async () => {
  const response = await api.get('/projects/')
  return response.data
}

export const createProject = async (localPath) => {
  const response = await api.post('/projects/', { local_path: localPath })
  return response.data
}

export const getProject = async (projectId) => {
  const response = await api.get(`/projects/${projectId}`)
  return response.data
}

export const syncProject = async (projectId) => {
  const response = await api.post(`/projects/${projectId}/sync`)
  return response.data
}

export const getHydraConfig = async (projectId, configName = null) => {
  const params = configName ? { config_name: configName } : {}
  const response = await api.get(`/projects/${projectId}/hydra-config`, { params })
  return response.data
}

export const getProjectConfig = async (projectId) => {
  const response = await api.get(`/projects/${projectId}/config`)
  return response.data
}

export const getLastJobConfig = async (projectId) => {
  const response = await api.get(`/projects/${projectId}/last-job-config`)
  return response.data
}

export const deleteProject = async (projectId) => {
  const response = await api.delete(`/projects/${projectId}`)
  return response.data
}

export const updateCanvasState = async (projectId, canvasState) => {
  const response = await api.put(`/projects/${projectId}/canvas-state`, { canvas_state: canvasState })
  return response.data
}

// Jobs
export const getJobs = async (projectId = null, includeArchived = false) => {
  const params = {}
  if (projectId) params.project_id = projectId
  if (includeArchived) params.include_archived = true
  const response = await api.get('/jobs/', { params })
  return response.data
}

export const createJob = async (jobData) => {
  const response = await api.post('/jobs/', jobData)
  return response.data
}

export const previewJob = async (jobData) => {
  const response = await api.post('/jobs/preview', jobData)
  return response.data
}

export const getJob = async (jobId) => {
  const response = await api.get(`/jobs/${jobId}`)
  return response.data
}

export const refreshJobStatus = async (jobId) => {
  const response = await api.post(`/jobs/${jobId}/refresh-status`)
  return response.data
}

export const getJobLogs = async (jobId) => {
  const response = await api.get(`/jobs/${jobId}/logs`)
  return response.data
}

export const archiveJob = async (jobId) => {
  const response = await api.post(`/jobs/${jobId}/archive`)
  return response.data
}

export const unarchiveJob = async (jobId) => {
  const response = await api.post(`/jobs/${jobId}/unarchive`)
  return response.data
}

// Clusters
export const getClusters = async () => {
  const response = await api.get('/clusters/')
  return response.data
}

export const getGPUAvailability = async (clusterName) => {
  const response = await api.get(`/clusters/${clusterName}/gpu-availability`)
  return response.data
}

export const getPartitions = async (clusterName) => {
  const response = await api.get(`/clusters/${clusterName}/partitions`)
  return response.data
}

export const testClusterConnection = async (clusterName) => {
  const response = await api.post(`/clusters/${clusterName}/test-connection`)
  return response.data
}

export default api
