const dgram = require("dgram");
const crypto = require('crypto');
const DHT = require('bittorrent-dht')

import { EventEmitter } from "events";
import * as utils from "./utils";

class DHTSniffer extends EventEmitter {
    private _options: any;
    dht: any;
    latest_message_time: Date;
    refresh_interval_id: any;
    rpc: any;
    constructor(options) {
        super()
        this._options = Object.assign({
            port: 6881,
            refreshTime: 1 * 60 * 1000,
        }, options);
        this.initDHT();
    }
    initDHT() {
        const _this = this;
        this.dht = new DHT();
        this.rpc = this.dht._rpc;
        this.dht.listen(this._options.port, () => {
            console.log(`DHT init: now listening:${_this._options.port}`)
        })
        this.dht.on("warning", (err) => _this.emit('warning', err));
        this.dht.on("error", (err) => _this.emit('error', err));
        this.dht.on("get_peers", infoHash => {
            _this.emit('infoHash', infoHash)
        });

        this.dht.on('node', function (node) {
            _this.latest_message_time = new Date();
            _this.findNode(node, node.id);
        });
        /**
         *  If no request is received within a configured period, lookup some new nodes
         */
        this.refresh_interval_id = setInterval(() => {
            const nodes = this.dht.toJSON().nodes;
            if (new Date().getTime() - this.latest_message_time.getTime() > this._options.refreshTime) {
                if (nodes.length === 0) {
                    _this.dht._rpc.bootstrap.forEach((node) => _this.findNode(node, _this.rpc.id))
                } else {
                    nodes.map(node => {
                        if (Math.random() > 0.5) {
                            _this.findNode(node, _this.rpc.id);
                        }
                    })
                }
            }
            console.log("nodes:", nodes.length);
        }, this._options.refreshTime)
    }
    findNode(node, nid) {
        let id = nid !== undefined ? utils.getNeighborId(nid, this.dht.nodeId) : this.dht.nodeId;
        let message = {
            t: crypto.randomBytes(2),
            y: 'q',
            q: 'find_node',
            a: {
                id,
                target: utils.getRandomId()
            }
        };
        this.dht._rpc.query(node, message);
    }
}


export {
    DHTSniffer
}
