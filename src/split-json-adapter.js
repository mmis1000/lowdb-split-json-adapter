// @ts-check
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')

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
 * If either `template.js` or `template.json` exists.  
 * Data will be write into .snapshot.json instead.
 */
class SplitJSONAdapter {
  constructor(dirPath, opts = {}) {
    this.dirPath = dirPath

    this.opts = Object.assign({
      defaultValue: {},
      serialize: (data) => JSON.stringify(data, null, 4),
      deserialize: (string) => JSON.parse(string)
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

    // read from template, write to snapshot
    // .template.js
    /**
     * @type {Set<string>}
     */
    const scriptTemplatedNames = new Set()

    // read from template, write to snapshot
    // .snapshot.json
    /**
     * @type {Set<string>}
     */
    const snapshotNames = new Set()

    for (const fileName of files) {
      if (/\.template\.json$/.test(fileName)) {
        templateNames.add(fileName.replace(/\.template\.json$/, ''))
      } else if (/\.snapshot\.json$/.test(fileName)) {
        snapshotNames.add(fileName.replace(/\.snapshot\.json$/, ''))
      } else if (/\.json$/.test(fileName)) {
        existNames.add(fileName.replace(/\.json$/, ''))
      } else if (/\.template\.js$/.test(fileName)) {
        scriptTemplatedNames.add(fileName.replace(/\.template\.js$/, ''))
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
      /** js */
      scriptNames,
      /** template.js */
      scriptTemplatedNames,
      /** snapshot.json */
      snapshotNames
    }
  }

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
      if (keys.scriptNames.has(key)) {
        const scriptPath = path.resolve(this.dirPath, key + '.js')
        delete require.cache[scriptPath]
        res[key] = require(scriptPath)
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

      if (keys.scriptTemplatedNames.has(key)) {
        const scriptPath = path.resolve(this.dirPath, key + '.template.js')
        delete require.cache[scriptPath]
        res[key] = require(scriptPath)
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

    const ignoredKeys = keys.scriptNames // this need to be ignored
    const snapshotKeys = this.addSets(keys.templateNames, keys.scriptTemplatedNames)

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