import { Observable, BehaviorSubject } from 'rxjs'

interface StateRegistration {
  name: string
  observable: Observable<unknown>
  initialValue: unknown
}

class StateRegistry {
  private states = new Map<string, StateRegistration>()

  register(
    name: string,
    initialValue: unknown,
    observable?: Observable<unknown>
  ): void {
    const obs = observable || new BehaviorSubject(initialValue)

    if (this.states.has(name)) {
      console.warn(`State "${name}" already registered. Overwriting.`)
    }

    this.states.set(name, {
      name,
      observable: obs,
      initialValue
    })
  }

  unregister(name: string): boolean {
    if (!this.states.has(name)) {
      console.warn(`State "${name}" not found.`)
      return false
    }

    this.states.delete(name)
    return true
  }

  getObservable(name: string): Observable<unknown> | undefined {
    return this.states.get(name)?.observable
  }

  getValue(name: string): unknown {
    const state = this.states.get(name)
    if (state?.observable instanceof BehaviorSubject) {
      return state.observable.value
    }
    return state?.initialValue
  }

  setValue(name: string, value: unknown): void {
    const state = this.states.get(name)
    if (state?.observable instanceof BehaviorSubject) {
      state.observable.next(value)
    } else {
      console.warn(
        `State "${name}" is not a BehaviorSubject. Cannot set value.`
      )
    }
  }

  has(name: string): boolean {
    return this.states.has(name)
  }

  clear(): void {
    this.states.clear()
  }
}

export const stateRegistry = new StateRegistry()
export default stateRegistry
