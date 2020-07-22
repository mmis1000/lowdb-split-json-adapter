const low = require('lowdb')
const Adapter = require('../')
const path = require('path')

const adapter = new Adapter(path.resolve(__dirname, 'data'))
const db = low(adapter)

console.log(db.value())
console.log(db.get('__session').value())
db.get('__session').push({ user: 'a', token: 'b' }).write()

const user = db.get('user').find({ id: 0 })
user.assign({ money: user.value().money + 1 }).write()

const tags = db.get('tags')
tags.forEach((v) => {
    v.name = v.id + ' new'
}).write()

console.log(db.get('price').value())
db.get('price').assign({ price: 999 }).write()
console.log(db.get('price').value())