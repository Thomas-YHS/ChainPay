interface Props {
  onClose: () => void
  onAdded: () => void
}
export default function AddEmployeeModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="p-6 rounded-xl" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
        <p style={{ color: '#fff' }}>AddEmployeeModal — coming in Task 8</p>
        <button onClick={onClose} style={{ color: '#94a3b8', marginTop: 12 }}>关闭</button>
      </div>
    </div>
  )
}
