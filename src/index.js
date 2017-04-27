/*
 * This code has purposely been written using imperative code and ES5 syntax
 * in order to keep its transpiled counterpart small and efficient.
 */

function getOrderOfKeysWithNext(keysWithNext, structure) {
  const remainingKeysWithNext = [];
  keysWithNext.forEach((key) => { remainingKeysWithNext[key] = true; });
  const result = [];
  const stack = [keysWithNext[0]];
  const visitedKeys = { [stack[0]]: true };

  while (result.length < keysWithNext.length) {
    const current = stack[stack.length - 1];

    structure[current].next.forEach((key) => {
      if (visitedKeys[key]) throw new Error('Circular dependency detected');
    });

    const unresolvedDependencies = structure[current].next.filter(key =>
      (keysWithNext.indexOf(key) !== -1 && remainingKeysWithNext[key]));

    if (unresolvedDependencies.length === 0) {
      result.push(current);
      stack.pop();
      delete visitedKeys[current];
      delete remainingKeysWithNext[current];

      if (stack.length === 0 && result.length < keysWithNext.length) {
        stack.push(Object.keys(remainingKeysWithNext)[0]);
        visitedKeys[stack[0]] = true;
      }
    } else {
      stack.push(unresolvedDependencies[0]);
      visitedKeys[unresolvedDependencies[0]] = true;
    }
  }

  return result;
}

function getStructureFor(key, input) {
  const result = { prev: [], next: [], getDependecies: () => [] };

  for (let i = 0; i < input[key].length - 1; i += 1) {
    const parts = input[key][i].split(' ');
    const type = parts[0];
    const dependencyKey = parts[1];

    const pushProps =
      type === '@next' ? ['next'] :
      type === '@prev' ? ['prev'] :
      type === '@both' ? ['prev', 'next'] : undefined;

    if (pushProps === undefined) throw new Error('Wrong prefix');

    pushProps.forEach((prop) => {
      result[prop].push(dependencyKey);
    });

    const prevGetDependencies = result.getDependecies;
    result.getDependecies = (prev, next) => {
      const options = { prev, next };
      const res = prevGetDependencies(prev, next);
      pushProps.forEach((prop) => {
        res.push(options[prop][dependencyKey]);
      });
      return res;
    };
  }

  return result;
}

function getStructure(input) {
  const result = {};
  Object.keys(input).forEach((key) => {
    result[key] = !Array.isArray(input[key])
      ? { prev: [], next: [] }
      : getStructureFor(key, input);
  });

  return result;
}

module.exports = (input) => {
  const structure = getStructure(input);

  const withoutNextDependencies = [];
  const withNextDependencies = [];

  Object.keys(structure).forEach((key) => {
    const listToPush = structure[key].next.length > 0
      ? withNextDependencies
      : withoutNextDependencies;
    listToPush.push(key);
  });

  const executionOrder = withoutNextDependencies.concat(
    getOrderOfKeysWithNext(withNextDependencies, structure)
  );

  return (state = {}, action) => {
    const result = {};

    executionOrder.forEach((key) => {
      const reducer = (Array.isArray(input[key]))
        ? input[key][input[key].length - 1].apply(
            null, structure[key].getDependecies(state, result))
        : input[key];

      result[key] = reducer(state[key], action);
    });

    return result;
  };
};
