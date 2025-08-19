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
    exports.shuffle = shuffle;
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
        var pNodes = [];
        try {
            for (var i = 0; i < buf.length; i += (idLength + 6)) {
                var port = buf.readUInt16BE(i + (idLength + 4));
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
    function shuffle(array) {
        const length = array == null ? 0 : array.length;
        if (!length) {
            return [];
        }
        let index = -1;
        const lastIndex = length - 1;
        const result = array;
        while (++index < length) {
            const rand = index + Math.floor(Math.random() * (lastIndex - index + 1));
            const tmp = result[rand];
            result[rand] = result[index];
            result[index] = tmp;
        }
        return result;
    }
    function getPeerKey(peer) {
        return `${peer["host"]}:${peer["port"]}`;
    }
});
