import { STATUS_COLOR } from '../utils/hostelUtils';

export default function StatusBadge({ label, color }) {
  const c = color || STATUS_COLOR[label] || '#6b7280';
  return (
    <span style={{
      padding: '2px 9px',
      borderRadius: 10,
      fontSize: 10.5,
      fontWeight: 700,
      background: c + '22',
      color: c,
      border: `1px solid ${c}55`,
    }}>
      {label}
    </span>
  );
}
