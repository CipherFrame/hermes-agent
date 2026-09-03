import { describe, expect, it } from 'vitest'

import {
  moveRosterItem,
  normalizeRosterOrder,
  orderRosterRows,
  rosterRowKey
} from './roster-order'
import type { RosterRow } from './types'

describe('roster-order', () => {
  describe('normalizeRosterOrder', () => {
    it('handles non-array inputs gracefully', () => {
      expect(normalizeRosterOrder(null)).toEqual([])
      expect(normalizeRosterOrder(undefined)).toEqual([])
      expect(normalizeRosterOrder('invalid')).toEqual([])
      expect(normalizeRosterOrder(123)).toEqual([])
    })

    it('deduplicates and trims keys', () => {
      const input = ['bot-a', ' bot-b ', 'bot-a', '', '  ', 'bot-c']
      expect(normalizeRosterOrder(input)).toEqual(['bot-a', 'bot-b', 'bot-c'])
    })
  })

  describe('rosterRowKey', () => {
    it('formats group row key with group: prefix', () => {
      expect(rosterRowKey({ kind: 'group', name: 'ops-team' })).toBe('group:ops-team')
    })

    it('formats bot row key with connection and name', () => {
      const bot: RosterRow = {
        name: 'secops',
        connectionId: 'local'
      }

      expect(rosterRowKey({ kind: 'bot', bot })).toBe('local::secops')
      expect(rosterRowKey(bot)).toBe('local::secops')
    })
  })

  describe('orderRosterRows', () => {
    const mockRows = [
      { key: 'bot-1', activity: 100, pinned: false },
      { key: 'bot-2', activity: 200, pinned: false },
      { key: 'bot-3', activity: 50, pinned: false },
      { key: 'bot-pinned', activity: 10, pinned: true }
    ]

    it('defaults to pinned first, then activity descending when order is empty', () => {
      const sorted = orderRosterRows(mockRows, r => r.key, [])
      expect(sorted.map(r => r.key)).toEqual(['bot-pinned', 'bot-2', 'bot-1', 'bot-3'])
    })

    it('respects custom manual order while keeping pinned items at top', () => {
      // User ordered bot-3 first, then bot-1
      const sorted = orderRosterRows(mockRows, r => r.key, ['bot-3', 'bot-1'])
      // bot-pinned stays at top (pinned)
      // bot-3 and bot-1 follow custom order
      // bot-2 was not in custom order, so it sorts after ordered items by activity
      expect(sorted.map(r => r.key)).toEqual(['bot-pinned', 'bot-3', 'bot-1', 'bot-2'])
    })

    it('orders multiple pinned items according to custom order', () => {
      const rowsWithTwoPinned = [
        { key: 'pin-a', activity: 10, pinned: true },
        { key: 'pin-b', activity: 50, pinned: true },
        { key: 'normal-1', activity: 100, pinned: false }
      ]

      const sorted = orderRosterRows(rowsWithTwoPinned, r => r.key, ['pin-a', 'pin-b'])
      expect(sorted.map(r => r.key)).toEqual(['pin-a', 'pin-b', 'normal-1'])

      const sortedReverse = orderRosterRows(rowsWithTwoPinned, r => r.key, ['pin-b', 'pin-a'])
      expect(sortedReverse.map(r => r.key)).toEqual(['pin-b', 'pin-a', 'normal-1'])
    })
  })

  describe('moveRosterItem', () => {
    const visible = ['a', 'b', 'c', 'd']

    it('moves item before target', () => {
      const next = moveRosterItem(['a', 'b', 'c', 'd'], visible, 'd', 'b', 'before')
      expect(next).toEqual(['a', 'd', 'b', 'c'])
    })

    it('moves item after target', () => {
      const next = moveRosterItem(['a', 'b', 'c', 'd'], visible, 'a', 'c', 'after')
      expect(next).toEqual(['b', 'c', 'a', 'd'])
    })

    it('returns unchanged order if fromKey equals toKey', () => {
      const next = moveRosterItem(['a', 'b', 'c'], visible, 'b', 'b', 'before')
      expect(next).toEqual(['a', 'b', 'c'])
    })

    it('preserves non-visible saved order keys', () => {
      const currentOrder = ['a', 'x-hidden', 'b', 'c', 'y-offline']
      const next = moveRosterItem(currentOrder, visible, 'c', 'a', 'before')
      expect(next.slice(0, 4)).toEqual(['c', 'a', 'b', 'd'])
      expect(next).toContain('x-hidden')
      expect(next).toContain('y-offline')
    })
  })
})
