import { useState } from 'react'
import { testClusterConnection, getGPUAvailability } from '../services/api'
import toast from 'react-hot-toast'

/**
 * Card showing cluster connection status with test button and setup instructions
 */
function ClusterConnectionCard({ cluster }) {
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState(null) // null, 'connected', 'disconnected'
  const [showInstructions, setShowInstructions] = useState(false)
  const [gpuData, setGpuData] = useState(null)
  const [loadingGPU, setLoadingGPU] = useState(false)

  const fetchGPUData = async () => {
    try {
      setLoadingGPU(true)
      const data = await getGPUAvailability(cluster.name)
      setGpuData(data)
    } catch (error) {
      console.error('Failed to fetch GPU data:', error)
      setGpuData(null)
    } finally {
      setLoadingGPU(false)
    }
  }

  const handleTestConnection = async () => {
    try {
      setTesting(true)
      const result = await testClusterConnection(cluster.name)

      if (result.reachable) {
        setStatus('connected')
        toast.success(`Connected to ${cluster.name}`)
        // Fetch GPU data after successful connection
        fetchGPUData()
      } else {
        setStatus('disconnected')
        toast.error(`Cannot reach ${cluster.name}`)
        setGpuData(null)
        if (cluster.requires_vpn || cluster.requires_manual_auth) {
          setShowInstructions(true)
        }
      }
    } catch (error) {
      setStatus('disconnected')
      toast.error(`Connection failed: ${error.message}`)
      setGpuData(null)
      if (cluster.requires_vpn || cluster.requires_manual_auth) {
        setShowInstructions(true)
      }
    } finally {
      setTesting(false)
    }
  }

  const getStatusColor = () => {
    if (status === 'connected') return 'bg-accent-green'
    if (status === 'disconnected') return 'bg-red-500'
    return 'bg-gray-400'
  }

  const getStatusText = () => {
    if (status === 'connected') return 'Connected'
    if (status === 'disconnected') return 'Disconnected'
    return 'Unknown'
  }

  const needsSetup = cluster.requires_vpn || cluster.requires_manual_auth

  // Generate VPN command for copying
  const generateVPNCommand = () => {
    if (!cluster.requires_vpn || !cluster.vpn_portal || !cluster.vpn_protocol) {
      return null
    }

    let cmd = `sudo openconnect --protocol=${cluster.vpn_protocol} ${cluster.vpn_portal}`

    if (cluster.vpn_username) {
      cmd += ` --user=${cluster.vpn_username}`
    }

    if (cluster.vpn_gateway) {
      cmd += ` --authgroup=${cluster.vpn_gateway}`
    }

    return cmd
  }

  const handleCopyVPNCommand = () => {
    const cmd = generateVPNCommand()
    if (cmd) {
      navigator.clipboard.writeText(cmd)
      toast.success('VPN command copied to clipboard!')
    } else {
      toast.error('VPN configuration incomplete')
    }
  }

  return (
    <>
      <div className="bg-dark-card rounded-lg border border-dark-border p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-dark-text-primary">{cluster.name}</h3>
            <div className="text-xs text-dark-text-muted">{cluster.host}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
            <span className="text-sm text-dark-text-secondary">{getStatusText()}</span>
          </div>
        </div>

        {needsSetup && (
          <div className="mb-3 text-xs">
            {cluster.requires_vpn && (
              <span className="inline-block bg-yellow-900/20 text-yellow-400 px-2 py-1 rounded mr-2">
                VPN Required
              </span>
            )}
            {cluster.requires_manual_auth && (
              <span className="inline-block bg-blue-900/20 text-blue-400 px-2 py-1 rounded">
                Manual Auth Required
              </span>
            )}
          </div>
        )}

        <div className="flex gap-2 mb-2">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="flex-1 px-4 py-2 bg-accent-green hover:bg-accent-green-hover disabled:bg-dark-border disabled:text-dark-text-muted text-white rounded-md text-sm font-medium transition-colors"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>

          {needsSetup && (
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="px-4 py-2 border border-dark-border hover:bg-dark-card-hover text-dark-text-primary rounded-md text-sm transition-colors"
            >
              Setup Guide
            </button>
          )}
        </div>

        {/* Copy VPN Command button - only show if VPN config is provided */}
        {cluster.requires_vpn && cluster.vpn_portal && (
          <button
            onClick={handleCopyVPNCommand}
            className="w-full px-4 py-2 bg-blue-900/20 hover:bg-blue-900/30 border border-blue-700/50 text-blue-400 rounded-md text-sm font-medium transition-colors"
          >
            📋 Copy VPN Command
          </button>
        )}

        {showInstructions && cluster.connection_instructions && (
          <div className="mt-4 p-3 bg-dark-bg border border-dark-border rounded text-xs">
            <div className="font-medium text-dark-text-primary mb-2">Setup Instructions:</div>
            <pre className="text-dark-text-secondary whitespace-pre-wrap font-mono">
              {cluster.connection_instructions}
            </pre>
          </div>
        )}

        {/* GPU Availability Section */}
        {status === 'connected' && (
          <div className="mt-4 p-3 bg-dark-bg border border-dark-border rounded">
            <div className="flex justify-between items-center mb-2">
              <div className="font-medium text-dark-text-primary text-sm">GPU Availability</div>
              {loadingGPU && <span className="text-xs text-dark-text-muted">Loading...</span>}
            </div>

            {gpuData && gpuData.gpus && gpuData.gpus.length > 0 ? (
              <div className="space-y-2">
                {gpuData.gpus.map((gpu) => (
                  <div key={gpu.gpu_type} className="flex justify-between items-center text-sm">
                    <span className="text-dark-text-secondary">{gpu.gpu_type}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-accent-green font-medium">{gpu.available} free</span>
                      <span className="text-dark-text-muted text-xs">
                        {gpu.in_use} in use / {gpu.total} total
                      </span>
                    </div>
                  </div>
                ))}
                {gpuData.cached && (
                  <div className="text-xs text-dark-text-muted mt-2">
                    Cached data ({gpuData.cache_age_seconds}s old)
                  </div>
                )}
              </div>
            ) : (
              !loadingGPU && <div className="text-sm text-dark-text-muted">No GPU data available</div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export default ClusterConnectionCard
