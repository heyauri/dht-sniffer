"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNeighborId = exports.getRandomId = void 0;
var crypto = require('crypto');
function getRandomId() {
    return crypto.createHash('sha1').update(crypto.randomBytes(20)).digest();
}
exports.getRandomId = getRandomId;
function getNeighborId(target, nid) {
    return Buffer.concat([target.slice(0, 15), nid.slice(15)]);
}
exports.getNeighborId = getNeighborId;
