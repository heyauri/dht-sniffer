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
var utils = require("./utils");
var DHTSniffer = (function (_super) {
    __extends(DHTSniffer, _super);
    function DHTSniffer(options) {
        var _this_1 = _super.call(this) || this;
        _this_1._options = Object.assign({
            port: 6881,
            refreshTime: 1 * 60 * 1000,
        }, options);
        _this_1.initDHT();
        return _this_1;
    }
    DHTSniffer.prototype.initDHT = function () {
        var _this_1 = this;
        var _this = this;
        this.dht = new DHT();
        this.rpc = this.dht._rpc;
        this.dht.listen(this._options.port, function () {
            console.log("DHT init: now listening:" + _this._options.port);
        });
        this.dht.on("warning", function (err) { return _this.emit('warning', err); });
        this.dht.on("error", function (err) { return _this.emit('error', err); });
        this.dht.on("get_peers", function (infoHash) {
            _this.emit('infoHash', infoHash);
        });
        this.dht.on('node', function (node) {
            _this.latest_message_time = new Date();
            _this.findNode(node, node.id);
        });
        this.refresh_interval_id = setInterval(function () {
            var nodes = _this_1.dht.toJSON().nodes;
            if (new Date().getTime() - _this_1.latest_message_time.getTime() > _this_1._options.refreshTime) {
                if (nodes.length === 0) {
                    _this.dht._rpc.bootstrap.forEach(function (node) { return _this.findNode(node, _this.rpc.id); });
                }
                else {
                    nodes.map(function (node) {
                        if (Math.random() > 0.5) {
                            _this.findNode(node, _this.rpc.id);
                        }
                    });
                }
            }
            console.log("nodes:", nodes.length);
        }, this._options.refreshTime);
    };
    DHTSniffer.prototype.findNode = function (node, nid) {
        var id = nid !== undefined ? utils.getNeighborId(nid, this.dht.nodeId) : this.dht.nodeId;
        var message = {
            t: crypto.randomBytes(2),
            y: 'q',
            q: 'find_node',
            a: {
                id: id,
                target: utils.getRandomId()
            }
        };
        this.dht._rpc.query(node, message);
    };
    return DHTSniffer;
}(events_1.EventEmitter));
exports.DHTSniffer = DHTSniffer;
