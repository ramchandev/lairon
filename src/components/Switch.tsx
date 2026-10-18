export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="switch"
    />
  )
}

/** The prototype's "Active" row: label + hint on the left, switch on the right. */
export function SwitchRow({
  label,
  hint,
  ...rest
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="field full switch-row">
      <span>
        <span className="lbl">{label}</span>
        {hint && <span className="hint">{hint}</span>}
      </span>
      <Switch label={label} {...rest} />
    </div>
  )
}
