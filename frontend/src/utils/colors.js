const COLORS = [
    '#EF4444', // Red
    '#F97316', // Orange
    '#F59E0B', // Amber
    '#84CC16', // Lime
    '#10B981', // Emerald
    '#06B6D4', // Cyan
    '#3B82F6', // Blue
    '#6366F1', // Indigo
    '#8B5CF6', // Violet
    '#D946EF', // Fuchsia
    '#F43F5E'  // Rose
];

export const getDeterministicColor = (str) => {
    if (!str) return COLORS[0];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return COLORS[Math.abs(hash) % COLORS.length];
};
