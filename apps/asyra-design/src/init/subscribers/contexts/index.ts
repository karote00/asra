import { initElementSelectionSubscribes } from "./selection"
import { initUIContextSubscribers, initSelectionYJSDataSubscribe } from "./ui-context"

export const initContextSubscribers = () => {
  console.log('initContextSubscribers')
  initSelectionYJSDataSubscribe()
  initElementSelectionSubscribes()
  initUIContextSubscribers()
}