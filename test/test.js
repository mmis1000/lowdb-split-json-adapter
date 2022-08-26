const low = require('lowdb')
const Adapter = require('../')
const path = require('path')
const { promises: fs } = require('fs')

describe('tests', () => {
    let adapter, db
    beforeEach(async () => {
        adapter = new Adapter(path.resolve(__dirname, 'tmp'))
        jest.resetModules();
        db = low(adapter)

        await fs.rm(path.resolve(__dirname, 'tmp'), { recursive: true })
        await fs.mkdir(path.join(__dirname, 'tmp'), { recursive: true })

        const files = await fs.readdir(path.join(__dirname, 'fixtures'))

        for (const file of files) {
            if (!file.endsWith('.snapshot.json')) {
                await fs.copyFile(
                    path.resolve(__dirname, 'fixtures', file),
                    path.resolve(__dirname, 'tmp', file)
                )
            }
        }

        db.read()
    });

    afterEach(() => {
        return fs.rm(path.resolve(__dirname, 'tmp'), { recursive: true })
    });

    async function expectFileEqual(originalPath, newPath) {
        const original = fs.readFile(originalPath, 'utf8')
        const file = fs.readFile(newPath, 'utf8')
        expect(original).toEqual(file)
    }

    function reload () {
        // after read
        jest.resetModules();
        db = low(adapter)
        db.read()
    }

    it('do write actual file if source is store', async () => {
        db.get('user').find({ id: 0 }).assign({ money: 13 }).write()

        reload ()

        let current = db.get('user').find({ id: 0 }).value()
        expect(current.money).toEqual(13)

        expect(
            await fs.readFile(path.resolve(__dirname, 'tmp', 'user.json'), 'utf-8')
        ).not.toBe(
            await fs.readFile(path.resolve(__dirname, 'fixtures', 'user.json'), 'utf-8')
        )
    })


    it('do not write actual file if source is template', async () => {
        const item = { user: 'a', token: 'b' }
        db.get('__session').push(item).write()

        let current = db.get('__session').value()
        expect(current).toEqual([item])

        expect(
            await fs.readFile(path.resolve(__dirname, 'tmp', '__session.template.json'), 'utf-8')
        ).toBe(
            await fs.readFile(path.resolve(__dirname, 'fixtures', '__session.template.json'), 'utf-8')
        )
    })

    it('do write to snapshot file if source is template js', async () => {
        const item = { id: 999, name: 'aaaa' }
        db.get('tags').push(item).write()

        reload ()

        let current = db.get('tags').find({ id: 999 }).value()
        expect(current.name).toEqual('aaaa')

        expect(
            await fs.stat(path.resolve(__dirname, 'tmp', 'tags.snapshot.json'), 'utf-8')
        ).not.toBeFalsy()
    })

    it('do write to snapshot file if source is template ts', async () => {
        const item = { id: 999, name: 'aaaa' }
        db.get('tags1').push(item).write()

        reload ()

        let current = db.get('tags1').find({ id: 999 }).value()
        expect(current.name).toEqual('aaaa')

        expect(
            await fs.stat(path.resolve(__dirname, 'tmp', 'tags1.snapshot.json'), 'utf-8')
        ).not.toBeFalsy()
    })

    it('do read from snapshot file if source is template', async () => {
        const item = { user: 'a', token: 'b' }
        db.get('__session').push(item).write()

        let current = db.get('__session').value()
        expect(current).toEqual([item])

        reload ()

        current = db.get('__session').value()
        expect(current).toEqual([item])
    })

    it('does not write anything when target is js', async () => {
        expect(db.get('price').value().price).toBe(50)
        db.get('price').assign({ price: 100 }).write()
        expect(db.get('price').value().price).toBe(100)

        reload ()

        expect(db.get('price').value().price).toBe(50)
        expect(
            (await fs.readdir(path.resolve(__dirname, 'fixtures')))
                .find(it => it === 'price.snapshot.json')
        ).toEqual(undefined)
    })

    it('does not write anything when target is js', async () => {
        expect(db.get('data').value().value).toBe(50)
        db.get('data').assign({ value: 100 }).write()
        expect(db.get('data').value().value).toBe(100)

        reload ()

        expect(db.get('data').value().value).toBe(50)
        expect(
            (await fs.readdir(path.resolve(__dirname, 'fixtures')))
                .find(it => it === 'price.snapshot.json')
        ).toEqual(undefined)
        expect(
            (await fs.readdir(path.resolve(__dirname, 'fixtures')))
                .find(it => it === 'data.snapshot.json')
        ).toEqual(undefined)
        expect(
            (await fs.readdir(path.resolve(__dirname, 'fixtures')))
                .find(it => it === 'data.json')
        ).toEqual(undefined)
    })
    it('does load default as value when source is esModule transpiled file', async () => {
        expect(db.get('esmodule').value().value).toBe(51)
        expect(db.get('esmodule-ts').value().value).toBe(52)
    })
})