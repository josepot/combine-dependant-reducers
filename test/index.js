import expect from 'expect';
import combineDependantReducers from '../src/';

describe('combineDependantReducers', () => {
    it('next', () => {
      const id = (state = 0, { type }) => (
        type === 'NEW' ? state + 1 : state
      );
      const idsHistory = (state = [0], { type }, nextId) => (
        type === undefined ? state : [nextId, ...state]
      );

      let reducer = combineDependantReducers({
        id,
        idsHistory: ['@next id', idsHistory]
      });

      let initialstate = reducer(undefined, {});

      expect(initialstate).toEqual({ id: 0, idsHistory: [0] });
      expect(reducer(initialstate, { type: 'NEW' })).toEqual({
        id: 1,
        idsHistory: [1, 0],
      });
    });

    it('prev', () => {
      const id = (state = 0, { type }) => (
        type === 'NEW' ? state + 1 : state
      );
      const idsHistory = (state = [], { type }, prevId) => (
        type === undefined ? state : [prevId, ...state]
      );

      let reducer = combineDependantReducers({
        id,
        idsHistory: ['@prev id', idsHistory]
      });

      let initialstate = reducer(undefined, {});

      expect(initialstate).toEqual({ id: 0, idsHistory: [] });
      expect(reducer(initialstate, { type: 'NEW' })).toEqual({
        id: 1,
        idsHistory: [0],
      });
      expect(reducer({id: 1, idsHistory: [0]}, { type: 'NEW' })).toEqual({
        id: 2,
        idsHistory: [1, 0],
      });
    });

    it('both', () => {
      const id = (state = 0, { type }) => (
        type === 'NEW' ? state + 1 : state
      );
      const idsHistory = (state = [], { type }, prevId, nextId) => (
        type === undefined ? state : [[prevId, nextId], ...state]
      );

      let reducer = combineDependantReducers({
        id,
        idsHistory: ['@both id', idsHistory]
      });

      let initialstate = reducer(undefined, {});

      expect(initialstate).toEqual({ id: 0, idsHistory: [] });
      expect(reducer(initialstate, { type: 'NEW' })).toEqual({
        id: 1,
        idsHistory: [[0, 1]],
      });
    });

    it('should handle complex cases', () => {
      const a = (state = 0, { type }) => (type === 'INC'
        ? state + 1
        : state
      );

      const others  = (state = 0, { type }, ...numbers) => (type === 'INC'
        ? state + numbers.reduce((res, number) => res + number, 0)
        : state
      );

      let reducer = combineDependantReducers({
        e: ['@both d', others],
        d: ['@prev c', '@next c', others],
        c: ['@both b', others],
        b: ['@both a', '@prev e', others],
        a,
      });

      let initialstate = reducer(undefined, {});

      expect(initialstate).toEqual({
        a: 0, b: 0, c: 0, d: 0, e: 0,
      });

      let newState = reducer(initialstate, { type: 'INC' });
      expect(newState).toEqual({ a: 1, b: 1, c: 1, d: 1, e: 1 });

      newState = reducer(newState, { type: 'INC' });
      expect(newState).toEqual({ a: 2, b: 5, c: 7, d: 9, e: 11 });

      newState = reducer(newState, { type: 'INC' });
      expect(newState).toEqual({ a: 3, b: 21, c: 33, d: 49, e: 69 });
    });

    it('should detect circular dependencies', () => {
      const identity = x => x;
      expect(() => combineDependantReducers({
        a: ['@next b', identity],
        b: ['@next a', identity],
      })).toThrow('Circular dependency detected');
    });
});
