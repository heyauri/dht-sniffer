"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DHTSniffer = void 0;
var dgram = require("dgram");
var crypto = require('crypto');
var DHT = require('bittorrent-dht');
var events_1 = require("events");
var DHTSniffer = (function (_super) {
    __extends(DHTSniffer, _super);
    function DHTSniffer(options) {
        var _this = _super.call(this) || this;
        _this._options = Object.assign({
            port: 6881
        }, options);
        _this.initDHT();
        return _this;
    }
    DHTSniffer.prototype.initDHT = function () {
        var _this = this;
        this.dht = new DHT();
        this.dht.listen(this._options.port, function () {
            console.log("DHT init: now listening:" + _this._options.port);
        });
        this.dht.on('peer', function (peer, infoHash, from) {
            console.log('found potential peer ' + peer.host + ':' + peer.port + ' through ' + from.address + ':' + from.port + (" infoHash" + infoHash));
        });
        this.dht.on('node', function (node) { console.log("node", node); });
        setInterval(function () {
            var nodes = _this.dht.toJSON().nodes;
            console.log(nodes);
        }, 60000);
    };
    return DHTSniffer;
}(events_1.EventEmitter));
exports.DHTSniffer = DHTSniffer;
