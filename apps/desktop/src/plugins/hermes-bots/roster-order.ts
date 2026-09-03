/**
 * Roster Manual Ordering and Drag Reorder.
 *
 * Provides persistent manual ordering for bots and group chats in the Bots pane.
 * Preserves user-defined order while respecting pinned status and graceful merging
 * of newly created items.
 */

import { atom } from 'nanostores'

import { botRosterKey } from './data'
import { getPluginCtx } from './shared'
import type { RosterRow } from './types'

export const BOT_ROSTER_ORDER_KEY = 'bot-roster-order-v1'
export const ROSTER_ITEM_DRAG_MIME = 'application/x-hermes-roster-item'
export const BOT_DRAG_MIME = 'application/x-hermes-bot-key'

/** Persisted array of roster item keys in display order. */
export const $rosterOrder = atom<string[]>([])

/** Key of the roster item currently in flight during a drag gesture. */
export const $draggingRosterItem = atom<null | string>(null)

export function normalizeRosterOrder(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()
  const out: string[] = []

  for (const item of value) {
    const key = String(item || '').trim()

    if (!key || seen.has(key)) {
      continue
    }

    seen.add(key)
    out.push(key)
  }

  return out
}

export function persistRosterOrder(next: string[]): void {
  const clean = normalizeRosterOrder(next)
  $rosterOrder.set(clean)

  try {
    getPluginCtx()?.storage?.set?.(BOT_ROSTER_ORDER_KEY, clean)
  } catch {
    // Storage unavailable - order persists for this window session
  }
}

export function loadRosterOrder(): void {
  try {
    const raw = getPluginCtx()?.storage?.get?.(BOT_ROSTER_ORDER_KEY, [])
    $rosterOrder.set(normalizeRosterOrder(raw))
  } catch {
    $rosterOrder.set([])
  }
}

export function clearRosterOrder(): void {
  persistRosterOrder([])
}

export function rosterRowKey(row: { kind?: string; bot?: RosterRow; name?: string } | RosterRow): string {
  if ('kind' in row && row.kind === 'group' && row.name) {
    return `group:${row.name}`
  }

  const bot = ('bot' in row && row.bot ? row.bot : row) as RosterRow

  return botRosterKey(bot)
}

/**
 * Reorder a list of rows given a custom order array.
 * Pinned rows stay at the top. Within pinned and unpinned groups, rows appearing in
 * orderKeys preserve their relative manual order, while unknown rows sort by activity.
 */
export function orderRosterRows<T extends { activity: number; pinned: boolean }>(
  rows: T[],
  getRowKey: (row: T) => string,
  orderKeys: string[] = $rosterOrder.get()
): T[] {
  const cleanOrder = normalizeRosterOrder(orderKeys)

  if (!cleanOrder.length) {
    return rows.slice().sort((a, b) => {
      const pa = a.pinned ? 1 : 0
      const pb = b.pinned ? 1 : 0

      if (pa !== pb) {
        return pb - pa
      }

      return b.activity - a.activity
    })
  }

  const orderIndexMap = new Map<string, number>()
  cleanOrder.forEach((key, index) => {
    orderIndexMap.set(key, index)
  })

  const sortBucket = (bucket: T[]): T[] => {
    return bucket.slice().sort((a, b) => {
      const keyA = getRowKey(a)
      const keyB = getRowKey(b)
      const idxA = orderIndexMap.has(keyA) ? orderIndexMap.get(keyA)! : -1
      const idxB = orderIndexMap.has(keyB) ? orderIndexMap.get(keyB)! : -1

      if (idxA >= 0 && idxB >= 0) {
        return idxA - idxB
      }

      if (idxA >= 0) {
        return -1
      }

      if (idxB >= 0) {
        return 1
      }

      return b.activity - a.activity
    })
  }

  const pinnedRows = rows.filter(r => r.pinned)
  const unpinnedRows = rows.filter(r => !r.pinned)

  return [...sortBucket(pinnedRows), ...sortBucket(unpinnedRows)]
}

/**
 * Move fromKey before or after toKey in the context of visible keys and the full saved order.
 */
export function moveRosterItem(
  currentOrder: string[],
  visibleKeys: string[],
  fromKey: string,
  toKey: string,
  position: 'before' | 'after'
): string[] {
  if (fromKey === toKey) {
    return currentOrder
  }

  const baseOrder = [...normalizeRosterOrder(visibleKeys)]
  const fromIndex = baseOrder.indexOf(fromKey)

  if (fromIndex >= 0) {
    baseOrder.splice(fromIndex, 1)
  }

  const targetIndex = baseOrder.indexOf(toKey)

  if (targetIndex < 0) {
    baseOrder.push(fromKey)
  } else {
    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1
    baseOrder.splice(insertIndex, 0, fromKey)
  }

  const visibleSet = new Set(visibleKeys)
  const nonVisibleOrder = currentOrder.filter(k => !visibleSet.has(k))

  return [...baseOrder, ...nonVisibleOrder]
}
