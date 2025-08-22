/*! ut_metadata. MIT License. WebTorrent LLC <https://webtorrent.io/opensource> */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "events", "../bencode", "bitfield", "debug", "../uint8-util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const events_1 = require("events");
    const bencode_1 = require("../bencode");
    const bitfield_1 = require("bitfield");
    const debug_1 = require("debug");
    const uint8_util_1 = require("../uint8-util");
    const debug = (0, debug_1.default)('ut_metadata');
    const MAX_METADATA_SIZE = 1E7;
    const BITFIELD_GROW = 1E3;
    const PIECE_LENGTH = 1 << 14;
    class utMetadata extends events_1.EventEmitter {
        static get name() {
            return 'ut_metadata';
        }
        constructor(wire, metadata) {
            super();
            this._wire = wire;
            this._fetching = false;
            this._metadataComplete = false;
            this._metadataSize = null;
            this._remainingRejects = null;
            this._bitfield = new bitfield_1.default(0, { grow: BITFIELD_GROW });
            if (ArrayBuffer.isView(metadata)) {
                this.setMetadata(metadata);
            }
        }
        onHandshake(infoHash, peerId, extensions) {
            this._infoHash = infoHash;
        }
        onExtendedHandshake(handshake) {
            if (!handshake.m || !handshake.m.ut_metadata) {
                return this.emit('warning', new Error('Peer does not support ut_metadata'));
            }
            if (!handshake.metadata_size) {
                return this.emit('warning', new Error('Peer does not have metadata'));
            }
            if (typeof handshake.metadata_size !== 'number' ||
                MAX_METADATA_SIZE < handshake.metadata_size ||
                handshake.metadata_size <= 0) {
                return this.emit('warning', new Error('Peer gave invalid metadata size'));
            }
            this._metadataSize = handshake.metadata_size;
            this._numPieces = Math.ceil(this._metadataSize / PIECE_LENGTH);
            this._remainingRejects = this._numPieces * 2;
            this._requestPieces();
        }
        onMessage(buf) {
            let dict;
            let trailer;
            try {
                const str = (0, uint8_util_1.arr2text)(buf);
                const trailerIndex = str.indexOf('ee') + 2;
                dict = bencode_1.default.decode(str.substring(0, trailerIndex));
                trailer = buf.slice(trailerIndex);
            }
            catch (err) {
                return;
            }
            switch (dict.msg_type) {
                case 0:
                    this._onRequest(dict.piece);
                    break;
                case 1:
                    this._onData(dict.piece, trailer, dict.total_size);
                    break;
                case 2:
                    this._onReject(dict.piece);
                    break;
            }
        }
        fetch() {
            if (this._metadataComplete) {
                return;
            }
            this._fetching = true;
            if (this._metadataSize) {
                this._requestPieces();
            }
        }
        cancel() {
            this._fetching = false;
        }
        setMetadata(metadata) {
            return __awaiter(this, void 0, void 0, function* () {
                if (this._metadataComplete)
                    return true;
                debug('set metadata');
                try {
                    const info = bencode_1.default.decode(metadata).info;
                    if (info) {
                        metadata = bencode_1.default.encode(info);
                    }
                }
                catch (err) { }
                if (this._infoHash && this._infoHash !== (yield (0, uint8_util_1.hash)(metadata, 'hex'))) {
                    return false;
                }
                this.cancel();
                this.metadata = metadata;
                this._metadataComplete = true;
                this._metadataSize = this.metadata.length;
                this._wire.extendedHandshake.metadata_size = this._metadataSize;
                this.emit('metadata', bencode_1.default.encode({
                    info: bencode_1.default.decode(this.metadata)
                }));
                return true;
            });
        }
        _send(dict, trailer) {
            let buf = bencode_1.default.encode(dict);
            if (ArrayBuffer.isView(trailer)) {
                buf = (0, uint8_util_1.concat)([buf, trailer]);
            }
            this._wire.extended('ut_metadata', buf);
        }
        _request(piece) {
            this._send({ msg_type: 0, piece });
        }
        _data(piece, buf, totalSize) {
            const msg = { msg_type: 1, piece };
            if (typeof totalSize === 'number') {
                msg.total_size = totalSize;
            }
            this._send(msg, buf);
        }
        _reject(piece) {
            this._send({ msg_type: 2, piece });
        }
        _onRequest(piece) {
            if (!this._metadataComplete) {
                this._reject(piece);
                return;
            }
            const start = piece * PIECE_LENGTH;
            let end = start + PIECE_LENGTH;
            if (end > this._metadataSize) {
                end = this._metadataSize;
            }
            const buf = this.metadata.slice(start, end);
            this._data(piece, buf, this._metadataSize);
        }
        _onData(piece, buf, totalSize) {
            if (buf.length > PIECE_LENGTH || !this._fetching) {
                return;
            }
            this.metadata.set(buf, piece * PIECE_LENGTH);
            this._bitfield.set(piece);
            this._checkDone();
        }
        _onReject(piece) {
            if (this._remainingRejects > 0 && this._fetching) {
                this._request(piece);
                this._remainingRejects -= 1;
            }
            else {
                this.emit('warning', new Error('Peer sent "reject" too much'));
            }
        }
        _requestPieces() {
            if (!this._fetching)
                return;
            this.metadata = new Uint8Array(this._metadataSize);
            for (let piece = 0; piece < this._numPieces; piece++) {
                this._request(piece);
            }
        }
        _checkDone() {
            return __awaiter(this, void 0, void 0, function* () {
                let done = true;
                for (let piece = 0; piece < this._numPieces; piece++) {
                    if (!this._bitfield.get(piece)) {
                        done = false;
                        break;
                    }
                }
                if (!done)
                    return;
                const success = yield this.setMetadata(this.metadata);
                if (!success) {
                    this._failedMetadata();
                }
            });
        }
        _failedMetadata() {
            this._bitfield = new bitfield_1.default(0, { grow: BITFIELD_GROW });
            this._remainingRejects -= this._numPieces;
            if (this._remainingRejects > 0) {
                this._requestPieces();
            }
            else {
                this.emit('warning', new Error('Peer sent invalid metadata'));
            }
        }
    }
    exports.default = utMetadata;
    utMetadata.prototype.name = 'ut_metadata';
});
