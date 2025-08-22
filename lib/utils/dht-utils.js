(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "crypto"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getRandomId = getRandomId;
    exports.getNeighborId = getNeighborId;
    exports.isNodeId = isNodeId;
    exports.parseNodes = parseNodes;
    exports.getPeerKey = getPeerKey;
    const crypto = require("crypto");
    function getRandomId() {
        return crypto.createHash('sha1').update(crypto.randomBytes(20)).digest();
    }
    function getNeighborId(target, nid) {
        return Buffer.concat([target.slice(0, 15), nid.slice(15)]);
    }
    function parseIp(buf, offset) {
        return buf[offset++] + '.' + buf[offset++] + '.' + buf[offset++] + '.' + buf[offset++];
    }
    function isNodeId(id, idLength) {
        return id && Buffer.isBuffer(id) && id.length === idLength;
    }
    function parseNodes(buf, idLength) {
        const pNodes = [];
        try {
            for (let i = 0; i < buf.length; i += (idLength + 6)) {
                const port = buf.readUInt16BE(i + (idLength + 4));
                if (!port)
                    continue;
                pNodes.push({
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
        return pNodes;
    }
    function getPeerKey(peer) {
        return `${peer.host}:${peer.port}`;
    }
});
