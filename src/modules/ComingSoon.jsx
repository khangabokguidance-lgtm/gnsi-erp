export default function ComingSoon({ page }) {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">{page}</div>
        <div className="page-header-sub">This module is being migrated to React.</div>
      </div>
      <div style={{
        background: '#f8fafc', border: '2px dashed #e2e8f0',
        borderRadius: '16px', padding: '60px', textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚧</div>
        <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
          Coming Soon
        </div>
        <div style={{ fontSize: '14px', color: '#64748b', maxWidth: '400px', margin: '0 auto' }}>
          This module is currently being migrated from the legacy portal.
          It will be available here soon.
        </div>
      </div>
    </div>
  )
}
