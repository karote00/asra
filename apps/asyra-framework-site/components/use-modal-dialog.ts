'use client'

import { useEffect, useRef } from 'react'

const scrollLockClassName = 'has-open-dialog'
let scrollLockCount = 0

const lockPageScroll = () => {
  scrollLockCount += 1
  document.documentElement.classList.add(scrollLockClassName)
  document.body.classList.add(scrollLockClassName)
}

const unlockPageScroll = () => {
  scrollLockCount = Math.max(0, scrollLockCount - 1)
  if (scrollLockCount > 0) return

  document.documentElement.classList.remove(scrollLockClassName)
  document.body.classList.remove(scrollLockClassName)
}

export function useModalDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const scrollLockedRef = useRef(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const releaseScrollLock = () => {
    if (!scrollLockedRef.current) return
    scrollLockedRef.current = false
    unlockPageScroll()
  }

  const openDialog = () => {
    const dialog = dialogRef.current
    if (!dialog || dialog.open) return

    lockPageScroll()
    scrollLockedRef.current = true
    try {
      dialog.showModal()
    } catch (error) {
      releaseScrollLock()
      throw error
    }
  }

  const closeDialog = () => {
    const dialog = dialogRef.current
    if (!dialog?.open) return

    releaseScrollLock()
    dialog.close()
  }

  const handleDialogClose = () => {
    releaseScrollLock()
    triggerRef.current?.focus()
  }

  useEffect(
    () => () => {
      if (!scrollLockedRef.current) return
      scrollLockedRef.current = false
      unlockPageScroll()
    },
    []
  )

  return {
    closeDialog,
    dialogRef,
    handleDialogClose,
    openDialog,
    triggerRef
  }
}
