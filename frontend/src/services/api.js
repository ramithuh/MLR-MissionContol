import axios from 'axios'

const API_BASE_URL = 'http://localhost:8028/api'

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

export const getHydraConfig = async (projectId) => {
  const response = await api.get(`/projects/${projectId}/hydra-config`)
  return response.data
}

export const deleteProject = async (projectId) => {
  const response = await api.delete(`/projects/${projectId}`)
  return response.data
}

// Jobs
export const getJobs = async (projectId = null) => {
  const params = projectId ? { project_id: projectId } : {}
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
