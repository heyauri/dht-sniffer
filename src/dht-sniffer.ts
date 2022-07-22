const dgram = require("dgram");
const crypto = require('crypto');
const DHT = require('bittorrent-dht')

import { EventEmitter } from "events";

class DHTSniffer extends EventEmitter {
    private _options: any;
    dht: any;
    constructor(options) {
        super()
        this._options = Object.assign({
            port: 6881
        }, options);
        this.initDHT();
    }
    initDHT() {
        this.dht = new DHT();
        this.dht.listen(this._options.port, () => {
            console.log(`DHT init: now listening:${this._options.port}`)
        })

        this.dht.on('peer', function (peer, infoHash, from) {
            console.log('found potential peer ' + peer.host + ':' + peer.port + ' through ' + from.address + ':' + from.port + ` infoHash${infoHash}`);
        })

        this.dht.on('node', function (node) { console.log("node", node) })
        setInterval(() => {
            const nodes = this.dht.toJSON().nodes;
            console.log(nodes);
        }, 60000)
    }
}


export {
    DHTSniffer
}
