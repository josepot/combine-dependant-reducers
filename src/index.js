const invariant = require('invariant');
const err = msg => `combine-dependant-reducers: ${msg}`;

function getOrderOfKeysWithNext(keysWithNext, structure) {
  const remainingKeysWithNext = [];
  keysWithNext.forEach((key) => { remainingKeysWithNext[key] = true; });
  const result = [];
  const stack = [keysWithNext[0]];
  const visitedKeys = { [stack[0]]: true };

  while (result.length < keysWithNext.length) {
    const current = stack[stack.length - 1];

    structure[current].next.forEach((key) => {
      invariant(
        !visitedKeys[key],
        err('Circular dependency detected')
      );
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

const defaultGetDependencies = () => [];

const pushPropsOptions = {
  '@next': ['next'],
  '@prev': ['prev'],
  '@both': ['prev', 'next'],
};

function getStructureFor(key, input) {
  const result = { prev: [], next: [], getDependencies: defaultGetDependencies };

  for (let i = 0; i < input[key].length - 1; i += 1) {
    const parts = input[key][i].split(' ');
    const type = parts[0];
    const dependencyKey = parts[1];

    const pushProps = pushPropsOptions[type];
    pushProps.forEach((prop) => {
      result[prop].push(dependencyKey);
    });

    const prevGetDependencies = result.getDependencies;
    result.getDependencies = (prev, next) => {
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
  const defaultEntry = { prev: [], next: [], getDependencies: defaultGetDependencies };
  Object.keys(input).forEach((key) => {
    result[key] = !Array.isArray(input[key])
      ? defaultEntry
      : getStructureFor(key, input);
  });

  return result;
}

function validateInput(input) {
  invariant(typeof input === 'object', err('Wrong input received, expected an Object'));
  Object.keys(input).forEach(key => {
    const val = input[key];
    if (Array.isArray(val)) {
      invariant(val.length > 0, err(`An empty Array was found on entry '${key}'.`));
      const fn = val[val.length - 1];
      invariant(typeof fn === 'function', err(`The last value of entry '${key}' should be a function`));
      const msg = err(`Wrong dependency found on entry '${key}'.`);
      for (let i = 0; i < val.length - 1; i++) {
        invariant(typeof val[i] === 'string', msg);
        const dependencyParts = val[i].split(' ');
        invariant(dependencyParts.length === 2 , msg);
        invariant(['@prev', '@both', '@next'].indexOf(dependencyParts[0]) > -1, msg);
        invariant(input[dependencyParts[1]] !== undefined, msg);
      }
    } else {
      invariant(
        typeof val === 'function',
        err(`wrong value received on entry '${key}', expected a function`)
      );
    }
  });
}

module.exports = (input) => {
  validateInput(input);
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

  return (state = {}, action) => executionOrder.reduce((result, key) => {
    const inputEntry = input[key];
    const reducer = Array.isArray(inputEntry)
      ? inputEntry[inputEntry.length - 1]
      : inputEntry;
    const dependencies = structure[key].getDependencies(state, result);
    result[key] = reducer.apply(null, [state[key], action].concat(dependencies));
    return result;
  }, {});
};
