import React, { useState, memo } from 'react';
import { NodeResizer, useReactFlow } from 'reactflow';

const NoteCard = ({ data, id }) => {
    const { setNodes } = useReactFlow();
    const [isEditing, setIsEditing] = useState(false);

    // Get dimensions and content from data or use defaults
    const width = data.width || 250;
    const height = data.height || 200;
    const content = data.content || '';

    const handleContentChange = (e) => {
        const newContent = e.target.value;

        // Update node data so it persists
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            content: newContent,
                        },
                    };
                }
                return node;
            })
        );
    };

    const handleDelete = (e) => {
        e.stopPropagation();
        setNodes((nds) => nds.filter((n) => n.id !== id));
    };

    return (
        <div
            className="rounded-lg shadow-lg p-4 relative note-card"
            style={{
                width: `${width}px`,
                height: `${height}px`,
                backgroundColor: '#fef3c7', // Light yellow sticky note color
                border: '2px solid rgba(217, 119, 6, 0.3)',
            }}
        >
            <style>{`
                .note-card {
                    transition: border-color 0.2s ease;
                }
                .note-card:hover {
                    border-color: rgba(217, 119, 6, 0.8) !important;
                }
                
                /* Hide resize handles by default, show on hover */
                .note-card .react-flow__resize-control {
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }
                
                .note-card:hover .react-flow__resize-control {
                    opacity: 1;
                }
            `}</style>
            <NodeResizer
                minWidth={200}
                minHeight={150}
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

            {/* Header with delete button */}
            <div className="flex justify-between items-start mb-2">
                <div className="font-semibold text-sm text-yellow-900 flex items-center gap-2">
                    📝 Note
                </div>
                <button
                    onClick={handleDelete}
                    className="text-lg leading-none hover:text-red-600 transition-colors text-yellow-800"
                    title="Delete note"
                >
                    ×
                </button>
            </div>

            {/* Note content */}
            <textarea
                value={content}
                onChange={handleContentChange}
                placeholder="Type your notes here..."
                className="w-full h-[calc(100%-40px)] resize-none bg-transparent border-none focus:outline-none text-sm text-yellow-900 placeholder-yellow-700/40 font-handwriting"
                style={{
                    fontFamily: "'Segoe Print', 'Comic Sans MS', cursive",
                }}
            />
        </div>
    );
};

export default memo(NoteCard);
