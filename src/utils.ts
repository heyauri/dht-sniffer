const crypto = require('crypto');

export function getRandomId() {
    return crypto.createHash('sha1').update(crypto.randomBytes(20)).digest();
}

export function getNeighborId(target, nid) {
    return Buffer.concat([target.slice(0, 15), nid.slice(15)]);
}

/**
 * from package:k-rpc
 * @param buf
 * @param offset
 * @returns
 */
function parseIp(buf, offset) {
    return buf[offset++] + '.' + buf[offset++] + '.' + buf[offset++] + '.' + buf[offset++]
}
/**
 * modified from package:k-rpc
 * @param id
 * @param idLength
 * @returns
 */
export function isNodeId(id, idLength) {
    return id && Buffer.isBuffer(id) && id.length === idLength
}

/**
 * modified from package:k-rpc
 * @param buf
 * @param idLength
 * @returns
 */
export function parseNodes(buf, idLength) {
    var contacts = []
    try {
        for (var i = 0; i < buf.length; i += (idLength + 6)) {
            var port = buf.readUInt16BE(i + (idLength + 4))
            if (!port) continue
            contacts.push({
                id: buf.slice(i, i + idLength),
                host: parseIp(buf, i + idLength),
                port: port,
                distance: 0,
                token: null
            })
        }
    } catch (err) {
        // do nothing
    }
    return contacts
}

export function shuffle(array) {
    const length = array == null ? 0 : array.length
    if (!length) {
        return []
    }
    let index = -1
    const lastIndex = length - 1
    const result = array;
    while (++index < length) {
        const rand = index + Math.floor(Math.random() * (lastIndex - index + 1))
        const tmp = result[rand]
        result[rand] = result[index]
        result[index] = tmp
    }
    return result
}
