import { useState, useCallback, useEffect, useMemo } from 'react'
import ReactFlow, {
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    MarkerType,
    ReactFlowProvider,
    addEdge,
    useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useNavigate, useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getJobs, getProject, updateCanvasState } from '../services/api'
import { formatRuntime } from '../utils/formatRuntime'
import { useTheme } from '../context/ThemeContext'
import WandBCard from '../components/canvas/WandBCard'
import NoteCard from '../components/canvas/NoteCard'
import { getDeterministicColor } from '../utils/colors'

const statusColors = {
    COMPLETED: '#10B981', // Green
    RUNNING: '#3B82F6',   // Blue
    PENDING: '#F59E0B',   // Yellow
    FAILED: '#EF4444',    // Red
    CANCELLED: '#6B7280', // Gray
    SUBMITTING: '#8B5CF6', // Purple
}

const nodeTypes = {
    wandb: WandBCard,
    note: NoteCard,
}

function CanvasView() {
    const { projectId } = useParams()

    return (
        <ReactFlowProvider>
            <CanvasViewInner projectId={projectId} />
        </ReactFlowProvider>
    )
}

function CanvasViewInner({ projectId }) {
    const navigate = useNavigate()
    const { theme } = useTheme()
    const reactFlowInstance = useReactFlow()

    // Custom node style - dynamic based on theme
    const nodeStyle = useMemo(() => ({
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '10px',
        width: 280,
        fontSize: '12px',
    }), [theme])

    // Data state
    const [project, setProject] = useState(null)
    const [allJobs, setAllJobs] = useState([])
    const [visibleJobIds, setVisibleJobIds] = useState(new Set())
    const [loading, setLoading] = useState(true)

    // UI state
    const [searchTerm, setSearchTerm] = useState('')
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [saving, setSaving] = useState(false)
    const [selectedEdge, setSelectedEdge] = useState(null)  // For diff modal

    // React Flow state
    const [nodes, setNodes, onNodesChange] = useNodesState([])
    const [edges, setEdges, onEdgesChange] = useEdgesState([])
    const [autoSaveTimeout, setAutoSaveTimeout] = useState(null)
    const [restoredWandbEdges, setRestoredWandbEdges] = useState([])

    const onConnect = useCallback(
        (params) => {
            const isWandBConnection = params.target.startsWith('wandb-')
            let newEdge = { ...params, type: 'default' }

            if (isWandBConnection) {
                const color = getDeterministicColor(params.source)
                newEdge = {
                    ...newEdge,
                    style: { stroke: color, strokeWidth: 2 },
                    animated: true,
                }
            }
            setEdges((eds) => addEdge(newEdge, eds))
        },
        [setEdges],
    )

    useEffect(() => {
        fetchData()

        // Auto-refresh removed per user request
        /*
        const interval = setInterval(() => {
            fetchData()
        }, 30000)
        */

        // Refresh when user returns to the tab - REMOVED per user request
        /*
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                fetchData()
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        */

        return () => {
            // clearInterval(interval)
            // document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [projectId])

    // Auto-save layout when nodes change (debounced)
    useEffect(() => {
        if (nodes.length > 0) {
            // Clear existing timeout
            if (autoSaveTimeout) {
                clearTimeout(autoSaveTimeout)
            }

            // Set new timeout to save after 2 seconds of no changes
            const timeout = setTimeout(() => {
                saveCanvasStateQuietly()
            }, 2000)

            setAutoSaveTimeout(timeout)
        }

        return () => {
            if (autoSaveTimeout) {
                clearTimeout(autoSaveTimeout)
            }
        }
    }, [nodes, edges]) // Also trigger on edges change

    // Rebuild graph whenever visible jobs change
    useEffect(() => {
        if (allJobs.length > 0) {
            const { nodes: layoutNodes, edges: layoutEdges } = buildGraph(allJobs, visibleJobIds)

            // Merge with existing nodes to preserve WandB and Note cards
            setNodes(prevNodes => {
                const wandbNodes = prevNodes.filter(n => n.type === 'wandb')
                const noteNodes = prevNodes.filter(n => n.type === 'note')

                // Update existing job nodes positions if they exist in new layout
                const updatedLayoutNodes = layoutNodes.map(n => {
                    const existing = prevNodes.find(pn => pn.id === n.id)
                    if (existing) {
                        return { ...n, position: existing.position }
                    }
                    return n
                })

                return [...updatedLayoutNodes, ...wandbNodes, ...noteNodes]
            })

            // Merge with existing WandB edges
            setEdges(prevEdges => {
                const wandbEdgesToKeep = prevEdges.length > 0
                    ? prevEdges.filter(e => e.target.startsWith('wandb-'))
                    : restoredWandbEdges

                return [...layoutEdges, ...wandbEdgesToKeep]
            })
        }
    }, [visibleJobIds, allJobs, project, theme, restoredWandbEdges])

    const fetchData = async () => {
        try {
            setLoading(true)
            const [projectData, jobsData] = await Promise.all([
                getProject(projectId),
                getJobs(projectId, true) // Fetch all jobs for this project, including archived
            ])
            setProject(projectData)
            setAllJobs(jobsData)

            // Build initial visible set
            let initialVisibleIds = new Set()

            // Try to restore saved canvas state
            if (projectData.canvas_state) {
                try {
                    const savedState = JSON.parse(projectData.canvas_state)
                    if (savedState.visibleJobIds) {
                        initialVisibleIds = new Set(savedState.visibleJobIds)
                    }
                    // Restore WandB nodes if any
                    if (savedState.wandbNodes) {
                        setNodes(prev => [...prev, ...savedState.wandbNodes])
                    }
                    // Restore Note nodes if any
                    if (savedState.noteNodes) {
                        setNodes(prev => [...prev, ...savedState.noteNodes])
                    }
                    // Restore WandB edges if any
                    if (savedState.wandbEdges) {
                        setRestoredWandbEdges(savedState.wandbEdges)
                    }
                } catch (e) {
                    console.error('Failed to parse canvas state:', e)
                    // Fall back to showing recent jobs
                    const recentIds = jobsData.slice(0, 3).map(j => j.id)
                    recentIds.forEach(id => initialVisibleIds.add(id))
                }
            } else {
                // Show the last 3 jobs by default
                const recentIds = jobsData.slice(0, 3).map(j => j.id)
                recentIds.forEach(id => initialVisibleIds.add(id))
            }

            // Always add running and pending jobs to the visible set
            jobsData.forEach(job => {
                if (job.slurm_status === 'RUNNING' || job.slurm_status === 'PENDING') {
                    initialVisibleIds.add(job.id)
                }
            })

            setVisibleJobIds(initialVisibleIds)

        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setLoading(false)
        }
    }

    const toggleJobVisibility = (jobId) => {
        const newSet = new Set(visibleJobIds)
        if (newSet.has(jobId)) {
            newSet.delete(jobId)
        } else {
            newSet.add(jobId)
        }
        setVisibleJobIds(newSet)
    }

    const addJobAndLineage = (job) => {
        const newSet = new Set(visibleJobIds)
        newSet.add(job.id)

        // Add parent if exists
        if (job.parent_job_id) {
            newSet.add(job.parent_job_id)
        }

        // Add children
        allJobs.forEach(j => {
            if (j.parent_job_id === job.id) {
                newSet.add(j.id)
            }
        })

        setVisibleJobIds(newSet)
    }

    const addWandBCard = () => {
        const id = `wandb-${Date.now()}`

        // Get the center of the current viewport
        const { x, y, zoom } = reactFlowInstance.getViewport()
        const flow = reactFlowInstance.getViewport()

        // Calculate center position in flow coordinates
        const centerX = -x / zoom + (window.innerWidth / 2) / zoom
        const centerY = -y / zoom + (window.innerHeight / 2) / zoom

        const newNode = {
            id,
            type: 'wandb',
            position: { x: centerX - 200, y: centerY - 160 }, // Offset to center the card
            data: { metric: '' },
        }
        setNodes((nds) => nds.concat(newNode))
    }

    const addNoteCard = () => {
        const id = `note-${Date.now()}`

        // Get the center of the current viewport
        const { x, y, zoom } = reactFlowInstance.getViewport()

        // Calculate center position in flow coordinates
        const centerX = -x / zoom + (window.innerWidth / 2) / zoom
        const centerY = -y / zoom + (window.innerHeight / 2) / zoom

        const newNode = {
            id,
            type: 'note',
            position: { x: centerX - 125, y: centerY - 100 }, // Offset to center the card
            data: { content: '' },
        }
        setNodes((nds) => nds.concat(newNode))
    }

    const saveCanvasState = async () => {
        try {
            setSaving(true)
            const wandbNodes = nodes.filter(n => n.type === 'wandb')
            const noteNodes = nodes.filter(n => n.type === 'note')
            const wandbEdges = edges.filter(e => e.target.startsWith('wandb-'))
            const state = {
                visibleJobIds: Array.from(visibleJobIds),
                nodePositions: nodes.reduce((acc, node) => {
                    acc[node.id] = node.position
                    return acc
                }, {}),
                wandbNodes,
                noteNodes,
                wandbEdges
            }
            await updateCanvasState(projectId, JSON.stringify(state))
            toast.success('Canvas layout saved!')
        } catch (error) {
            console.error('Error saving canvas state:', error)
            toast.error('Failed to save canvas layout')
        } finally {
            setSaving(false)
        }
    }

    const saveCanvasStateQuietly = async () => {
        try {
            const wandbNodes = nodes.filter(n => n.type === 'wandb')
            const noteNodes = nodes.filter(n => n.type === 'note')
            const wandbEdges = edges.filter(e => e.target.startsWith('wandb-'))
            const state = {
                visibleJobIds: Array.from(visibleJobIds),
                nodePositions: nodes.reduce((acc, node) => {
                    acc[node.id] = node.position
                    return acc
                }, {}),
                wandbNodes,
                noteNodes,
                wandbEdges
            }
            await updateCanvasState(projectId, JSON.stringify(state))
            // Silently save - no toast notification
        } catch (error) {
            console.error('Error auto-saving canvas state:', error)
            // Don't show error toast for auto-save
        }
    }

    // ============ Graph Builder Utilities ============

    /**
     * Calculate similarity score between two jobs (0-1)
     * Weighs: Hydra config (50%), SLURM params (30%), config_name (20%)
     */
    const calculateConfigSimilarity = (job1, job2) => {
        let matches = 0
        let total = 0

        // Compare SLURM params (weighted 30%)
        const slurmFields = ['cluster', 'partition', 'gpu_type', 'num_nodes',
            'gpus_per_node', 'cpus_per_task', 'memory', 'time_limit']
        slurmFields.forEach(field => {
            total += 0.3 / slurmFields.length
            if (job1[field] === job2[field]) {
                matches += 0.3 / slurmFields.length
            }
        })

        // Compare Hydra config (weighted 50%)
        const hydra1 = job1.hydra_overrides || {}
        const hydra2 = job2.hydra_overrides || {}
        const allKeys = new Set([...Object.keys(hydra1), ...Object.keys(hydra2)])

        if (allKeys.size > 0) {
            allKeys.forEach(key => {
                total += 0.5 / allKeys.size
                if (JSON.stringify(hydra1[key]) === JSON.stringify(hydra2[key])) {
                    matches += 0.5 / allKeys.size
                }
            })
        } else {
            total += 0.5
            matches += 0.5 // Both have no hydra config, consider it a match
        }

        // Compare config_name (weighted 20%)
        total += 0.2
        if (job1.config_name === job2.config_name) {
            matches += 0.2
        }

        return total > 0 ? matches / total : 0
    }

    /**
     * Infer best parent for a job using temporal + similarity scoring
     * Returns the job ID of the inferred parent, or null
     */
    const inferParent = (job, candidateJobs) => {
        // Filter to jobs submitted before this one
        const candidates = candidateJobs.filter(j =>
            new Date(j.submitted_at) < new Date(job.submitted_at)
        )

        if (candidates.length === 0) return null

        // Time window: 7 days
        const timeWindowMs = 7 * 24 * 60 * 60 * 1000
        const jobTime = new Date(job.submitted_at).getTime()

        // Score each candidate
        const scored = candidates.map(candidate => {
            const similarity = calculateConfigSimilarity(job, candidate)
            const timeDelta = jobTime - new Date(candidate.submitted_at).getTime()
            const timeScore = Math.max(0, 1 - (timeDelta / timeWindowMs))

            return {
                jobId: candidate.id,
                score: 0.7 * similarity + 0.3 * timeScore,
                similarity,
                timeScore
            }
        })

        // Sort by score and return best match if above threshold
        scored.sort((a, b) => b.score - a.score)
        const bestMatch = scored[0]

        // Threshold: only infer if score > 0.5
        return bestMatch && bestMatch.score > 0.5 ? bestMatch.jobId : null
    }

    /**
     * Calculate config differences between parent and child jobs
     * Returns object with changed fields
     */
    const getConfigDiff = (parentJob, childJob) => {
        const diff = {}

        // Check Hydra overrides
        const p = parentJob.hydra_overrides || {}
        const c = childJob.hydra_overrides || {}
        const allKeys = new Set([...Object.keys(p), ...Object.keys(c)])

        allKeys.forEach(key => {
            if (JSON.stringify(p[key]) !== JSON.stringify(c[key])) {
                diff[key] = { from: p[key], to: c[key] }
            }
        })

        // Check important SLURM params
        const slurmFields = ['gpu_type', 'num_nodes', 'gpus_per_node', 'memory', 'time_limit']
        slurmFields.forEach(field => {
            if (parentJob[field] !== childJob[field]) {
                diff[field] = { from: parentJob[field], to: childJob[field] }
            }
        })

        // Check config_name
        if (parentJob.config_name !== childJob.config_name) {
            diff.config_name = { from: parentJob.config_name, to: childJob.config_name }
        }

        return diff
    }

    /**
     * Format config diff into a readable edge label
     * Shows only the first/most important change clearly
     */
    const formatEdgeLabel = (diff) => {
        const changeCount = Object.keys(diff).length
        if (changeCount === 0) return ''

        // Show only first change, clearly
        const [firstKey, firstChange] = Object.entries(diff)[0]
        const displayKey = firstKey.length > 15 ? firstKey.slice(0, 13) + '...' : firstKey

        if (changeCount === 1) {
            return `${displayKey}: ${firstChange.from}→${firstChange.to}`
        } else {
            return `${displayKey} (+${changeCount - 1} more)`
        }
    }

    const buildGraph = (jobs, visibleIds) => {
        const visibleJobs = jobs.filter(j => visibleIds.has(j.id))
        const jobMap = new Map(visibleJobs.map(j => [j.id, j]))
        const childrenMap = new Map()
        const edgeMetadata = new Map() // Track edge type and diff

        // Check if we have saved positions to restore
        let savedPositions = {}
        if (project?.canvas_state) {
            try {
                const savedState = JSON.parse(project.canvas_state)
                savedPositions = savedState.nodePositions || {}
            } catch (e) {
                console.error('Failed to parse saved positions:', e)
            }
        }

        // Step 1: Build parent relationships (explicit + inferred)
        visibleJobs.forEach(job => {
            let parentId = job.parent_job_id

            // If no explicit parent, try to infer one
            if (!parentId) {
                parentId = inferParent(job, visibleJobs)
            }

            // Add to children map if parent exists and is visible
            if (parentId && jobMap.has(parentId)) {
                if (!childrenMap.has(parentId)) {
                    childrenMap.set(parentId, [])
                }
                childrenMap.get(parentId).push(job)

                // Track edge metadata
                const isExplicit = !!job.parent_job_id
                const parentJob = jobMap.get(parentId)
                const diff = getConfigDiff(parentJob, job)

                edgeMetadata.set(`${parentId}-${job.id}`, {
                    isExplicit,
                    diff,
                    label: formatEdgeLabel(diff)
                })
            }
        })

        // Find roots (jobs with no parent or parent not visible)
        const roots = visibleJobs.filter(j => {
            const hasExplicitParent = j.parent_job_id && jobMap.has(j.parent_job_id)
            const hasInferredParent = !j.parent_job_id && inferParent(j, visibleJobs) && jobMap.has(inferParent(j, visibleJobs))
            return !hasExplicitParent && !hasInferredParent
        })

        const nodes = []
        const edges = []
        let globalX = 0

        // Simple layout algorithm
        const traverse = (job, depth) => {
            const children = childrenMap.get(job.id) || []

            const myX = globalX
            const myY = depth * 150

            if (children.length === 0) {
                globalX += 1
            }

            // Use saved position if available, otherwise use calculated position
            const nodePosition = savedPositions[job.id] || { x: myX * 250, y: myY }

            nodes.push({
                id: job.id,
                data: {
                    job, // Pass full job data for WandB connection
                    label: (
                        <div className="flex flex-col gap-1 relative">
                            {/* Header: Name + Close */}
                            <div className="flex justify-between items-start">
                                <div className="font-bold truncate w-32 text-sm" title={job.name}>{job.name}</div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        toggleJobVisibility(job.id)
                                    }}
                                    className="text-dark-text-muted hover:text-red-400 text-lg leading-none"
                                    title="Remove from canvas"
                                >
                                    ×
                                </button>
                            </div>

                            {/* Status */}
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ background: statusColors[job.slurm_status] || '#666' }} />
                                <span className="text-xs opacity-70">{job.slurm_status}</span>
                            </div>

                            {/* Commit + WandB + Runtime + Date (inline) */}
                            <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
                                <span className="font-mono opacity-50">{job.commit_sha?.substring(0, 7)}</span>
                                {job.wandb_run_url && (
                                    <>
                                        <span className="opacity-30">•</span>
                                        <a
                                            href={job.wandb_run_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-blue-400 hover:text-blue-300 underline"
                                            title="View on WandB"
                                        >
                                            WandB
                                        </a>
                                    </>
                                )}
                                <span className="opacity-30">•</span>
                                <span className="opacity-50">{formatRuntime(job.runtime_seconds)}</span>
                                <span className="opacity-30">•</span>
                                <span className="opacity-50">{new Date(job.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>

                            {/* Description */}
                            {job.description && (
                                <div className="text-[10px] opacity-60 line-clamp-2 mt-0.5 text-left" title={job.description}>
                                    {job.description}
                                </div>
                            )}

                            {/* Branch button - small circular plus */}
                            <button
                                className="absolute -bottom-2 -right-2 w-5 h-5 bg-accent-green hover:bg-accent-green-hover text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleBranch(job)
                                }}
                                title="Branch from this job"
                            >
                                +
                            </button>
                        </div>
                    )
                },
                position: nodePosition,
                style: {
                    ...nodeStyle,
                    transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
                },
                className: 'job-node',
            })

            children.forEach((child) => {
                const edgeId = `${job.id}-${child.id}`
                const metadata = edgeMetadata.get(edgeId) || { isExplicit: true, label: '', diff: {} }

                edges.push({
                    id: edgeId,
                    source: job.id,
                    target: child.id,
                    type: 'default', // Bezier curves for smooth, curvy edges
                    label: metadata.label,
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: metadata.isExplicit ? '#10B981' : '#3B82F6'
                    },
                    style: {
                        stroke: metadata.isExplicit ? '#10B981' : '#3B82F6',
                        strokeWidth: metadata.isExplicit ? 2 : 1,
                        strokeDasharray: metadata.isExplicit ? '0' : '5,5',
                        opacity: metadata.isExplicit ? 1 : 0.7
                    },
                    labelStyle: {
                        fill: theme === 'light' ? '#0f172a' : '#fff',
                        fontSize: 10,
                        fontFamily: 'monospace'
                    },
                    labelBgStyle: {
                        fill: theme === 'light' ? '#f8fafc' : '#1a1a1a',
                        fillOpacity: 0.8
                    },
                    data: {
                        isExplicit: metadata.isExplicit,
                        diff: metadata.diff
                    }
                })
                traverse(child, depth + 1)
            })
        }

        roots.forEach(root => {
            traverse(root, 0)
            globalX += 0.5
        })

        return { nodes, edges }
    }

    const handleBranch = (job) => {
        navigate(`/project/${job.project_id}/launch`, {
            state: {
                config: {
                    description: job.description,
                    cluster_name: job.cluster,
                    partition: job.partition,
                    gpu_type: job.gpu_type,
                    num_nodes: job.num_nodes,
                    gpus_per_node: job.gpus_per_node,
                    cpus_per_task: job.cpus_per_task,
                    memory: job.memory,
                    time_limit: job.time_limit,
                    config_name: job.config_name,
                    hydra_overrides: job.hydra_overrides,
                    raw_hydra_overrides: job.raw_hydra_overrides,
                },
                clonedFrom: {
                    jobId: job.id,
                    jobName: job.name,
                    commitSha: job.commit_sha
                }
            }
        })
    }

    const filteredJobs = useMemo(() => {
        return allJobs.filter(job =>
            job.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.id.includes(searchTerm)
        )
    }, [allJobs, searchTerm])

    return (
        <div className="flex h-[calc(100vh-64px)] bg-dark-bg overflow-hidden transition-colors duration-300">
            <style>{`
                /* Job node hover border effect */
                .react-flow__node.job-node > div {
                    transition: border-color 0.2s ease;
                }
                .react-flow__node.job-node:hover > div {
                    border-color: rgba(16, 185, 129, 0.8) !important;
                }
                
                /* Hide React Flow's default selection outline for custom cards */
                .react-flow__node[data-type="wandb"].selected,
                .react-flow__node[data-type="note"].selected {
                    outline: none !important;
                }
                
                /* Remove the blue selection ring */
                .react-flow__node[data-type="wandb"] .react-flow__handle,
                .react-flow__node[data-type="note"] .react-flow__handle {
                    border: 1px solid transparent;
                }
                
                /* Hide React Flow attribution */
                .react-flow__attribution {
                    display: none;
                }
            `}</style>
            {/* Sidebar */}
            <div className={`flex-shrink-0 bg-dark-card border-r border-dark-border transition-all duration-300 flex flex-col overflow-hidden ${sidebarOpen ? 'w-80' : 'w-0'}`}>
                <div className="p-4 border-b border-dark-border flex justify-between items-center">
                    <h2 className="font-bold text-dark-text-primary">Experiments</h2>
                    <div className="text-xs text-dark-text-muted">{allJobs.length} total</div>
                </div>

                <div className="p-4 border-b border-dark-border">
                    <input
                        type="text"
                        placeholder="Search jobs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent-green"
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {filteredJobs.map(job => {
                        const isVisible = visibleJobIds.has(job.id)
                        return (
                            <div
                                key={job.id}
                                className={`p-3 rounded-md border transition-colors ${isVisible
                                    ? 'bg-accent-green/10 border-accent-green/30'
                                    : 'bg-dark-bg border-dark-border hover:border-dark-text-muted'
                                    }`}
                            >
                                {/* Header: Name + Status */}
                                <div className="flex justify-between items-start mb-2">
                                    <div className="font-medium text-sm text-dark-text-primary truncate w-40" title={job.name}>
                                        {job.name}
                                    </div>
                                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: statusColors[job.slurm_status] || '#666' }} />
                                </div>

                                {/* Description */}
                                {job.description && (
                                    <div className="text-xs text-dark-text-secondary mb-2 line-clamp-2" title={job.description}>
                                        {job.description}
                                    </div>
                                )}

                                {/* Info: Commit + Runtime + Date */}
                                <div className="text-xs text-dark-text-muted mb-2 space-y-0.5">
                                    <div className="font-mono text-[10px]">{job.commit_sha?.substring(0, 7)}</div>
                                    <div>{formatRuntime(job.runtime_seconds)}</div>
                                    <div>{new Date(job.submitted_at).toLocaleDateString()}</div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => toggleJobVisibility(job.id)}
                                        className={`flex-1 text-xs py-1 px-2 rounded border ${isVisible
                                            ? 'border-red-900/30 text-red-400 hover:bg-red-900/20'
                                            : 'border-dark-border text-dark-text-secondary hover:bg-dark-card-hover'
                                            }`}
                                    >
                                        {isVisible ? 'Remove' : 'Add'}
                                    </button>
                                    <button
                                        onClick={() => addJobAndLineage(job)}
                                        className="flex-1 text-xs py-1 px-2 rounded border border-dark-border text-dark-text-secondary hover:bg-dark-card-hover"
                                        title="Add job + parent + children"
                                    >
                                        + Lineage
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Main Canvas Area */}
            <div className="flex-1 relative">
                {/* Toggle Sidebar Button */}
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="absolute top-4 left-4 z-10 bg-dark-card border border-dark-border p-2 rounded-md text-dark-text-secondary hover:text-white shadow-lg"
                >
                    {sidebarOpen ? '←' : '→'}
                </button>

                {/* Project Header Overlay */}
                <div className="absolute top-4 left-16 right-4 z-10 pointer-events-none flex justify-between">
                    <div className="bg-dark-card/80 backdrop-blur border border-dark-border px-4 py-2 rounded-md pointer-events-auto">
                        <Link to={`/project/${projectId}`} className="text-xs text-dark-text-muted hover:text-accent-green mb-1 block">
                            ← Back to Project
                        </Link>
                        <h1 className="font-bold text-dark-text-primary">
                            {project?.name} <span className="font-normal text-dark-text-secondary">Canvas</span>
                        </h1>
                    </div>

                    <div className="flex gap-2 pointer-events-auto">
                        <div className="bg-dark-card/80 backdrop-blur border border-dark-border px-4 py-2 rounded-md">
                            <div className="text-xs text-dark-text-muted">Visible Jobs</div>
                            <div className="font-mono text-lg text-accent-green">{visibleJobIds.size}</div>
                        </div>
                    </div>
                </div>

                {/* Floating toolbar at bottom center */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-auto">
                    <div className="bg-dark-card/90 backdrop-blur-md border border-dark-border rounded-full shadow-2xl px-2 py-2 flex gap-2">
                        <button
                            onClick={addWandBCard}
                            className="group relative w-10 h-10 rounded-full hover:bg-blue-600/20 transition-all flex items-center justify-center"
                            title="Add Chart"
                        >
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </button>
                        <button
                            onClick={addNoteCard}
                            className="group relative w-10 h-10 rounded-full hover:bg-yellow-600/20 transition-all flex items-center justify-center"
                            title="Add Note"
                        >
                            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-full text-dark-text-secondary">
                        Loading...
                    </div>
                ) : (
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onEdgeClick={(event, edge) => setSelectedEdge(edge)}
                        nodeTypes={nodeTypes}
                        fitView
                        minZoom={0.1}
                        maxZoom={1.5}
                        defaultEdgeOptions={{ type: 'smoothstep' }}
                    >
                        <Background color={theme === 'light' ? '#e2e8f0' : '#333'} gap={16} />
                        <Controls className="bg-dark-card border-dark-border text-dark-text-primary" />
                    </ReactFlow>
                )}
            </div>

            {/* Diff Modal */}
            {selectedEdge && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedEdge(null)}>
                    <div className="bg-dark-card border border-dark-border rounded-lg p-6 max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-dark-text-primary">Configuration Changes</h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id))
                                        setSelectedEdge(null)
                                    }}
                                    className="text-red-400 hover:text-red-300 text-sm px-3 py-1 rounded border border-red-900/30 hover:bg-red-900/20 transition-colors"
                                >
                                    Delete Connection
                                </button>
                                <button
                                    onClick={() => setSelectedEdge(null)}
                                    className="text-dark-text-muted hover:text-white text-2xl leading-none"
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        <div className="max-h-96 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-dark-bg sticky top-0">
                                    <tr>
                                        <th className="text-left p-2 text-dark-text-secondary">Parameter</th>
                                        <th className="text-left p-2 text-dark-text-secondary">From</th>
                                        <th className="text-left p-2 text-dark-text-secondary">To</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(selectedEdge.data?.diff || {}).map(([key, { from, to }]) => (
                                        <tr key={key} className="border-t border-dark-border">
                                            <td className="p-2 font-mono text-xs text-accent-green">{key}</td>
                                            <td className="p-2 text-red-400 font-mono text-xs">{String(from)}</td>
                                            <td className="p-2 text-green-400 font-mono text-xs">{String(to)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-4 text-xs text-dark-text-muted">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 rounded" style={{ backgroundColor: selectedEdge.data?.isExplicit ? '#10B981' : '#3B82F6', opacity: 0.3 }}></span>
                                <span>{selectedEdge.data?.isExplicit ? 'Explicit branch' : 'Inferred lineage'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default CanvasView
