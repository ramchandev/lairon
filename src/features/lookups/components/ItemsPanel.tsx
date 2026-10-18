import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  Info,
  ListPlus,
} from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { Switch } from '@/components/Switch'
import { useToast } from '@/components/Toast'
import { IconButton, IconLink } from '@/components/ListParts'
import { cn } from '@/lib/utils'
import {
  useDeleteItem,
  useDeleteList,
  useReorderItems,
  useToggleItem,
  type LookupItem,
  type LookupList,
} from '../api'

export function ItemsPanel({
  list,
  items,
  onListDeleted,
}: {
  list: LookupList
  items: LookupItem[]
  onListDeleted: () => void
}) {
  const toast = useToast()
  const toggle = useToggleItem()
  const delItem = useDeleteItem()
  const delList = useDeleteList()
  const reorder = useReorderItems()
  const [order, setOrder] = useState<string[] | null>(null) // local order while dragging / after a move
  const [dragId, setDragId] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<LookupItem | null>(null)
  const [deleteListOpen, setDeleteListOpen] = useState(false)

  const byId = new Map(items.map((i) => [i.id, i]))
  const ids = (order ?? items.map((i) => i.id)).filter((id) => byId.has(id))
  const rows = ids.map((id) => byId.get(id)!)
  const active = items.filter((i) => i.is_active).length

  const commit = (next: string[]) => {
    setOrder(next)
    reorder.mutate(next, {
      onSuccess: () => setOrder(null),
      onError: () => {
        setOrder(null)
        toast('Could not save the new order', 'error')
      },
    })
  }
  const move = (id: string, delta: number) => {
    const i = ids.indexOf(id),
      j = i + delta
    if (j < 0 || j >= ids.length) return
    const next = [...ids]
    ;[next[i], next[j]] = [next[j], next[i]]
    commit(next)
  }
  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const next = ids.filter((x) => x !== dragId)
    next.splice(next.indexOf(targetId), 0, dragId)
    setDragId(null)
    commit(next)
  }

  return (
    <section>
      <div className="banner">
        <Info aria-hidden size={18} />
        <div>
          <b>Changes apply to new entries only.</b> Records already saved keep the value they were
          saved with, even if you rename or delete an item here.
        </div>
      </div>
      <div className="toolbar">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold">{list.label}</h2>
          <span className="muted text-[13px]">
            {active} active of {items.length}
            {list.allow_other ? ' · forms also show an “Others” free-text option' : ''}
          </span>
        </div>
        <Link
          to={`/admin/dropdowns/${list.key}/settings`}
          className="btn btn-ghost"
          aria-label="List settings"
        >
          <Settings2 aria-hidden />
        </Link>
        <Link to={`/admin/dropdowns/${list.key}/items/new`} className="btn btn-primary">
          <Plus aria-hidden /> Add item
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="glass">
          <EmptyState
            icon={ListPlus}
            title="No items"
            hint="Add the first option for this dropdown."
          />
        </div>
      ) : (
        <ul className="items glass">
          {rows.map((it, idx) => (
            <li
              key={it.id}
              draggable
              onDragStart={() => setDragId(it.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOn(it.id)}
              onDragEnd={() => setDragId(null)}
              className={cn(dragId === it.id && 'opacity-50')}
            >
              <GripVertical className="grip" size={20} aria-hidden />
              <span className={cn('val', !it.is_active && 'off')}>{it.value}</span>
              <IconButton
                label={`Move ${it.value} up`}
                icon={ArrowUp}
                disabled={idx === 0}
                onClick={() => move(it.id, -1)}
              />
              <IconButton
                label={`Move ${it.value} down`}
                icon={ArrowDown}
                disabled={idx === rows.length - 1}
                onClick={() => move(it.id, 1)}
              />
              <Switch
                label={`${it.value} active`}
                checked={it.is_active}
                onChange={(is_active) => toggle.mutate({ id: it.id, is_active })}
              />
              <IconLink
                to={`/admin/dropdowns/${list.key}/items/${it.id}/edit`}
                label={`Edit ${it.value}`}
                icon={Pencil}
              />
              <IconButton
                danger
                label={`Delete ${it.value}`}
                icon={Trash2}
                onClick={() => setToDelete(it)}
              />
            </li>
          ))}
        </ul>
      )}

      {!list.is_system && (
        <button className="link mt-6 !text-danger" onClick={() => setDeleteListOpen(true)}>
          Delete this dropdown list
        </button>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this item?"
        confirmLabel="Delete"
        busy={delItem.isPending}
        description={
          <>
            “{toDelete?.value}” will no longer be offered. Existing records keep their saved text.
            To hide it without deleting, switch it off instead.
          </>
        }
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          toDelete &&
          delItem.mutate(toDelete.id, {
            onSuccess: () => {
              toast('Item deleted')
              setToDelete(null)
            },
            onError: () => toast('Could not delete the item', 'error'),
          })
        }
      />
      <ConfirmDialog
        open={deleteListOpen}
        title={`Delete “${list.label}”?`}
        confirmLabel="Delete list"
        busy={delList.isPending}
        description="All its items are removed. Existing records keep their saved text."
        onCancel={() => setDeleteListOpen(false)}
        onConfirm={() =>
          delList.mutate(list.key, {
            onSuccess: () => {
              toast('List deleted')
              setDeleteListOpen(false)
              onListDeleted()
            },
            onError: () => toast('Could not delete the list', 'error'),
          })
        }
      />
    </section>
  )
}
