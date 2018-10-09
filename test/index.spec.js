import expect from 'expect'
import combineDependantReducers from '../src/'

describe('combineDependantReducers', () => {
  it('next', () => {
    const id = (state = 0, { type }) => (type === 'NEW' ? state + 1 : state)
    const idsHistory = (state = [0], { type, args: [nextId] }) =>
      type === undefined ? state : [nextId, ...state]

    let reducer = combineDependantReducers({
      id,
      idsHistory: [idsHistory, '@next id']
    })

    let initialstate = reducer(undefined, {})

    expect(initialstate).toEqual({ id: 0, idsHistory: [0] })
    expect(reducer(initialstate, { type: 'NEW' })).toEqual({
      id: 1,
      idsHistory: [1, 0]
    })
  })

  it('prev', () => {
    const id = (state = 0, { type }) => (type === 'NEW' ? state + 1 : state)
    const idsHistory = (state = [], { type, args: [prevId] }) =>
      type === undefined ? state : [prevId, ...state]

    let reducer = combineDependantReducers({
      id,
      idsHistory: [idsHistory, '@prev id']
    })

    let initialstate = reducer(undefined, {})

    expect(initialstate).toEqual({ id: 0, idsHistory: [] })
    expect(reducer(initialstate, { type: 'NEW' })).toEqual({
      id: 1,
      idsHistory: [0]
    })
    expect(reducer({ id: 1, idsHistory: [0] }, { type: 'NEW' })).toEqual({
      id: 2,
      idsHistory: [1, 0]
    })
  })

  it('both', () => {
    const id = (state = 0, { type }) => (type === 'NEW' ? state + 1 : state)
    const idsHistory = (state = [], { type, args: [prevId, nextId] }) =>
      type === undefined ? state : [[prevId, nextId], ...state]

    let reducer = combineDependantReducers({
      id,
      idsHistory: [idsHistory, '@both id']
    })

    let initialstate = reducer(undefined, {})

    expect(initialstate).toEqual({ id: 0, idsHistory: [] })
    expect(reducer(initialstate, { type: 'NEW' })).toEqual({
      id: 1,
      idsHistory: [[0, 1]]
    })
  })

  it('param', () => {
    const subReducer = (state = 0, { args = [] }) =>
      state + args.reduce((a, b = 0) => a + b, 0)

    const reducer = combineDependantReducers({
      a: [subReducer, '@arg 0', '@arg 1'],
      b: [subReducer, '@next a', '@arg 1'],
      c: [subReducer, '@prev b', '@arg 1']
    })

    const initialstate = reducer(undefined, {})
    expect(initialstate).toEqual({ a: 0, b: 0, c: 0 })

    expect(reducer(initialstate, { args: [100, 1000] })).toEqual({
      a: 1100,
      b: 2100,
      c: 1000
    })
  })

  it('should handle complex cases', () => {
    const a = (state = 0, { type }) => (type === 'INC' ? state + 1 : state)

    const others = (state = 0, { type, args: numbers }) =>
      type === 'INC'
        ? state + numbers.reduce((res, number) => res + number, 0)
        : state

    let reducer = combineDependantReducers({
      e: [others, '@both d'],
      d: [others, '@prev c', '@next c'],
      c: [others, '@both b'],
      b: [others, '@both a', '@prev e'],
      a
    })

    let initialstate = reducer(undefined, {})

    expect(initialstate).toEqual({
      a: 0,
      b: 0,
      c: 0,
      d: 0,
      e: 0
    })

    let newState = reducer(initialstate, { type: 'INC' })
    expect(newState).toEqual({ a: 1, b: 1, c: 1, d: 1, e: 1 })

    newState = reducer(newState, { type: 'INC' })
    expect(newState).toEqual({ a: 2, b: 5, c: 7, d: 9, e: 11 })

    newState = reducer(newState, { type: 'INC' })
    expect(newState).toEqual({ a: 3, b: 21, c: 33, d: 49, e: 69 })
  })

  it('should detect circular dependencies', () => {
    const identity = x => x
    expect(() =>
      combineDependantReducers({
        a: [identity, '@next b'],
        b: [identity, '@next a']
      })
    ).toThrow('Circular dependency detected')
  })

  it('should return the same state if nothing changes', () => {
    const reducer = combineDependantReducers({
      a: x => x,
      b: x => x
    })
    const initialState = { a: 1, b: 2 }
    expect(reducer(initialState, {})).toBe(initialState)
  })
})
