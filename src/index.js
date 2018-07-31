const invariant = require('invariant')
const err = msg => `combine-dependant-reducers: ${msg}`

function getOrderOfKeysWithNext(keysWithNext, structure) {
  const remainingKeysWithNext = {}
  keysWithNext.forEach(key => {
    remainingKeysWithNext[key] = true
  })
  const result = []
  const stack = [keysWithNext[0]]

  while (result.length < keysWithNext.length) {
    const current = stack[stack.length - 1]

    structure[current].next.forEach(key => {
      invariant(stack.indexOf(key) === -1, err('Circular dependency detected'))
    })

    const unresolvedDependencies = structure[current].next.filter(
      key => remainingKeysWithNext[key]
    )

    if (unresolvedDependencies.length > 0) {
      stack.push(unresolvedDependencies[0])
      continue
    }

    result.push(stack.pop())
    delete remainingKeysWithNext[current]

    if (stack.length === 0 && result.length < keysWithNext.length) {
      stack.push(Object.keys(remainingKeysWithNext)[0])
    }
  }

  return result
}

const pushPropsOptions = {
  '@next': ['next'],
  '@prev': ['prev'],
  '@both': ['prev', 'next']
}

function getStructureFor(key, entry, argsObj) {
  const result = { prev: [], next: [], accessOrder: [] }

  if (!Array.isArray(entry)) return result

  entry
    .slice(1)
    .map(d => d.split(' '))
    .forEach(([type, name]) => {
      if (type === '@arg') {
        result.accessOrder.push(['args', argsObj[name]])
      } else {
        const pushProps = pushPropsOptions[type]
        pushProps.forEach(prop => {
          result[prop].push(name)
          result.accessOrder.push([prop, name])
        })
      }
    })

  return result
}

function getStructure(input, argsObj) {
  const result = {}
  Object.keys(input).forEach(key => {
    result[key] = getStructureFor(key, input[key], argsObj)
  })

  return result
}

function validateInput(input, args) {
  invariant(
    typeof input === 'object',
    err('Wrong input received, expected an Object')
  )
  Object.keys(input).forEach(key => {
    const entry = input[key]
    if (Array.isArray(entry)) {
      invariant(
        entry.length > 0,
        err(`An empty Array was found on entry '${key}'.`)
      )
      const [fn, ...dependencies] = entry
      invariant(
        typeof fn === 'function',
        err(`The last value of entry '${key}' should be a function`)
      )
      const msg = err(`Wrong dependency found on entry '${key}'.`)
      dependencies.forEach(dependency => {
        invariant(typeof dependency === 'string', msg)
        const dependencyParts = dependency.split(' ')
        invariant(dependencyParts.length === 2, msg)
        const [type, name] = dependencyParts
        invariant(['@prev', '@next', '@both', '@arg'].indexOf(type) > -1, msg)
        invariant((type === '@arg' ? args : input)[name] !== undefined, msg)
      })
    } else {
      invariant(
        typeof entry === 'function',
        err(`wrong value received on entry '${key}', expected a function`)
      )
    }
  })
}

function getDependencies(accessOrder, prev, next, args) {
  const dependencies = { prev, next, args }
  return accessOrder.map(([type, key]) => dependencies[type][key])
}

export default (input, ...argDependencies) => {
  const argsDependenciesObj = argDependencies.reduce(
    (res, key, idx) => Object.assign(res, { [key]: idx }),
    {}
  )

  if (process.env.NODE_ENV !== 'production') {
    validateInput(input, argsDependenciesObj)
  }
  const structure = getStructure(input, argsDependenciesObj)

  const withoutNextDependencies = []
  const withNextDependencies = []

  Object.keys(structure).forEach(key => {
    const listToPush =
      structure[key].next.length > 0
        ? withNextDependencies
        : withoutNextDependencies
    listToPush.push(key)
  })

  const executionOrder = withoutNextDependencies.concat(
    getOrderOfKeysWithNext(withNextDependencies, structure)
  )

  return (state = {}, action, ...args) => {
    let hasDifferences = false

    const newState = executionOrder.reduce((result, key) => {
      const inputEntry = input[key]
      const reducer = Array.isArray(inputEntry) ? inputEntry[0] : inputEntry
      const dependencies = getDependencies(
        structure[key].accessOrder,
        state,
        result,
        args
      )
      result[key] = reducer.apply(null, [state[key], action, ...dependencies])

      if (result[key] !== state[key]) hasDifferences = true
      return result
    }, {})

    return hasDifferences ? newState : state
  }
}
