"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DHTSniffer = void 0;
const crypto = require("crypto");
const dht_1 = require("./dht");
const metadataHelper = require("./metadata-helper");
const events_1 = require("events");
const utils = require("./utils");
const LRU = require("lru-cache");
class DHTSniffer extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.parseMetaData = metadataHelper.parseMetaData;
        this._options = Object.assign({
            port: 6881,
            refreshTime: 1 * 60 * 1000,
            maximumParallelFetchingTorrent: 25,
            maximumWaitingQueueSize: -1,
            downloadMaxTime: 30000,
            aggressive: false,
            ignoreFetched: false,
        }, options);
        this.status = false;
        this.metadataWaitingQueues = [];
        this.metadataFetchingDict = {};
        this.fetchdCache = new LRU({ max: 10000, ttl: 60 * 60 * 1000 });
    }
    start() {
        const _this = this;
        if (this.status) {
            console.log('The sniffer is already working');
            return;
        }
        this.dht = new dht_1.DHT();
        this.rpc = this.dht._rpc;
        this.latestReceive = new Date();
        this.dht.listen(this._options.port, () => {
            console.log(`DHT init: now listening:${_this._options.port}`);
        });
        this.dht.on('warning', err => _this.emit('warning', err));
        this.dht.on('error', err => _this.emit('error', err));
        this.dht.on('get_peers', data => {
            _this.emit('infoHash', data["infoHash"], data["peer"]);
        });
        this.dht.on('node', function (node) {
            _this.latestReceive = new Date();
            _this.emit('node', node);
            _this.findNode(node, node.id);
        });
        this.refreshIntervalId = setInterval(() => {
            const nodes = this.dht.toJSON().nodes;
            if (_this._options["aggressive"] || new Date().getTime() - _this.latestReceive.getTime() > _this._options.refreshTime) {
                if (nodes.length === 0) {
                    _this.dht._rpc.bootstrap.forEach(node => _this.findNode(node, _this.rpc.id));
                }
                else {
                    nodes.map(node => {
                        if (Math.random() > 0.5) {
                            _this.findNode(node, _this.rpc.id);
                        }
                    });
                }
            }
            if (nodes === 0) {
                _this.dht.bootstrap();
            }
            console.log('nodes:', nodes.length);
        }, this._options.refreshTime);
        this.status = true;
    }
    stop() {
        const _this = this;
        this.dht.destory(() => {
            clearInterval(_this.refreshIntervalId);
            _this.status = false;
        });
    }
    findNode(peer, nid) {
        const _this = this;
        let id = nid !== undefined ? utils.getNeighborId(nid, this.dht.nodeId) : this.dht.nodeId;
        let message = {
            t: crypto.randomBytes(4),
            y: 'q',
            q: 'find_node',
            a: {
                id,
                target: crypto.randomBytes(20)
            }
        };
        this.dht._rpc.query(peer, message, (err, reply) => {
            try {
                if (peer && peer.id && _this.rpc.nodes.get(peer.id) && utils.isNodeId(peer.id, 20)) {
                    if (err && (err.code === 'EUNEXPECTEDNODE' || err.code === 'ETIMEDOUT')) {
                        _this.rpc.remove(peer.id);
                    }
                }
            }
            catch (e) {
            }
            if (reply && reply.r && reply.r.nodes) {
                let nodes = utils.parseNodes(reply.r.nodes, 20);
                for (let node of nodes) {
                    if (utils.isNodeId(node.id, 20)) {
                        _this.dht.addNode(node);
                    }
                }
            }
        });
    }
    fetchMetaData(infoHash, peer) {
        this.metadataWaitingQueues.unshift({ infoHash, peer });
        if (this._options.maximumWaitingQueueSize > 0 && this.metadataWaitingQueues.length > this._options.maximumWaitingQueueSize) {
            this.metadataWaitingQueues.pop();
        }
        this.dispatchMetadata();
    }
    dispatchMetadata() {
        let _this = this;
        let fetchings = Object.keys(this.metadataFetchingDict);
        if (fetchings.length > this._options.maximumParallelFetchingTorrent) {
            return;
        }
        let nextFetching = this.metadataWaitingQueues.pop();
        if (!nextFetching)
            return;
        let nextFetchingKey = JSON.stringify(nextFetching);
        if (this._options["ignoreFetched"] && this.fetchdCache.get(nextFetchingKey)) {
            return;
        }
        let { infoHash, peer } = nextFetching;
        this.metadataFetchingDict[nextFetchingKey] = 1;
        this.fetchdCache.set(nextFetchingKey, 1);
        metadataHelper
            .fetch({
            infoHash,
            peer
        }, this._options)
            .then(metadata => {
            if (metadata === undefined)
                return;
            _this.emit('metadata', infoHash, metadata);
        }).catch(error => {
            _this.emit('metadataError', {
                infoHash,
                error
            });
        }).finally(() => {
            _this.dispatchMetadata();
            Reflect.deleteProperty(_this.metadataFetchingDict, nextFetchingKey);
        });
    }
    getSizes() {
        let fetchings = Object.keys(this.metadataFetchingDict);
        console.log(fetchings.length, this.metadataWaitingQueues.length, this.fetchdCache.keyMap.size);
    }
}
exports.DHTSniffer = DHTSniffer;
