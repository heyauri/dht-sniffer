(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "../bittorrent-protocol", "../bencode", "../utils/error-handler"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.parseMetaData = exports.fetch = void 0;
    const utils = require("../utils");
    const net = require('net');
    const ut_metadata = require('./ut_metadata');
    const bittorrent_protocol_1 = require("../bittorrent-protocol");
    const bencode_1 = require("../bencode");
    const crypto = require('crypto');
    const error_handler_1 = require("../utils/error-handler");
    function fetch(target, config) {
        return new Promise((resolve, reject) => {
            let peer = target.peer;
            let infoHash = target.infoHash;
            const socket = net.createConnection(peer.port, peer.host || peer.address);
            socket.setTimeout(config.downloadMaxTime || 30000);
            socket.on('connect', () => {
                const wire = new bittorrent_protocol_1.default();
                socket.pipe(wire).pipe(socket);
                wire.use(ut_metadata());
                wire.handshake(infoHash, utils.getRandomId());
                wire.ut_metadata.on('metadata', metadata => {
                    resolve(metadata);
                    socket.end();
                    wire.destroy();
                });
                wire.ut_metadata.on('warning', err => {
                    reject(new error_handler_1.MetadataError(`Metadata warning: ${err.message || err}`, {
                        operation: 'metadata_fetch',
                        peer: { host: peer.host, port: peer.port },
                        infoHash: infoHash.toString('hex')
                    }, err instanceof Error ? err : new Error(String(err))));
                    wire.destroy();
                });
                wire.on('handshake', (infoHash, peerId) => {
                    wire.ut_metadata.fetch();
                });
            });
            socket.on('error', function (err) {
                socket.destroy();
                reject(new error_handler_1.NetworkError(`Socket error: ${err.message || err}`, {
                    operation: 'socket_connect',
                    peer: { host: peer.host, port: peer.port },
                    infoHash: infoHash.toString('hex')
                }, err instanceof Error ? err : new Error(String(err))));
            });
            socket.on('timeout', function (err) {
                socket.destroy();
                reject(new error_handler_1.TimeoutError(`Connection timeout to ${peer.host}:${peer.port}`, {
                    operation: 'socket_connect',
                    peer: { host: peer.host, port: peer.port },
                    infoHash: infoHash.toString('hex'),
                    timeoutMs: config.downloadMaxTime || 30000
                }, err instanceof Error ? err : new Error(String(err))));
            });
            socket.once('close', function (hadError) {
                if (hadError) {
                    reject(new error_handler_1.NetworkError('Socket closed with error', {
                        operation: 'socket_close',
                        peer: { host: peer.host, port: peer.port },
                        infoHash: infoHash.toString('hex'),
                        hadError: true
                    }));
                }
                else {
                    resolve(true);
                }
            });
        });
    }
    exports.fetch = fetch;
    function parseMetaData(rawMetadata) {
        let metadata = bencode_1.default.decode(rawMetadata);
        let infoHash = crypto.createHash('sha1').update(bencode_1.default.encode(metadata["info"])).digest();
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
                filePaths = metadata.info.files['path'].toString();
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
            torrentType,
            filePaths,
            info: metadata.info,
            rawMetadata
        };
    }
    exports.parseMetaData = parseMetaData;
});
