import React, { useState, useEffect, memo } from 'react';
import { Handle, Position, useEdges, useNodes, useReactFlow, NodeResizer } from 'reactflow';
import Plot from 'react-plotly.js';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { getDeterministicColor } from '../../utils/colors';

const WandBCard = ({ data, id }) => {
    const { theme } = useTheme();
    const edges = useEdges();
    const nodes = useNodes();
    const { setNodes } = useReactFlow();

    const [metrics, setMetrics] = useState([]);
    const [selectedMetric, setSelectedMetric] = useState(data.metric || '');
    const [plotData, setPlotData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [connectedRuns, setConnectedRuns] = useState([]);

    // Get dimensions from data or use defaults
    const width = data.width || 400;
    const height = data.height || 320;

    // Handle metric selection change
    const handleMetricChange = (e) => {
        const newMetric = e.target.value;
        setSelectedMetric(newMetric);

        // Update node data so it persists
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            metric: newMetric,
                        },
                    };
                }
                return node;
            })
        );
    };

    // Identify connected job nodes
    useEffect(() => {
        // Find edges where this card is the target
        const incomingEdges = edges.filter(edge => edge.target === id);

        // Get source nodes (jobs)
        const sources = incomingEdges.map(edge => {
            const node = nodes.find(n => n.id === edge.source);
            return node ? {
                id: node.id,
                wandb_url: node.data?.job?.wandb_run_url,
                name: node.data?.job?.name
            } : null;
        }).filter(s => s && s.wandb_url); // Only keep jobs with WandB URLs

        console.log('WandBCard connected runs:', sources);

        // Only update if connected runs actually changed (deep comparison)
        // This prevents re-fetching when nodes are just moved (position changes)
        setConnectedRuns(prev => {
            if (JSON.stringify(prev) === JSON.stringify(sources)) {
                return prev;
            }
            return sources;
        });
    }, [edges, nodes, id]); // Re-run when graph changes

    // Fetch available metrics when connected runs change
    useEffect(() => {
        if (connectedRuns.length === 0) return;

        const fetchMetrics = async () => {
            try {
                // Extract entity/project/run_id from URL
                // Assuming URL format: https://wandb.ai/ENTITY/PROJECT/runs/RUN_ID
                const runIds = connectedRuns.map(run => {
                    const parts = run.wandb_url.split('/');
                    const runIdIndex = parts.indexOf('runs') + 1;
                    let runId = parts[runIdIndex];
                    if (runId && runId.includes('?')) {
                        runId = runId.split('?')[0];
                    }
                    return runId;
                });

                // Use first run to get entity/project (assuming all are same project)
                const firstUrlParts = connectedRuns[0].wandb_url.split('/');
                const entity = firstUrlParts[3];
                const project = firstUrlParts[4];

                console.log('Fetching metrics for:', { entity, project, runIds });

                const response = await api.post('/wandb/metrics', {
                    entity,
                    project,
                    run_ids: runIds
                });

                console.log('Metrics response:', response.data);
                setMetrics(response.data.metrics);

                // Auto-select first metric if none selected
                if (!selectedMetric && response.data.metrics.length > 0) {
                    const defaultMetric = response.data.metrics[0];
                    setSelectedMetric(defaultMetric);

                    // Update node data for default selection too
                    setNodes((nds) =>
                        nds.map((node) => {
                            if (node.id === id) {
                                return {
                                    ...node,
                                    data: {
                                        ...node.data,
                                        metric: defaultMetric,
                                    },
                                };
                            }
                            return node;
                        })
                    );
                }
            } catch (error) {
                console.error("Failed to fetch metrics:", error);
            }
        };

        fetchMetrics();
    }, [connectedRuns]);

    // Fetch plot data when metric is selected
    useEffect(() => {
        if (!selectedMetric || connectedRuns.length === 0) return;

        // Check cache first, but only if connected runs haven't changed
        // Create a stable key for the current set of connected runs
        const connectedRunsKey = JSON.stringify(connectedRuns.map(r => r.id).sort());

        if (data.cachedMetric === selectedMetric &&
            data.cachedPlotData &&
            data.cachedConnectedRunsKey === connectedRunsKey) {
            console.log('Using cached plot data');
            setPlotData(data.cachedPlotData);
            return;
        }

        // Clear cache and fetch new data
        fetchPlotData();
    }, [selectedMetric, connectedRuns]);

    const fetchPlotData = async () => {
        setLoading(true);
        try {
            // Create mapping from run_id to node_id for color consistency
            const runIdToNodeId = {};
            const runIds = connectedRuns.map(run => {
                const parts = run.wandb_url.split('/');
                const runIdIndex = parts.indexOf('runs') + 1;
                let runId = parts[runIdIndex];
                if (runId && runId.includes('?')) {
                    runId = runId.split('?')[0];
                }
                runIdToNodeId[runId] = run.id; // Map run_id to job node ID
                return runId;
            });

            const firstUrlParts = connectedRuns[0].wandb_url.split('/');
            const entity = firstUrlParts[3];
            const project = firstUrlParts[4];

            console.log('Fetching history for:', { entity, project, runIds, selectedMetric });

            const response = await api.post('/wandb/history', {
                entity,
                project,
                run_ids: runIds,
                metric_keys: [selectedMetric]
            });

            console.log('History response:', response.data);

            // Prepare traces for each metric with deterministic colors
            // Use job node ID instead of run_id for color consistency with edges
            const traces = response.data.data.map(trace => {
                const nodeId = runIdToNodeId[trace.run_id] || trace.run_id;
                return {
                    ...trace,
                    line: {
                        color: getDeterministicColor(nodeId),
                        width: 2
                    }
                };
            });

            setPlotData(traces);

            // Cache the data in the node with connected runs key
            const connectedRunsKey = JSON.stringify(connectedRuns.map(r => r.id).sort());
            setNodes((nds) =>
                nds.map((node) => {
                    if (node.id === id) {
                        return {
                            ...node,
                            data: {
                                ...node.data,
                                cachedPlotData: traces,
                                cachedMetric: selectedMetric,
                                cachedConnectedRunsKey: connectedRunsKey
                            },
                        };
                    }
                    return node;
                })
            );

        } catch (error) {
            console.error("Failed to fetch plot data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = (e) => {
        e.stopPropagation();
        fetchPlotData();
    };

    const handleDelete = (e) => {
        e.stopPropagation();
        setNodes((nds) => nds.filter((n) => n.id !== id));
    };

    const layout = {
        width: width - 24, // Account for padding
        height: height - 120, // Account for header and footer
        margin: { l: 40, r: 10, t: 30, b: 30 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: {
            color: theme === 'light' ? '#0f172a' : '#fff'
        },
        xaxis: {
            gridcolor: theme === 'light' ? '#e2e8f0' : '#333',
            zerolinecolor: theme === 'light' ? '#e2e8f0' : '#333',
        },
        yaxis: {
            gridcolor: theme === 'light' ? '#e2e8f0' : '#333',
            zerolinecolor: theme === 'light' ? '#e2e8f0' : '#333',
        },
        legend: {
            orientation: 'h',
            y: -0.2
        }
    };

    return (
        <div
            className={`rounded-lg shadow-lg p-3 transition-colors duration-300 relative wandb-card ${theme === 'light'
                ? 'bg-white'
                : 'bg-neutral-900'
                }`}
            style={{
                width: `${width}px`,
                height: `${height}px`,
                border: '2px solid transparent',
            }}
        >
            <style>{`
                /* Hide all handles by default */
                .wandb-card .react-flow__handle {
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                
                /* Show all handles when connecting */
                .react-flow__node.connecting .wandb-card .react-flow__handle,
                .react-flow.connecting .wandb-card .react-flow__handle {
                    opacity: 1;
                }
                
                /* Always show handles that are connected */
                .wandb-card .react-flow__handle.connected {
                    opacity: 1;
                }
                
                /* Hover effect */
                .wandb-card .react-flow__handle:hover {
                    opacity: 1 !important;
                }
                
                /* Border color change on hover */
                .wandb-card {
                    transition: border-color 0.2s ease;
                }
                
                .wandb-card:hover {
                    border-color: rgba(59, 130, 246, 0.8) !important;
                }
                
                /* Hide resize handles by default, show on hover */
                .wandb-card .react-flow__resize-control {
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }
                
                .wandb-card:hover .react-flow__resize-control {
                    opacity: 1;
                }
            `}</style>

            <NodeResizer
                minWidth={300}
                minHeight={250}
                onResize={(event, params) => {
                    // Update node data with new dimensions
                    setNodes((nds) =>
                        nds.map((node) => {
                            if (node.id === id) {
                                return {
                                    ...node,
                                    data: {
                                        ...node.data,
                                        width: params.width,
                                        height: params.height,
                                    },
                                };
                            }
                            return node;
                        })
                    );
                }}
            />

            {/* Handles on all sides - 3 per side for flexibility */}
            {/* Left side */}
            <Handle
                type="target"
                position={Position.Left}
                id="left-1"
                style={{ top: '25%' }}
                className={edges.some(e => e.target === id && e.targetHandle === 'left-1') ? 'connected' : ''}
            />
            <Handle
                type="target"
                position={Position.Left}
                id="left-2"
                style={{ top: '50%' }}
                className={edges.some(e => e.target === id && e.targetHandle === 'left-2') ? 'connected' : ''}
            />
            <Handle
                type="target"
                position={Position.Left}
                id="left-3"
                style={{ top: '75%' }}
                className={edges.some(e => e.target === id && e.targetHandle === 'left-3') ? 'connected' : ''}
            />

            {/* Right side */}
            <Handle
                type="target"
                position={Position.Right}
                id="right-1"
                style={{ top: '25%' }}
                className={edges.some(e => e.target === id && e.targetHandle === 'right-1') ? 'connected' : ''}
            />
            <Handle
                type="target"
                position={Position.Right}
                id="right-2"
                style={{ top: '50%' }}
                className={edges.some(e => e.target === id && e.targetHandle === 'right-2') ? 'connected' : ''}
            />
            <Handle
                type="target"
                position={Position.Right}
                id="right-3"
                style={{ top: '75%' }}
                className={edges.some(e => e.target === id && e.targetHandle === 'right-3') ? 'connected' : ''}
            />

            {/* Top side */}
            <Handle
                type="target"
                position={Position.Top}
                id="top-1"
                style={{ left: '25%' }}
                className={edges.some(e => e.target === id && e.targetHandle === 'top-1') ? 'connected' : ''}
            />
            <Handle
                type="target"
                position={Position.Top}
                id="top-2"
                style={{ left: '50%' }}
                className={edges.some(e => e.target === id && e.targetHandle === 'top-2') ? 'connected' : ''}
            />
            <Handle
                type="target"
                position={Position.Top}
                id="top-3"
                style={{ left: '75%' }}
                className={edges.some(e => e.target === id && e.targetHandle === 'top-3') ? 'connected' : ''}
            />

            {/* Bottom side */}
            <Handle
                type="target"
                position={Position.Bottom}
                id="bottom-1"
                style={{ left: '25%' }}
                className={edges.some(e => e.target === id && e.targetHandle === 'bottom-1') ? 'connected' : ''}
            />
            <Handle
                type="target"
                position={Position.Bottom}
                id="bottom-2"
                style={{ left: '50%' }}
                className={edges.some(e => e.target === id && e.targetHandle === 'bottom-2') ? 'connected' : ''}
            />
            <Handle
                type="target"
                position={Position.Bottom}
                id="bottom-3"
                style={{ left: '75%' }}
                className={edges.some(e => e.target === id && e.targetHandle === 'bottom-3') ? 'connected' : ''}
            />

            {/* Header with title and close button */}
            <div className="flex justify-between items-start mb-2">
                <div className="font-bold text-sm flex items-center gap-2">
                    <span className="text-blue-500">📈</span> WandB Chart
                    <button
                        onClick={handleRefresh}
                        className={`p-1 hover:bg-opacity-10 hover:bg-gray-500 rounded transition-colors ${loading ? 'opacity-50' : ''}`}
                        title="Refresh data"
                        disabled={loading}
                    >
                        <svg
                            className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                    </button>
                </div>
                <button
                    onClick={handleDelete}
                    className="text-lg leading-none hover:text-red-400 transition-colors"
                    title="Delete card"
                >
                    ×
                </button>
            </div>

            {/* Metric selector */}
            <div className="mb-2">
                <select
                    value={selectedMetric}
                    onChange={handleMetricChange}
                    className={`text-xs p-1 rounded border w-full ${theme === 'light'
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-neutral-800 border-neutral-700'
                        }`}
                >
                    <option value="">Select Metric...</option>
                    {metrics.map(m => (
                        <option key={m} value={m}>{m}</option>
                    ))}
                </select>
            </div>

            <div
                className="flex items-center justify-center bg-opacity-50 rounded overflow-hidden"
                style={{ height: `${height - 120}px` }}
            >
                {loading ? (
                    <div className="text-xs opacity-50">Loading data...</div>
                ) : connectedRuns.length === 0 ? (
                    <div className="text-xs opacity-50 text-center p-4">
                        Connect job nodes with WandB URLs to visualize data
                    </div>
                ) : plotData.length > 0 ? (
                    <Plot
                        data={plotData}
                        layout={layout}
                        config={{ displayModeBar: false }}
                    />
                ) : (
                    <div className="text-xs opacity-50">No data available</div>
                )}
            </div>

            <div className="mt-2 text-[10px] opacity-50 text-right">
                {connectedRuns.length} runs connected
            </div>
        </div>
    );
};

export default memo(WandBCard);
