import { useState, useEffect, useRef, useMemo } from 'react'
import { getClusters, getGPUAvailability } from '../services/api'
import toast from 'react-hot-toast'

const AUTO_REFRESH_INTERVAL = 60000 // 60 seconds

function ClusterVisualization() {
  const [clusters, setClusters] = useState([])
  const [clusterData, setClusterData] = useState({})
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const refreshTimerRef = useRef(null)

  useEffect(() => {
    fetchClusters()

    // Set up auto-refresh
    if (autoRefresh) {
      refreshTimerRef.current = setInterval(() => {
        fetchClusters()
      }, AUTO_REFRESH_INTERVAL)
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [autoRefresh])

  const fetchClusters = async () => {
    try {
      setLoading(true)
      const clustersData = await getClusters()
      setClusters(clustersData)

      // Fetch GPU availability for each cluster
      const dataPromises = clustersData.map(async (cluster) => {
        try {
          const gpuData = await getGPUAvailability(cluster.name)
          return { clusterName: cluster.name, gpuData }
        } catch (error) {
          console.error(`Error fetching GPU data for ${cluster.name}:`, error)
          return { clusterName: cluster.name, gpuData: { gpus: [] }, error: true }
        }
      })

      const results = await Promise.all(dataPromises)
      const dataMap = {}
      results.forEach(result => {
        dataMap[result.clusterName] = result.gpuData
      })
      setClusterData(dataMap)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Error fetching clusters:', error)
      toast.error('Failed to load cluster data')
    } finally {
      setLoading(false)
    }
  }

  const handleManualRefresh = () => {
    toast.promise(
      fetchClusters(),
      {
        loading: 'Refreshing cluster data...',
        success: 'Data refreshed successfully',
        error: 'Failed to refresh data'
      }
    )
  }

  if (loading && !lastUpdated) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-dark-text-secondary">Loading cluster visualization...</div>
      </div>
    )
  }

  const formatTimestamp = (date) => {
    if (!date) return ''
    const now = new Date()
    const diff = Math.floor((now - date) / 1000) // seconds
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return date.toLocaleTimeString()
  }

  return (
    <div className="px-4 py-6">
      {/* Header with refresh controls */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark-text-primary mb-2">GPU Cluster Visualization</h1>
          <p className="text-dark-text-secondary">Real-time GPU availability across all clusters</p>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-sm text-dark-text-muted">
              Updated {formatTimestamp(lastUpdated)}
            </span>
          )}

          <button
            onClick={handleManualRefresh}
            disabled={loading}
            className="px-4 py-2 rounded-md bg-dark-card border border-dark-border hover:border-accent-green hover:bg-dark-card/80 text-dark-text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className={loading ? 'animate-spin inline-block' : ''}>⟳</span> Refresh
          </button>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-md border transition-all ${
              autoRefresh
                ? 'bg-green-500/20 border-green-500/50 text-green-400'
                : 'bg-dark-card border-dark-border text-dark-text-muted hover:border-dark-border-hover'
            }`}
          >
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Cluster cards */}
      <div className="space-y-6">
        {clusters.map((cluster) => {
          const gpuData = clusterData[cluster.name]?.gpus || []
          const hasError = clusterData[cluster.name]?.error

          return (
            <div key={cluster.name}>
              <ClusterCard cluster={cluster} gpuTypes={gpuData} hasError={hasError} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ClusterCard({ cluster, gpuTypes, hasError }) {
  // Calculate cluster-wide statistics
  const stats = gpuTypes.reduce((acc, gpu) => ({
    total: acc.total + (gpu.total || 0),
    available: acc.available + (gpu.available || 0),
    inUse: acc.inUse + (gpu.in_use || 0),
    pending: acc.pending + (gpu.pending || 0)
  }), { total: 0, available: 0, inUse: 0, pending: 0 })

  const availabilityPercent = stats.total > 0 ? ((stats.available / stats.total) * 100).toFixed(1) : 0

  return (
    <div className="relative">
      <div className="w-full px-6 py-5 rounded-lg border-2 border-dark-border transition-all duration-200 hover:shadow-2xl hover:border-accent-green bg-dark-card"
           style={{
             background: `repeating-linear-gradient(0deg, #1a1a1a 0px, #1a1a1a 1px, #2a2a2a 1px, #2a2a2a 2px), repeating-linear-gradient(90deg, #1a1a1a 0px, #1a1a1a 1px, #2a2a2a 1px, #2a2a2a 2px)`,
             boxShadow: 'rgba(0, 0, 0, 0.6) 0px 20px 40px, rgba(0, 0, 0, 0.5) 0px 0px 20px inset, rgba(255, 255, 255, 0.1) 0px 1px 0px inset'
           }}>

        {/* Cluster Name Header with Stats */}
        <div className="mb-5 pb-4 border-b border-dark-border">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-2xl font-bold text-dark-text-primary">{cluster.name}</h3>
              <p className="text-sm text-dark-text-muted">{cluster.host}</p>
            </div>
            {!hasError && stats.total > 0 && (
              <div className="text-right">
                <div className="text-3xl font-bold text-green-400">{stats.available}</div>
                <div className="text-xs text-dark-text-muted">available of {stats.total}</div>
              </div>
            )}
          </div>

          {/* Cluster-wide progress bar */}
          {!hasError && stats.total > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-dark-text-secondary">Cluster Availability</span>
                <span className="text-sm font-bold text-green-400">{availabilityPercent}%</span>
              </div>
              <div className="h-3 bg-dark-bg rounded-full overflow-hidden">
                <div className="h-full flex">
                  <div
                    className="bg-green-500 transition-all duration-500"
                    style={{ width: `${(stats.available / stats.total) * 100}%` }}
                  />
                  <div
                    className="bg-yellow-500 transition-all duration-500"
                    style={{ width: `${(stats.pending / stats.total) * 100}%` }}
                  />
                  <div
                    className="bg-zinc-700 transition-all duration-500"
                    style={{ width: `${(stats.inUse / stats.total) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs">
                <span className="text-green-400"><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"></span>{stats.available} free</span>
                <span className="text-yellow-400"><span className="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-1"></span>{stats.pending} pending</span>
                <span className="text-dark-text-muted"><span className="inline-block w-2 h-2 rounded-full bg-zinc-700 mr-1"></span>{stats.inUse} in use</span>
              </div>
            </div>
          )}
        </div>

        {/* GPU Types Grid */}
        {hasError || gpuTypes.length === 0 ? (
          <div className="text-center py-8 text-dark-text-muted text-sm">
            {hasError ? '⚠ Failed to fetch GPU data' : 'No GPU data available'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...gpuTypes]
              .sort((a, b) => b.available - a.available) // Sort by most available first
              .map((gpu) => (
                <GPURackVisual key={gpu.gpu_type} gpu={gpu} />
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

function GPURackVisual({ gpu }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const totalSlots = gpu.total || 0
  const availableCount = gpu.available || 0
  const inUseCount = gpu.in_use || 0
  const pendingCount = gpu.pending || 0
  const nodesWithFree = gpu.nodes_with_free || []

  const availabilityPercent = totalSlots > 0 ? ((availableCount / totalSlots) * 100).toFixed(0) : 0

  // Create slots array: 'available' or 'unavailable' (in-use + pending combined)
  const slots = []
  for (let i = 0; i < availableCount; i++) slots.push('available')
  for (let i = 0; i < pendingCount + inUseCount; i++) slots.push('unavailable')

  // Assign each unavailable node a random animation duration (stable across renders)
  // Only animate ~50% of unavailable nodes for performance
  const unavailableCount = pendingCount + inUseCount
  const animatedNodes = useMemo(() => {
    const nodes = new Map() // Map of index -> { duration, delay }
    const targetCount = Math.max(1, Math.floor(unavailableCount * 0.2)) // 50% of unavailable
    const usedIndices = new Set()

    // Generate random unique indices with random durations and delays
    while (usedIndices.size < targetCount && usedIndices.size < unavailableCount) {
      const idx = Math.floor(Math.random() * unavailableCount)
      if (!usedIndices.has(idx)) {
        usedIndices.add(idx)
        // Random duration between 0.2s and 1.4s for faster, more active pulsing
        const duration = 0.2 + Math.random() * 1.2
        // Random delay to desynchronize animations (0s to duration)
        const delay = Math.random() * duration
        nodes.set(idx, { duration, delay })
      }
    }

    return nodes
  }, [unavailableCount]) // Only regenerate when unavailable count changes

  // Adaptive dot configuration based on total GPU count
  const getDotConfig = (total) => {
    if (total >= 200) return { size: 6, gap: 4, cols: 30 }
    if (total >= 100) return { size: 7, gap: 5, cols: 20 }
    if (total >= 40) return { size: 8, gap: 5, cols: 15 }
    return { size: 10, gap: 6, cols: 10 }
  }

  const { size, gap, cols } = getDotConfig(totalSlots)
  const rows = Math.ceil(totalSlots / cols)
  const minHeight = rows * (size + gap) + 16

  return (
    <div className="bg-dark-bg/50 rounded-lg p-4 border border-dark-border hover:border-dark-border-hover transition-all">
      {/* GPU Type Header with Metrics */}
      <div className="mb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="text-base font-bold text-dark-text-primary break-words">{gpu.gpu_type}</h4>
          <div className="relative">
            <span
              className="text-lg font-bold text-green-400 whitespace-nowrap cursor-help"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              {availableCount}
            </span>

            {/* Custom tooltip */}
            {showTooltip && availableCount > 0 && (
              <div className="absolute z-50 right-0 top-full mt-2 w-64 p-3 bg-dark-card border border-dark-border rounded-md shadow-xl">
                <div className="text-xs font-semibold text-dark-text-secondary mb-2">Available Nodes:</div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {nodesWithFree.slice(0, 7).map((node, idx) => (
                    <div key={idx} className="text-xs text-dark-text-primary font-mono">
                      {node}
                    </div>
                  ))}
                  {nodesWithFree.length > 7 && (
                    <div className="text-xs text-dark-text-muted italic">
                      ...and {nodesWithFree.length - 7} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="h-2 bg-dark-bg rounded-full overflow-hidden flex">
            <div
              className="bg-green-500 transition-all duration-500"
              style={{ width: `${(availableCount / totalSlots) * 100}%` }}
              title={`${availableCount} available`}
            />
            <div
              className="bg-amber-500 transition-all duration-500"
              style={{ width: `${(pendingCount / totalSlots) * 100}%` }}
              title={`${pendingCount} pending`}
            />
            <div
              className="bg-zinc-600 transition-all duration-500"
              style={{ width: `${(inUseCount / totalSlots) * 100}%` }}
              title={`${inUseCount} in use`}
            />
          </div>
        </div>

        {/* Stats Line */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="text-green-400 font-medium">{availableCount} free</span>
            {pendingCount > 0 && (
              <span className="text-amber-400">{pendingCount} pending</span>
            )}
            <span className="text-dark-text-muted">{inUseCount} used</span>
          </div>
          <span className="text-dark-text-muted font-medium">{totalSlots} total</span>
        </div>
      </div>

      {/* GPU Dots Visualization */}
      <div
        className="bg-gradient-to-br from-dark-bg to-zinc-900 rounded-md border border-dark-border/50 p-2 relative overflow-hidden"
        style={{ minHeight: `${minHeight}px` }}
      >
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 10px, rgb(100, 100, 100) 10px, rgb(100, 100, 100) 11px), repeating-linear-gradient(90deg, transparent, transparent 10px, rgb(100, 100, 100) 10px, rgb(100, 100, 100) 11px)' }}
        />

        {/* GPU Node Dots */}
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `repeat(${cols}, ${size}px)`,
            gap: `${gap}px`,
            justifyContent: 'center',
            gridAutoRows: `${size}px`
          }}
        >
          {slots.map((status, idx) => {
            // Check if this node should animate and get its timing
            // For unavailable nodes, calculate relative index within unavailable section
            const relativeIdx = status === 'unavailable' ? idx - availableCount : null
            const animationConfig = status === 'unavailable' && relativeIdx !== null
              ? animatedNodes.get(relativeIdx)
              : null
            const shouldAnimate = !!animationConfig

            return (
              <div
                key={idx}
                className={`rounded-sm transition-all ${
                  status === 'available'
                    ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]'
                    : `bg-red-600 shadow-inner ${shouldAnimate ? 'animate-pulse' : ''}`
                }`}
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  animationDuration: shouldAnimate ? `${animationConfig.duration}s` : undefined,
                  animationDelay: shouldAnimate ? `${animationConfig.delay}s` : undefined
                }}
                title={`${status === 'available' ? 'Available' : 'Unavailable'} GPU node`}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ClusterVisualization
