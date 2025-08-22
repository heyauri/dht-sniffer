(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "../utils/dht-utils", "net", "./ut_metadata", "../bittorrent-protocol", "../bencode", "crypto", "../errors/error-types"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.parseMetaData = exports.fetch = void 0;
    const dht_utils_1 = require("../utils/dht-utils");
    const net = require("net");
    const ut_metadata_1 = require("./ut_metadata");
    const bittorrent_protocol_1 = require("../bittorrent-protocol");
    const bencode = require("../bencode");
    const crypto = require("crypto");
    const error_types_1 = require("../errors/error-types");
    function fetch(target, config) {
        return new Promise((resolve, reject) => {
            let peer = target.peer;
            let infoHash = target.infoHash;
            const socket = net.createConnection(peer.port, peer.host || peer.address);
            socket.setTimeout(config.downloadMaxTime || 30000);
            socket.on('connect', () => {
                const wire = new bittorrent_protocol_1.default();
                socket.pipe(wire).pipe(socket);
                wire.use((0, ut_metadata_1.default)(wire));
                wire.handshake(infoHash, (0, dht_utils_1.getRandomId)());
                wire.ut_metadata.on('metadata', (metadata) => {
                    resolve(metadata);
                    socket.end();
                    wire.destroy();
                })(wire).ut_metadata.on('warning', (err) => {
                    reject(new error_types_1.MetadataError(`Metadata warning: ${err.message || err}`, {
                        operation: 'metadata_fetch',
                        peer: { host: peer.host, port: peer.port },
                        infoHash: infoHash.toString('hex')
                    }, true));
                    wire.destroy();
                });
                wire.on('handshake', (_infoHash, _peerId) => {
                    wire.ut_metadata.fetch();
                });
            });
            socket.on('error', function (err) {
                socket.destroy();
                reject(new error_types_1.NetworkError(`Socket error: ${err.message || err}`, {
                    operation: 'socket_connect',
                    peer: { host: peer.host, port: peer.port },
                    infoHash: infoHash.toString('hex')
                }, true));
            });
            socket.on('timeout', function () {
                socket.destroy();
                reject(new error_types_1.TimeoutError(`Connection timeout to ${peer.host}:${peer.port}`, {
                    operation: 'socket_connect',
                    peer: { host: peer.host, port: peer.port },
                    infoHash: infoHash.toString('hex'),
                    timeoutMs: config.downloadMaxTime || 30000
                }));
            });
            socket.once('close', function (hadError) {
                if (hadError) {
                    reject(new error_types_1.NetworkError('Socket closed with error', {
                        operation: 'socket_close',
                        peer: { host: peer.host, port: peer.port },
                        infoHash: infoHash.toString('hex'),
                        hadError: true
                    }, true));
                }
                else {
                    resolve(Buffer.from('success'));
                }
            });
        });
    }
    exports.fetch = fetch;
    function parseMetaData(rawMetadata) {
        let metadata = bencode.decode(rawMetadata);
        let infoHash = crypto.createHash('sha1').update(bencode.encode(metadata["info"])).digest();
        let torrentType = "single";
        let filePaths = [];
        let size = 0;
        if (Object.prototype.toString.call(metadata.info.files) === "[object Array]") {
            torrentType = "multiple";
            let arr = [];
            for (let item of metadata.info.files) {
                try {
                    if (item['path']) {
                        let str = item['path'].toString();
                        if (str !== '') {
                            arr.push(str);
                        }
                    }
                    if (item['length']) {
                        size += item['length'];
                    }
                }
                catch (e) {
                }
            }
            filePaths = arr;
        }
        else if (metadata.info.files) {
            if (metadata.info.files['path']) {
                filePaths = [metadata.info.files['path'].toString()];
            }
        }
        else if (!metadata.info.files && metadata.info["length"]) {
            size = metadata.info.length;
            filePaths.push(metadata.info.name.toString());
        }
        return {
            infoHash,
            name: metadata.info.name.toString(),
            size,
            torrentType: torrentType,
            filePaths,
            info: metadata.info,
            rawMetadata
        };
    }
    exports.parseMetaData = parseMetaData;
});
