import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from './useTheme'

const STORAGE_KEY = 'rm-theme'

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('defaults to sepia when no theme is saved in localStorage', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('sepia')
  })

  it('applies data-theme="sepia" on the document root by default', () => {
    renderHook(() => useTheme())
    expect(document.documentElement.getAttribute('data-theme')).toBe('sepia')
  })

  it('restores a previously saved theme from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'nacht')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('nacht')
  })

  it('persists the new theme to localStorage when setTheme is called', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('ozean'))
    expect(localStorage.getItem(STORAGE_KEY)).toBe('ozean')
  })

  it('updates data-theme on the document root when setTheme is called', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('hell'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('hell')
  })
})
