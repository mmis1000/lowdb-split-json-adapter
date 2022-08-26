// @ts-check
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')

/**
 * @typedef {{
   *   defaultValue?: any,
 *   serialize?: (arg: Record<string, any>) => string,
 *   deserialize?: (arg: string) => Record<string, any>
 * }} SplitJSONAdapterOption
 */

/**
 * @typedef {Object} FileKeys
 * @property {Set<string>} defaultNames
 * @property {Set<string>} existNames
 * @property {Set<string>} templateNames
 * @property {Set<string>} scriptNames
 * @property {Set<string>} scriptTemplatedNames
 * @property {Set<string>} snapshotNames
 */

/**
 * 
 * @param {string} path 
 * @param {(str: string) => any} parse 
 */
const readJSONSync = (path, parse) => {
  return parse(fs.readFileSync(path, { encoding: 'utf8' }))
}

/**
 * 
 * @param {string} path 
 * @param {any} value 
 * @param {(arg: any) => string} serialize 
 */
const writeJSONSync = (path, value, serialize) => {
  return fs.writeFileSync(path, serialize(value))
}

/**
 * 
 * @param {unknown} obj 
 */
const importDefault = (obj) => {
  if (
    obj != null
    && typeof obj === 'object'
    && '__esModule' in obj
    && /** @type {{ __esModule: unknown }} */(obj)['__esModule'] === true
    && /** @type {{ default?: unknown }} */(obj).default != null
  ) {
    return /** @type {{ default?: unknown }} */(obj).default
  } else {
    return obj
  }
}

/**
 * If either `template.js` or `template.json` exists.  
 * Data will be write into .snapshot.json instead.
 */
class SplitJSONAdapter {
  /**
   * @param {string} dirPath
   * @param {SplitJSONAdapterOption} opts
   */
  constructor(dirPath, opts = {}) {
    /**
     * @type {string}
     */
    this.dirPath = dirPath

    /**
     * @type {boolean}
     */
    this.hasTypescriptSupport = false

    try {
      require('ts-node')
      require('typescript')
      this.hasTypescriptSupport = true
    } catch (err) {}

    /**
     * @type {Required<SplitJSONAdapterOption>}
     */
    this.opts = Object.assign({
      defaultValue: {},
      serialize: (/** @type {any} */data) => JSON.stringify(data, null, 4),
      deserialize: (/** @type {string} */string) => JSON.parse(string)
    }, opts)

    if (typeof this.opts.defaultValue == null) {
      throw new Error('base value cannot be empty')
    }

    if (typeof this.opts.defaultValue !== 'object') {
      throw new Error('base value must be a object')
    }

    if (Array.isArray(this.opts.defaultValue)) {
      throw new Error('base value cannot be a array')
    }
  }

  /**
   * 
   * @param {string} dirPath 
   */
  readKeys(dirPath) {
    const files = fs.readdirSync(dirPath)

    // keys must exist
    // file will be created if it does not exist
    /**
     * @type {Set<string>}
     */
    const defaultNames = new Set(Object.keys(this.opts.defaultValue))

    // .json
    /**
     * @type {Set<string>}
     */
    const existNames = new Set()

    // .template.json
    /**
     * @type {Set<string>}
     */
    const templateNames = new Set()

    // readonly
    // .js
    /**
     * @type {Set<string>}
     */
    const scriptNames = new Set()

    // readonly
    // .js
    /**
     * @type {Set<string>}
     */
     const typescriptNames = new Set()

    // read from template, write to snapshot
    // .template.js
    /**
     * @type {Set<string>}
     */
    const scriptTemplatedNames = new Set()

    // read from template, write to snapshot
    // .template.ts
    /**
     * @type {Set<string>}
     */
     const typescriptTemplatedNames = new Set()

    // read from template, write to snapshot
    // .snapshot.json
    /**
     * @type {Set<string>}
     */
    const snapshotNames = new Set()

    for (const fileName of files) {
      if (/\.d\.ts$/.test(fileName)) {
        // this isn't a script file
        continue
      }

      if (/\.template\.json$/.test(fileName)) {
        templateNames.add(fileName.replace(/\.template\.json$/, ''))
      } else if (/\.snapshot\.json$/.test(fileName)) {
        snapshotNames.add(fileName.replace(/\.snapshot\.json$/, ''))
      } else if (/\.json$/.test(fileName)) {
        existNames.add(fileName.replace(/\.json$/, ''))
      } else if (this.hasTypescriptSupport && /\.template\.ts$/.test(fileName)) {
        typescriptTemplatedNames.add(fileName.replace(/\.template\.ts$/, ''))
      } else if (/\.template\.js$/.test(fileName)) {
        scriptTemplatedNames.add(fileName.replace(/\.template\.js$/, ''))
      } else if (this.hasTypescriptSupport && /\.ts$/.test(fileName)) {
        typescriptNames.add(fileName.replace(/\.ts$/, ''))
      } else if (/\.js$/.test(fileName)) {
        scriptNames.add(fileName.replace(/\.js$/, ''))
      }
    }

    return {
      /** default value */
      defaultNames,
      /** json */
      existNames,
      /** template.json */
      templateNames,
      /** ts */
      typescriptNames,
      /** js */
      scriptNames,
      /** ts */
      typescriptTemplatedNames,
      /** template.js */
      scriptTemplatedNames,
      /** snapshot.json */
      snapshotNames
    }
  }
  /**
   * @param {FileKeys} keys
   */

