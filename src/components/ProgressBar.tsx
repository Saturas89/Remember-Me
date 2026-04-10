interface Props {
  value: number  // 0–100
  label?: string
}

export function ProgressBar({ value, label }: Props) {
  return (
    <div className="progress-bar-wrap">
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${value}%` }} />
      </div>
      {label && <span className="progress-bar-label">{label}</span>}
    </div>
  )
}
