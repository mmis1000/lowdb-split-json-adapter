# Lowdb split JSON adapter

Unlike the original FileSync adapter from lowdb.  
This adapter split the JSON into multi files.  
And add additional template support.  
So you can have multi small JSON file instead of a giant one that lag your editor when mock large Services.

## Options

```ts
type AdapterOptions = {
    // This must be a object and not array
    defaultValue?: any
    // customize encode method
    serialize?: any => string
    // customize decode method
    deserialize?: string => any
}

class SplitJSONAdapter {
    /**
     * @param dirPath path to the directory that store JSON files
     * @param options optional options
     */
    constructor (dirPath: string, options: AdapterOptions = {}) {}
}
```

## Storage structure

Each field was a single json file, and the usage is determined by the file extension.

Available extensions:

1. .json  
    1. type: regular field
    2. mode: r/w
2. .template.json
    1. type: template a single field
    2. mode: r
3. .template.js
    1. type: template a single field.  
        Value of `module.exports` was used
    2. mode: r
4. .snapshot.json
    1. type: storage when try to write into read only `.template` field
    2. mode: r/w
5. .js
    1. type: template a single field.  
        Value of `module.exports` was used.  
        Value was **not** persistent into disk as `.snapshot.json`.
    2. mode: r

### When read the following dir

```txt
a.json
b.template.json
c.template.js
d.js
```

Will result in

```js
const object = {
    a: [/* ... */],
    b: [/* ... */],
    c: [/* ... */],
    d: [/* ... */]
}
```

### When you save above object the into the above dir

You get

```txt
a.json          // in place modified
b.template.json // untouched
b.snapshot.json // new
c.template.js   // untouched
c.snapshot.json // new
d.js            // untouched
```

So you can simply exclude all `.snapshot.json` from git or whatever while still keep it locally persistent.
