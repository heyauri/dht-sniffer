"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseNodes = exports.isNodeId = exports.getNeighborId = exports.getRandomId = void 0;
const crypto = require('crypto');
function getRandomId() {
    return crypto.createHash('sha1').update(crypto.randomBytes(20)).digest();
}
exports.getRandomId = getRandomId;
function getNeighborId(target, nid) {
    return Buffer.concat([target.slice(0, 15), nid.slice(15)]);
}
exports.getNeighborId = getNeighborId;
function parseIp(buf, offset) {
    return buf[offset++] + '.' + buf[offset++] + '.' + buf[offset++] + '.' + buf[offset++];
}
function isNodeId(id, idLength) {
    return id && Buffer.isBuffer(id) && id.length === idLength;
}
exports.isNodeId = isNodeId;
function parseNodes(buf, idLength) {
    var contacts = [];
    try {
        for (var i = 0; i < buf.length; i += (idLength + 6)) {
            var port = buf.readUInt16BE(i + (idLength + 4));
            if (!port)
                continue;
            contacts.push({
                id: buf.slice(i, i + idLength),
                host: parseIp(buf, i + idLength),
                port: port,
                distance: 0,
                token: null
            });
        }
    }
    catch (err) {
    }
    return contacts;
}
exports.parseNodes = parseNodes;
