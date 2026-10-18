import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, ListChecks, Network, Plus } from 'lucide-react'
import { PageHeader } from '@/components/FormPage'
import { cn } from '@/lib/utils'
import { ItemsPanel } from '../components/ItemsPanel'
import { MappingPanel } from '../components/MappingPanel'
import { useAllLookupItems, useLookupLists } from '../api'

const MAPPING = '__mapping'

/** Vertical tabs. ≥900px: sticky 270px column. Mobile: collapses into one "Dropdown list: X · Change" button. */
export function DropdownsPage() {
  const lists = useLookupLists()
  const items = useAllLookupItems()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  if (lists.isLoading || items.isLoading) return <p className="text-muted">Loading…</p>
  const all = lists.data ?? []
  const selected = params.get('list') ?? all[0]?.key ?? MAPPING
  const list = all.find((l) => l.key === selected)
  const currentLabel = selected === MAPPING ? 'Qualification mapping' : (list?.label ?? '—')

  const select = (key: string) => {
    setParams({ list: key })
    setMenuOpen(false)
  }
  const count = (key: string) => (items.data ?? []).filter((i) => i.list_key === key).length

  const tab = (key: string, label: string, Icon: typeof ListChecks, n?: number) => (
    <button
      key={key}
      type="button"
      role="tab"
      onClick={() => select(key)}
      aria-selected={selected === key}
      aria-current={selected === key}
      className="vtab"
    >
      <Icon aria-hidden />
      <span className="vt-l">{label}</span>
      {n !== undefined && <span className="count">{n}</span>}
    </button>
  )

  return (
    <>
      <PageHeader title="Dropdowns" subtitle="Manage every dropdown used in LAIRON EZ forms" />
      <div className="dd-layout">
        <nav
          className={cn('vtabs glass', menuOpen && 'open')}
          role="tablist"
          aria-orientation="vertical"
          aria-label="Dropdown lists"
        >
          <button
            type="button"
            className="vtab-toggle"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <ListChecks aria-hidden />
            <span className="vt-l">
              <span className="muted block text-[13px] font-semibold">Dropdown list</span>
              {currentLabel}
            </span>
            <span className="text-[13px] text-primary">Change</span>
            <ChevronDown className="chev" aria-hidden />
          </button>
          <h6>Lists</h6>
          {all.map((l) => tab(l.key, l.label, ListChecks, count(l.key)))}
          <h6>Mappings</h6>
          {tab(MAPPING, 'Qualification mapping', Network)}
          <Link to="/admin/dropdowns/new-list" className="vtab vtab-add">
            <Plus aria-hidden />
            <span className="vt-l">New dropdown list</span>
          </Link>
        </nav>

        <div className="dd-panel">
          {selected === MAPPING ? (
            <MappingPanel />
          ) : list ? (
            <ItemsPanel
              key={list.key}
              list={list}
              items={(items.data ?? []).filter((i) => i.list_key === list.key)}
              onListDeleted={() => navigate('/admin/dropdowns', { replace: true })}
            />
          ) : (
            <p className="glass p-5">List not found.</p>
          )}
        </div>
      </div>
    </>
  )
}
