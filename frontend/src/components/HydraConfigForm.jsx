import { useState, useEffect } from 'react'

/**
 * Dynamic Hydra configuration form component.
 * Generates form fields based on parsed Hydra config schema.
 */
function HydraConfigForm({ projectId, onConfigChange, initialValues = {} }) {
  const [configSchema, setConfigSchema] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [configValues, setConfigValues] = useState(initialValues)

  useEffect(() => {
    fetchHydraConfig()
  }, [projectId])

  // Update config values when initialValues prop changes (e.g., from cached job)
  useEffect(() => {
    setConfigValues(initialValues)
  }, [initialValues])

  const fetchHydraConfig = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`http://localhost:8028/api/projects/${projectId}/hydra-config`)
      const data = await response.json()

      if (!data.success) {
        setError(data.error)
        setConfigSchema(null)
      } else {
        setConfigSchema(data.ui_schema)

        // Use initial values if provided (from cached previous job), otherwise start empty
        // This prevents sending overrides for groups not in Hydra's defaults list
        setConfigValues(initialValues)
        onConfigChange(initialValues)
      }
    } catch (err) {
      console.error('Error fetching Hydra config:', err)
      setError('Failed to load Hydra configuration')
    } finally {
      setLoading(false)
    }
  }

  const handleGroupChange = (groupName, value, defaultValue) => {
    const newValues = { ...configValues }

    // Only include in overrides if it differs from the default
    if (value !== defaultValue) {
      newValues[groupName] = value
    } else {
      // Remove from overrides if set back to default
      delete newValues[groupName]
    }

    setConfigValues(newValues)
    onConfigChange(newValues)
  }

  const handleParameterChange = (paramKey, value, paramType) => {
    // Parse value based on type
    let parsedValue = value
    if (paramType === 'number') {
      parsedValue = value === '' ? '' : Number(value)
    } else if (paramType === 'checkbox') {
      parsedValue = value
    }

    const newValues = {
      ...configValues,
      [paramKey]: parsedValue
    }
    setConfigValues(newValues)
    onConfigChange(newValues)
  }

  const handleParameterReset = (paramKey) => {
    const newValues = { ...configValues }
    delete newValues[paramKey]
    setConfigValues(newValues)
    onConfigChange(newValues)
  }

  if (loading) {
    return (
      <div className="text-sm text-dark-text-secondary bg-dark-bg p-4 rounded-md border border-dark-border">
        Loading Hydra configuration...
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-sm text-dark-text-secondary bg-dark-bg p-4 rounded-md border border-dark-border">
        <div className="text-yellow-400 mb-2">⚠ No Hydra config found</div>
        <div>{error}</div>
        <div className="mt-2 text-xs text-dark-text-muted">
          Default config will be used. You can still manually specify overrides after implementation.
        </div>
      </div>
    )
  }

  if (!configSchema || (configSchema.groups?.length === 0 && configSchema.parameters?.length === 0)) {
    return (
      <div className="text-sm text-dark-text-secondary bg-dark-bg p-4 rounded-md border border-dark-border">
        No configurable parameters found. Default config will be used.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Config Groups (Model, Data, Training, etc.) */}
      {configSchema.groups && configSchema.groups.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-dark-text-primary mb-3">Configuration Groups</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {configSchema.groups.map(group => {
              const currentValue = configValues[group.name] || group.default || ''
              const isModified = configValues.hasOwnProperty(group.name)

              // Multi-value groups (lists) - show as read-only
              if (group.multi_value) {
                const defaultValues = Array.isArray(group.default) ? group.default : [group.default]
                return (
                  <div key={group.name} className="bg-blue-900/10 border border-blue-700/30 rounded-md p-3">
                    <label className="block text-xs font-medium text-blue-400 mb-1.5 capitalize">
                      {group.name} (multiple)
                    </label>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {defaultValues.map((val, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-900/20 text-blue-300 text-xs rounded">
                          {val}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-dark-text-muted">
                      ℹ Multi-value groups can only be changed via raw overrides
                    </div>
                  </div>
                )
              }

              // Single-value groups - show as dropdown
              return (
                <div key={group.name} className={`${isModified ? 'ring-1 ring-accent-green rounded-md p-2 -m-2' : ''}`}>
                  <label className="block text-xs font-medium text-dark-text-secondary mb-1.5 capitalize">
                    {group.name}
                    {group.default && (
                      <span className="text-dark-text-muted ml-1 font-normal">(default: {group.default})</span>
                    )}
                  </label>
                  <select
                    value={currentValue}
                    onChange={(e) => handleGroupChange(group.name, e.target.value, group.default)}
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-sm text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-accent-green"
                  >
                    {group.options.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Parameters (Hyperparameters, etc.) */}
      {configSchema.parameters && configSchema.parameters.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-dark-text-primary mb-3">Parameters</h4>
          <div className="text-xs text-dark-text-muted mb-3">
            Modify only the parameters you want to override. Leave blank to use defaults.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {configSchema.parameters.map(param => {
              const isModified = configValues.hasOwnProperty(param.key)
              const currentValue = isModified ? configValues[param.key] : param.default

              return (
                <div key={param.key} className={`relative ${isModified ? 'ring-1 ring-accent-green rounded-md p-2 -m-2' : ''}`}>
                  <label className="block text-xs font-medium text-dark-text-secondary mb-1.5">
                    {param.label}
                    <span className="text-dark-text-muted ml-1">(default: {param.default})</span>
                  </label>
                  <div className="flex gap-2">
                    {param.type === 'checkbox' ? (
                      <input
                        type="checkbox"
                        checked={currentValue}
                        onChange={(e) => handleParameterChange(param.key, e.target.checked, param.type)}
                        className="mt-1 h-4 w-4 text-accent-green border-dark-border rounded focus:ring-accent-green"
                      />
                    ) : (
                      <input
                        type={param.type}
                        value={isModified ? currentValue : ''}
                        placeholder={String(param.default)}
                        onChange={(e) => handleParameterChange(param.key, e.target.value, param.type)}
                        step={param.type === 'number' ? 'any' : undefined}
                        className="flex-1 px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-sm text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green"
                      />
                    )}
                    {isModified && (
                      <button
                        type="button"
                        onClick={() => handleParameterReset(param.key)}
                        className="px-2 py-1 text-xs text-dark-text-secondary hover:text-dark-text-primary border border-dark-border rounded hover:bg-dark-card-hover transition-colors"
                        title="Reset to default"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Summary of overrides */}
      {Object.keys(configValues).length > 0 && (
        <div className="bg-accent-green/10 border border-accent-green/30 rounded-md p-3">
          <div className="text-xs font-medium text-accent-green mb-2">
            Active Overrides ({Object.keys(configValues).length}):
          </div>
          <div className="text-xs text-dark-text-primary font-mono space-y-1">
            {Object.entries(configValues).map(([key, value]) => (
              <div key={key}>
                {key}={typeof value === 'string' ? value : JSON.stringify(value)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default HydraConfigForm
