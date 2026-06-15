import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import defaultStandards from '../data/default-standards.json'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [config, setConfigState] = useState({ mealLimit: 140, taxiLimit: 112 })
  const [organizeItems, setOrganizeItems] = useState([]) // items from module 2
  const [toasts, setToasts] = useState([])

  const standards = {}
  defaultStandards.forEach(l1 => {
    const defaultL2 = l1.level2s.find(l2 => l2.name === '全市' || l2.name === '市辖区') || l1.level2s[0]
    standards[l1.level1] = defaultL2
    l1.level2s.forEach(l2 => {
      if (l2.name !== '全市' && l2.name !== '市辖区' && l2.name !== '其他') {
        standards[l2.name] = l2
      }
    })
  })

  // Load config on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('appConfig')
      if (saved) {
        setConfigState(JSON.parse(saved))
      }
    } catch (e) {
      console.error('Failed to load config from localStorage', e)
    }
  }, [])

  const saveConfig = useCallback(async (newConfig) => {
    setConfigState(newConfig)
    try {
      localStorage.setItem('appConfig', JSON.stringify(newConfig))
    } catch (e) {
      console.error('Failed to save config to localStorage', e)
    }
  }, [])

  // Toast system
  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <AppContext.Provider value={{
      config, saveConfig,
      standards,
      organizeItems, setOrganizeItems,
      toasts, addToast, removeToast,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
