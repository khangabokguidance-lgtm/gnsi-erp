// Catches a crash inside the Mission Sainik module so the rest of the portal keeps working.
import { Component } from 'react'

export default class MissionSainikBoundary extends Component {
  constructor(props) { super(props); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err, info) { console.error('MissionSainik crashed', err, info?.componentStack) }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div role="alert" style={{ padding: 28, margin: 16, borderRadius: 16, background: '#fff', border: '1px solid #f1c4c4', color: '#7a1f1f', fontFamily: 'inherit' }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>Mission Sainik hit a problem</div>
        <div style={{ margin: '8px 0 14px', fontSize: 13.5 }}>Nothing you saved is lost. Reload this screen and try again; if it keeps happening, tell the admin what you were doing.</div>
        <details style={{ margin: '0 0 14px', fontSize: 12.5 }}><summary style={{ cursor: 'pointer' }}>Technical details (send this to the admin)</summary><pre style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>{String(this.state.err?.message || this.state.err)}</pre></details>
        <button onClick={() => this.setState({ err: null })} style={{ padding: '9px 16px', borderRadius: 10, border: 0, background: '#132a4f', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Reload this screen</button>
      </div>
    )
  }
}
