const invariant = require('invariant');
const err = msg => `combine-dependant-reducers: ${msg}`;

function getOrderOfKeysWithNext(keysWithNext, structure) {
  const remainingKeysWithNext = {};
  keysWithNext.forEach((key) => { remainingKeysWithNext[key] = true; });
  const result = [];
  const stack = [keysWithNext[0]];

  while (result.length < keysWithNext.length) {
    const current = stack[stack.length - 1];

    structure[current].next.forEach((key) => {
      invariant(
        stack.indexOf(key) === -1, 
        err('Circular dependency detected')
      );
    });

    const unresolvedDependencies = structure[current].next
      .filter(key => remainingKeysWithNext[key]);

    if (unresolvedDependencies.length === 0) {
      result.push(stack.pop());
      delete remainingKeysWithNext[current];

      if (stack.length === 0 && result.length < keysWithNext.length) {
        stack.push(Object.keys(remainingKeysWithNext)[0]);
      }
    } else {
      stack.push(unresolvedDependencies[0]);
    }
  }

  return result;
}

const pushPropsOptions = {
  '@next': ['next'],
  '@prev': ['prev'],
  '@both': ['prev', 'next'],
};

function getStructureFor(key, input) {
  const result = { prev: [], next: [], accessOrder: [] };

  if (!Array.isArray(input[key])) return result;

  for (let i = 0; i < input[key].length - 1; i += 1) {
    const parts = input[key][i].split(' ');
    const type = parts[0];
    const dependencyKey = parts[1];

    const pushProps = pushPropsOptions[type];
    pushProps.forEach((prop) => {
      result[prop].push(dependencyKey);
      result.accessOrder.push([prop, dependencyKey]);
    });
  }

  return result;
}

function getStructure(input) {
  const result = {};
  Object.keys(input).forEach((key) => {
    result[key] = getStructureFor(key, input);
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

function getDependencies(accessOrder, prev, next) {
  const states = {prev, next};
  return accessOrder.map(([prevNext, key]) => states[prevNext][key]);
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
    const dependencies = getDependencies(structure[key].accessOrder, state, result);
    result[key] = reducer.apply(null, [state[key], action].concat(dependencies));
    return result;
  }, {});
};
