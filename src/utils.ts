const crypto = require('crypto');

export function getRandomId() {
    return crypto.createHash('sha1').update(crypto.randomBytes(20)).digest();
}

export function getNeighborId(target, nid) {
    return Buffer.concat([target.slice(0, 15), nid.slice(15)]);
}
