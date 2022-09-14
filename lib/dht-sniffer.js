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
            maximumParallelFetchingTorrent: 16,
            maximumWaitingQueueSize: -1,
            downloadMaxTime: 30000,
            aggressive: false,
            ignoreFetched: true,
            concurrency: 16,
            fetchdTupleSize: 4000,
            fetchdInfoHashSize: 1000,
            findNodeCacheSize: 4000
        }, options);
        this.status = false;
        this.metadataWaitingQueues = [];
        this.nodes = [];
        this.metadataFetchingDict = {};
        this.fetchdTuple = new LRU({ max: this._options.fetchdTupleSize, ttl: 3 * 60 * 60 * 1000 });
        this.fetchdInfoHash = new LRU({ max: this._options.fetchdInfoHashSize, ttl: 24 * 60 * 60 * 1000 });
        this.findNodeCache = new LRU({ max: this._options.findNodeCacheSize, ttl: 24 * 60 * 60 * 1000, updateAgeOnHas: true });
        this.latestCalledPeers = new LRU({ max: 1000, ttl: 5 * 60 * 1000 });
        this.metadataFetchingCache = new LRU({ max: 1000, ttl: 20 * 1000 });
    }
    start() {
        const _this = this;
        if (this.status) {
            console.log('The sniffer is already working');
            return;
        }
        this.dht = new dht_1.DHT({
            concurrency: this._options.concurrency || 16
        });
        this.rpc = this.dht._rpc;
        this.latestReceive = new Date();
        this.dht.listen(this._options.port, () => {
            console.log(`DHT init: now listening:${_this._options.port}`);
        });
        this.dht.on('warning', err => _this.emit('warning', err));
        this.dht.on('error', err => _this.emit('error', err));
        this.dht.on('get_peers', data => {
            _this.dht.addNode(data["peer"]);
            _this.emit('infoHash', data["infoHash"], data["peer"]);
        });
        this.dht.on('node', function (node) {
            _this.latestReceive = new Date();
            _this.emit('node', node);
            let nodeKey = `${node["host"]}:${node["port"]}`;
            if (!_this.findNodeCache.get(nodeKey) && !_this.latestCalledPeers.get(nodeKey) && Math.random() > _this.rpc.pending.length / 10 && _this.nodes.length < 200) {
                _this.findNode(node, node.id);
            }
        });
        this.dht.on('peer', function (peer, infoHash, from) {
            peer["id"] = crypto.createHash('sha1').update(`${peer.host}:${peer.port}`).digest();
            _this.dht.addNode(peer);
            _this.addQueuingMetadata(infoHash, peer, true);
        });
        this.refreshIntervalId = setInterval(() => {
            let nodes = this.dht._rpc.nodes.toArray();
            this.nodes = nodes;
            utils.shuffle(this.nodes);
            if (_this._options["aggressive"] || new Date().getTime() - _this.latestReceive.getTime() > _this._options.refreshTime) {
                nodes.map(node => {
                    let nodeKey = `${node["host"]}:${node["port"]}`;
                    if (!_this.latestCalledPeers.get(nodeKey) && _this.nodes.length < 400 && _this.metadataWaitingQueues.length < 1000 && Math.random() > _this.rpc.pending.length / 12) {
                        _this.findNode(node, _this.rpc.id);
                    }
                });
            }
            if (nodes.length <= 3) {
                _this.dht._bootstrap(true);
            }
            if (_this.rpc.pending.length > 1000) {
                _this.reduceRPCPendingArray();
            }
            if (_this.metadataWaitingQueues.length > 100) {
                utils.shuffle(_this.metadataWaitingQueues);
            }
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
        let nodeKey = `${peer["host"]}:${peer["port"]}`;
        this.findNodeCache.set(nodeKey, 1);
        this.latestCalledPeers.set(nodeKey, 1);
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
    fetchMetaData(infoHash, peer, mode = false) {
        const _this = this;
        if (mode === false) {
            if (!peer || (peer.host === undefined || peer.port === undefined))
                return false;
        }
        if (peer) {
            this.addQueuingMetadata(infoHash, peer);
        }
        if (mode) {
            this.dht.lookup(infoHash, function (err, totalNodes) {
                if (err) {
                    _this.emit("error", err);
                }
                else {
                }
            });
        }
    }
    addQueuingMetadata(infoHash, peer, reverse = false) {
        let arr = this.metadataWaitingQueues;
        reverse ? arr.unshift({ infoHash, peer }) : arr.push({ infoHash, peer });
        if (this._options.maximumWaitingQueueSize > 0 && arr.length > this._options.maximumWaitingQueueSize) {
            arr.shift();
        }
        this.dispatchMetadata();
    }
    dispatchMetadata() {
        let _this = this;
        let fetchings = Object.keys(this.metadataFetchingDict);
        if (fetchings.length >= this._options.maximumParallelFetchingTorrent) {
            return;
        }
        let nextFetching = this.metadataWaitingQueues.pop();
        if (!nextFetching)
            return;
        let { infoHash, peer } = nextFetching;
        let infoHashStr = infoHash.toString("hex");
        let nextFetchingKey = this.getNextFetchingKey(nextFetching);
        if (Reflect.has(this.metadataFetchingDict, infoHashStr)) {
            this.metadataWaitingQueues.unshift(nextFetching);
            if (!this.metadataFetchingCache.get(infoHashStr)) {
                this.metadataFetchingCache.set(infoHashStr, 1);
                this.dispatchMetadata();
            }
            return;
        }
        if (this._options["ignoreFetched"] && this.fetchdTuple.get(nextFetchingKey)) {
            this.dispatchMetadata();
            return;
        }
        if (this._options["ignoreFetched"] && this.fetchdInfoHash.get(infoHashStr)) {
            this.dispatchMetadata();
            return;
        }
        this.metadataFetchingDict[infoHashStr] = 1;
        this.fetchdTuple.set(nextFetchingKey, 1);
        metadataHelper
            .fetch({
            infoHash,
            peer
        }, this._options)
            .then(metadata => {
            if (metadata === undefined)
                return;
            _this.emit('metadata', infoHash, metadata);
            _this.fetchdInfoHash.set(infoHashStr, 1);
        }).catch(error => {
            _this.emit('metadataError', {
                infoHash,
                error
            });
        }).finally(() => {
            _this.dispatchMetadata();
            Reflect.deleteProperty(_this.metadataFetchingDict, infoHashStr);
        });
        this.dispatchMetadata();
    }
    getSizes() {
        let fetchings = Object.keys(this.metadataFetchingDict);
        return {
            fetchingNum: fetchings.length,
            metadataWaitingQueueSize: this.metadataWaitingQueues.length,
            fetchdTupleSize: this.fetchdTuple.keyMap.size,
            fetchdInfoHashSize: this.fetchdInfoHash.keyMap.size,
            metadataFetchingCacheSize: this.metadataFetchingCache.keyMap.size,
            rpcPendingSize: this.rpc.pending.length,
            nodeListSize: this.nodes.length
        };
    }
    reduceRPCPendingArray() {
        let pending = this.rpc.pending.slice(0, 1000);
        this.rpc.pending = pending;
    }
    getNextFetchingKey(nextFetching) {
        let { infoHash, peer } = nextFetching;
        return `${peer["host"]}:${peer["port"]}-${infoHash.toString("hex")}`;
    }
}
exports.DHTSniffer = DHTSniffer;
