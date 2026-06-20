import { useState, useEffect } from 'react'
import LiveScan from './components/LiveScan'
import HistoryGraph from './components/HistoryGraph'
import { db } from './db/db'
import './index.css'

export default function App() {
  const [activeTab, setActiveTab] = useState('livescan')
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    async function checkPending() {
      const all = await db.inspections.toArray()
      const pending = all.filter(r => r.syncStatus === 'pending').length
      setPendingCount(pending)
    }
    checkPending()
    const interval = setInterval(checkPending, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="app" style={{ justifyContent: 'flex-start', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 480, marginBottom: 4, textAlign: 'center' }}>
        <h1>DRISHTI</h1>
        {/* Sync status badge — floats top right */}
        <div style={{
          position: 'absolute', top: 0, right: 0,
          background: pendingCount > 0 ? '#1e3a5f' : '#0f2d1a',
          border: `1px solid ${pendingCount > 0 ? '#3b82f6' : '#166534'}`,
          borderRadius: 6, padding: '4px 10px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: pendingCount > 0 ? '#60a5fa' : '#22c55e'
          }} />
          <span style={{
            fontSize: 11,
            color: pendingCount > 0 ? '#93c5fd' : '#86efac'
          }}>
            {pendingCount > 0 ? `${pendingCount} pending` : 'Synced'}
          </span>
        </div>
      </div>
      <p style={{ marginBottom: 20 }}>Edge AI for Aerospace Inspection</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['livescan', 'history'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: activeTab === tab ? '#00c2ff' : '#1e2d40',
              color: activeTab === tab ? '#0a0f1a' : '#94a3b8',
              border: 'none', borderRadius: 6,
              padding: '8px 20px', fontSize: 14,
              fontWeight: activeTab === tab ? 700 : 400,
              cursor: 'pointer'
            }}
          >
            {tab === 'livescan' ? '📷 LiveScan' : '📊 HistoryGraph'}
          </button>
        ))}
      </div>

      {activeTab === 'livescan'
        ? <LiveScan onViewHistory={() => setActiveTab('history')} />
        : <HistoryGraph />}

    </div>
  )
}