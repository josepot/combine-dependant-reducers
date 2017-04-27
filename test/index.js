import expect from 'expect';
import combineHigherOrderReducers from '../src/';

describe('combineHOReducers', () => {
  describe('patterns', () => {
    it('should work too', () => {
      const id = (state = 0, { type }) => (
        type === 'NEW' ? state + 1 : state
      );
      const idsHistory = (prev, current) => (state = [], { type }) => (
        type !== undefined ? state.concat({ prev, current }) : state
      );

      let reducer = combineHigherOrderReducers({
        id,
        idsHistory: ['@both id', idsHistory]
      });

      let initialstate = reducer(undefined, {});

      expect(initialstate).toEqual({ id: 0, idsHistory: [] });
      expect(reducer(initialstate, { type: 'NEW' })).toEqual({
        id: 1,
        idsHistory: [{ prev: 0, current: 1 }],
      });
    });
    it('should work', () => {
      const a = (state = 0, { type }) => (type === 'INC'
        ? state + 1
        : state
      );

      const others  = (...numbers) => (state = 0, { type }) => (type === 'INC'
        ? state + numbers.reduce((res, number) => res + number, 0)
        : state
      );

      let reducer = combineHigherOrderReducers({
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
  });
});
