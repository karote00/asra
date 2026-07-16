import type { RenderEngine } from '../index'

type AsyncPart<Value> = Extract<Value, PromiseLike<unknown>>
type AssertNever<Value extends never> = Value

export type ExecuteMustBeSynchronous = AssertNever<
  AsyncPart<ReturnType<RenderEngine['execute']>>
>
export type QueryMustBeSynchronous = AssertNever<
  AsyncPart<ReturnType<RenderEngine['query']>>
>
export type DestroyMustBeSynchronous = AssertNever<
  AsyncPart<ReturnType<RenderEngine['destroy']>>
>
