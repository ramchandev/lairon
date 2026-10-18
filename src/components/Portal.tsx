import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renders overlays (dialogs, pickers) on <body>. Glass cards use backdrop-filter, which turns a card into the containing
 * block of any `position: fixed` child — an overlay rendered inside one is sized and placed relative to the card, not the screen.
 */
export const Portal = ({ children }: { children: ReactNode }) =>
  createPortal(children, document.body)
