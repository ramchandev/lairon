import { useEffect, useMemo, useRef } from 'react'
import { Camera, Upload } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { prepareAvatar } from '@/lib/avatar'

/** The prototype's photo row: dashed round placeholder, "Upload photo", "Remove", size hint. Holds the picked image in the parent. */
export function PhotoField({
  name,
  current,
  blob,
  removed,
  onPick,
  onRemove,
  onError,
}: {
  name: string
  current: string | null
  blob: Blob | null
  removed: boolean
  onPick: (b: Blob) => void
  onRemove: () => void
  onError: (msg: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])
  const shown = preview ?? (removed ? null : current)
  return (
    <div className="field full">
      <span className="lbl">Photo</span>
      <div className="flex flex-wrap items-center gap-4">
        {shown ? (
          <Avatar name={name || 'User'} url={shown} size={84} />
        ) : (
          <span
            className="grid size-[84px] place-items-center rounded-full border-2 border-dashed border-line-2 bg-white/80 text-muted"
            aria-hidden
          >
            <Camera size={22} />
          </span>
        )}
        <div>
          <label className="btn btn-ghost btn-sm cursor-pointer">
            <Upload aria-hidden /> Upload photo
            <input
              ref={ref}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (ref.current) ref.current.value = ''
                if (!f) return
                try {
                  onPick(await prepareAvatar(f))
                } catch (err) {
                  onError(err instanceof Error ? err.message : 'Could not use that image.')
                }
              }}
            />
          </label>
          {shown && (
            <button type="button" className="btn btn-soft-danger btn-sm ml-1.5" onClick={onRemove}>
              Remove
            </button>
          )}
          <span className="hint block">JPG or PNG, up to 2 MB. Cropped to a square.</span>
        </div>
      </div>
    </div>
  )
}