  validateKeys(keys) {
    for (const key of keys.existNames) {
      if (keys.templateNames.has(key) || keys.scriptTemplatedNames.has(key)) {
        console.warn(`Data may be corrupted, ${key} presented in both template and data, remove one of them!!!`)
      }
    }

    for (const key of keys.scriptTemplatedNames) {
      if (keys.templateNames.has(key)) {
        console.warn(`Data may be corrupted, ${key} presented in both json and js template, js template will be used!!!`)
      }
    }
  }

  /**
   * @param {Set<T>[]} sets
   * @template T
   */
  addSets(...sets) {
    /**
     * @type {Set<T>}
     */
    const mergedSet = new Set()

    for (const set of sets) {
      for (const key of set) {
        mergedSet.add(key)
      }
    }

    return mergedSet
  }

  read() {
    mkdirp.sync(this.dirPath)
    const keys = this.readKeys(this.dirPath)
    this.validateKeys(keys)

    const mergedKeys = this.addSets(...Object.values(keys))

    /**
     * @type {Record<string, any>}
     */
    const res = {}

    /**
     * ```md
     *  - js
     *  - snapshot.json
     *  - json
     *  - template.js
     *  - template.json
     *  - <default value>
     */

    for (let key of mergedKeys) {
      if (keys.typescriptNames.has(key)) {
        const scriptPath = require.resolve(path.resolve(this.dirPath, key + '.ts'))
        delete require.cache[scriptPath]
        res[key] = JSON.parse(JSON.stringify(importDefault(require(scriptPath))))
        continue
      }

      if (keys.scriptNames.has(key)) {
        const scriptPath = require.resolve(path.resolve(this.dirPath, key + '.js'))
        delete require.cache[scriptPath]
        res[key] = JSON.parse(JSON.stringify(importDefault(require(scriptPath))))
        continue
      }

      if (keys.snapshotNames.has(key)) {
        const jsonPath = path.resolve(this.dirPath, key + '.snapshot.json')
        const json = readJSONSync(jsonPath, this.opts.deserialize)
        res[key] = json
        continue
      }

      if (keys.existNames.has(key)) {
        const jsonPath = path.resolve(this.dirPath, key + '.json')
        const json = readJSONSync(jsonPath, this.opts.deserialize)
        res[key] = json
        continue
      }

      if (keys.typescriptTemplatedNames.has(key)) {
        const scriptPath = require.resolve(path.resolve(this.dirPath, key + '.template.ts'))
        delete require.cache[scriptPath]
        res[key] = JSON.parse(JSON.stringify(importDefault(require(scriptPath))))
        continue
      }

      if (keys.scriptTemplatedNames.has(key)) {
        const scriptPath = require.resolve(path.resolve(this.dirPath, key + '.template.js'))
        delete require.cache[scriptPath]
        res[key] = JSON.parse(JSON.stringify(importDefault(require(scriptPath))))
        continue
      }

      if (keys.templateNames.has(key)) {
        const jsonPath = path.resolve(this.dirPath, key + '.template.json')
        const json = readJSONSync(jsonPath, this.opts.deserialize)
        res[key] = json
        continue
      }

      res[key] = this.opts.defaultValue[key]
    }

    return res
  }

  /**
   * 
   * @param {any} data 
   */
  write(data) {
    mkdirp.sync(this.dirPath)
    const keys = this.readKeys(this.dirPath)
    this.validateKeys(keys)

    const ignoredKeys = new Set([...keys.scriptNames, ...keys.typescriptNames]) // this need to be ignored
    const snapshotKeys = this.addSets(keys.templateNames, keys.typescriptTemplatedNames, keys.scriptTemplatedNames)

    for (const key of Object.keys(data)) {
      if (ignoredKeys.has(key)) {
        continue
      }

      if (snapshotKeys.has(key)) {
        const filePath = path.resolve(this.dirPath, key + '.snapshot.json')
        writeJSONSync(filePath, data[key], this.opts.serialize)
      } else {
        const filePath = path.resolve(this.dirPath, key + '.json')
        writeJSONSync(filePath, data[key], this.opts.serialize)
      }
    }
  }
}

module.exports = SplitJSONAdapter