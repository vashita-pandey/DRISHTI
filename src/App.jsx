import { useState } from 'react'
import LiveScan from './components/LiveScan'
import HistoryGraph from './components/HistoryGraph'
import './index.css'

export default function App() {
  const [activeTab, setActiveTab] = useState('livescan')

  return (
    <div className="app" style={{ justifyContent: 'flex-start', padding: '24px 16px' }}>
      <h1 style={{ marginBottom: 4 }}>DRISHTI</h1>
      <p style={{ marginBottom: 20 }}>Edge AI for Aerospace Inspection</p>

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