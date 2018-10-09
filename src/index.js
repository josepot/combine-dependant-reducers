const err = (ok, msg) => {
  if (!ok) throw new Error(`combine-dependant-reducers: ${msg}`)
}

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
      err(stack.indexOf(key) === -1, 'Circular dependency detected')
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

function getStructureFor(key, entry) {
  const result = { prev: [], next: [], accessOrder: [] }

  if (!Array.isArray(entry)) return result

  entry
    .slice(1)
    .map(d => d.split(' '))
    .forEach(([type, name]) => {
      if (type === '@arg') {
        result.accessOrder.push(['args', parseInt(name, 10)])
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

function getStructure(input) {
  const result = {}
  Object.keys(input).forEach(key => {
    result[key] = getStructureFor(key, input[key])
  })

  return result
}

function validateInput(input) {
  err(typeof input === 'object', 'Wrong input received, expected an Object')
  Object.keys(input).forEach(key => {
    const entry = input[key]
    if (Array.isArray(entry)) {
      err(entry.length > 0, `An empty Array was found on entry '${key}'.`)
      const [fn, ...dependencies] = entry
      err(
        typeof fn === 'function',
        `The last value of entry '${key}' should be a function`
      )
      const msg = `Wrong dependency found on entry '${key}'.`
      dependencies.forEach(dependency => {
        err(typeof dependency === 'string', msg)
        const dependencyParts = dependency.split(' ')
        err(dependencyParts.length === 2, msg)
        const [type] = dependencyParts
        err(['@prev', '@next', '@both', '@arg'].indexOf(type) > -1, msg)
      })
    } else {
      err(
        typeof entry === 'function',
        `wrong value received on entry '${key}', expected a function`
      )
    }
  })
}

function getDependencies(accessOrder, prev, next, args) {
  const dependencies = { prev, next, args }
  return accessOrder.map(([type, key]) => dependencies[type][key])
}

export default input => {
  if (process.env.NODE_ENV !== 'production') {
    validateInput(input)
  }
  const structure = getStructure(input)

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

  return (state = {}, originalAction = {}) => {
    let hasDifferences = false

    const newState = executionOrder.reduce((result, key) => {
      const inputEntry = input[key]
      const reducer = Array.isArray(inputEntry) ? inputEntry[0] : inputEntry
      const args = getDependencies(
        structure[key].accessOrder,
        state,
        result,
        originalAction.args || []
      )
      const action =
        args.length === 0
          ? originalAction
          : Object.assign({}, originalAction, { args })
      result[key] = reducer(state[key], action)

      if (result[key] !== state[key]) hasDifferences = true
      return result
    }, {})

    return hasDifferences ? newState : state
  }
}
