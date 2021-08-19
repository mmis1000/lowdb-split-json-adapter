export = SplitJSONAdapter;
/**
 * If either `template.js` or `template.json` exists.
 * Data will be write into .snapshot.json instead.
 */
declare class SplitJSONAdapter {
    /**
     * @param {string} dirPath
     * @param {SplitJSONAdapterOption} opts
     */
    constructor(dirPath: string, opts?: SplitJSONAdapterOption);
    /**
     * @type {string}
     */
    dirPath: string;
    /**
     * @type {Required<SplitJSONAdapterOption>}
     */
    opts: Required<SplitJSONAdapterOption>;
    /**
     *
     * @param {string} dirPath
     */
    readKeys(dirPath: string): {
        /** default value */
        defaultNames: Set<string>;
        /** json */
        existNames: Set<string>;
        /** template.json */
        templateNames: Set<string>;
        /** js */
        scriptNames: Set<string>;
        /** template.js */
        scriptTemplatedNames: Set<string>;
        /** snapshot.json */
        snapshotNames: Set<string>;
    };
    /**
     * @param {FileKeys} keys
     */
    validateKeys(keys: FileKeys): void;
    /**
     * @param {Set<T>[]} sets
     * @template T
     */
    addSets<T>(...sets: Set<T>[]): Set<T>;
    read(): Record<string, any>;
    /**
     *
     * @param {any} data
     */
    write(data: any): void;
}
declare namespace SplitJSONAdapter {
    export { SplitJSONAdapterOption, FileKeys };
}
type SplitJSONAdapterOption = {
    defaultValue?: any;
    serialize?: ((arg: Record<string, any>) => string) | undefined;
    deserialize?: ((arg: string) => Record<string, any>) | undefined;
};
type FileKeys = {
    defaultNames: Set<string>;
    existNames: Set<string>;
    templateNames: Set<string>;
    scriptNames: Set<string>;
    scriptTemplatedNames: Set<string>;
    snapshotNames: Set<string>;
};