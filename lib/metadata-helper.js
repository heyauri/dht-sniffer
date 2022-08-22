"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetch = void 0;
const utils = require("./utils");
const net = require('net');
const ut_metadata = require('ut_metadata');
const Protocol = require('bittorrent-protocol');
function fetch(target, config) {
    return new Promise((resolve, reject) => {
        let peer = target.peer;
        let infoHash = target.infoHash;
        const socket = net.createConnection(peer.port, peer.address);
        socket.setTimeout(config.downloadMaxTime || 30000);
        socket.on('connect', () => {
            const wire = new Protocol();
            socket.pipe(wire).pipe(socket);
            wire.use(ut_metadata());
            wire.handshake(infoHash, utils.getRandomId());
            wire.ut_metadata.on('metadata', metadata => {
                console.log("success", metadata);
                resolve(metadata);
                socket.end();
            });
            wire.ut_metadata.on('warning', err => {
                reject({ type: "metadataWarning", err });
            });
            wire.on('handshake', (infoHash, peerId) => {
                wire.ut_metadata.fetch();
            });
        });
        socket.on('error', function (err) {
            socket.destroy();
            reject({ type: "socketError", err });
        });
        socket.on('timeout', function (err) {
            socket.destroy();
            reject({ type: "timeout", err });
        });
        socket.once('close', function () {
        });
    });
}
exports.fetch = fetch;
