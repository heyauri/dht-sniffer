"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMetaData = exports.DHTSniffer = void 0;
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
            expandNodes: false,
            ignoreFetched: true,
            concurrency: 16,
            fetchedTupleSize: 4000,
            fetchedInfoHashSize: 1000,
            findNodeCacheSize: 4000,
            aggressiveLevel: 0
        }, options);
        this.status = false;
        this.metadataWaitingQueues = [];
        this.nodes = [];
        this.nodesDict = {};
        this.metadataFetchingDict = {};
        this.fetchedTuple = new LRU({ max: this._options.fetchedTupleSize, ttl: 3 * 60 * 60 * 1000 });
        this.fetchedInfoHash = new LRU({ max: this._options.fetchedInfoHashSize, ttl: 72 * 60 * 60 * 1000 });
        this.findNodeCache = new LRU({ max: this._options.findNodeCacheSize, ttl: 24 * 60 * 60 * 1000, updateAgeOnHas: true });
        this.latestCalledPeers = new LRU({ max: 1000, ttl: 5 * 60 * 1000 });
        this.usefulPeers = new LRU({ max: 5000 });
        this.metadataFetchingCache = new LRU({ max: 1000, ttl: 20 * 1000 });
        let aggressiveLevel = this._options["aggressiveLevel"];
        this.aggressiveLimit = aggressiveLevel && aggressiveLevel > 0 ? aggressiveLevel * this._options["maximumParallelFetchingTorrent"] : 0;
        this.counter = {
            fetchedTupleHit: 0,
            fetchedInfoHashHit: 0
        };
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
        this.startTime = Date.now();
        this.dht.listen(this._options.port, () => {
            console.log(`DHT init: now listening:${_this._options.port}`);
            _this.emit("start", Object.assign({ startTime: this.startTime }, _this._options));
        });
        this.dht.on('warning', err => _this.emit('warning', err));
        this.dht.on('error', err => _this.emit('error', err));
        this.dht.on('get_peers', data => {
            _this.importPeer(data["peer"]);
            _this.emit('infoHash', data["infoHash"], data["peer"]);
        });
        this.dht.on('node', function (node) {
            _this.latestReceive = new Date();
            _this.emit('node', node);
            let nodeKey = `${node["host"]}:${node["port"]}`;
            if (!_this.findNodeCache.get(nodeKey) && !_this.latestCalledPeers.get(nodeKey) && Math.random() > 0.1 +
                _this.rpc.pending.length / 10 && _this.nodes.length < 400) {
                _this.findNode(node, node.id);
            }
        });
        this.dht.on("addNode", node => {
        });
        this.dht.on('peer', function (peer, infoHash, from) {
            _this.importPeer(peer);
            _this.addQueuingMetadata(infoHash, peer, true);
        });
        this.refreshIntervalId = setInterval(() => {
            let nodes = this.dht._rpc.nodes.toArray();
            this.nodes = nodes;
            this.nodesDict = nodes.reduce((prev, curr) => {
                prev[utils.getPeerKey(curr)] = 1;
                return prev;
            }, {});
            utils.shuffle(this.nodes);
            if (_this._options["expandNodes"] || new Date().getTime() - _this.latestReceive.getTime() > _this._options.refreshTime) {
                nodes.map(node => {
                    let nodeKey = `${node["host"]}:${node["port"]}`;
                    if (_this.nodes.length < 5 || (!_this.latestCalledPeers.get(nodeKey) && _this.nodes.length < 400 && Math.random() > _this.rpc.pending.length / 12)) {
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
            this.boostMetadataFetching();
            this.importUsefulPeers();
        }, this._options.refreshTime);
        this.status = true;
    }
    stop() {
        const _this = this;
        this.dht.destroy(() => {
            clearInterval(_this.refreshIntervalId);
            _this.status = false;
            _this.emit("stop");
        });
    }
    findNode(peer, nid) {
        const _this = this;
        let nodeKey = utils.getPeerKey(peer);
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
                        _this.importPeer(node);
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
        let infoHashStr = infoHash.toString("hex");
        let obj = { infoHash, peer, infoHashStr };
        reverse ? arr.unshift(obj) : arr.push(obj);
        if (this._options.maximumWaitingQueueSize > 0 && arr.length > this._options.maximumWaitingQueueSize) {
            arr.shift();
        }
        this.dispatchMetadata();
        this.boostMetadataFetching();
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
        let { infoHash, infoHashStr, peer } = nextFetching;
        let nextFetchingKey = this.getNextFetchingKey(nextFetching);
        if (Reflect.has(this.metadataFetchingDict, infoHashStr)) {
            if (this.aggressiveLimit > 0 && this.aggressiveLimit > fetchings.length) {
            }
            else {
                this.metadataWaitingQueues.unshift(nextFetching);
                if (!this.metadataFetchingCache.get(infoHashStr)) {
                    this.metadataFetchingCache.set(infoHashStr, 1);
                    this.dispatchMetadata();
                }
                return;
            }
        }
        if (this._options["ignoreFetched"] && this.fetchedTuple.get(nextFetchingKey)) {
            this.counter.fetchedTupleHit++;
            this.dispatchMetadata();
            return;
        }
        if (this._options["ignoreFetched"] && this.fetchedInfoHash.get(infoHashStr)) {
            this.counter.fetchedInfoHashHit++;
            this.dispatchMetadata();
            return;
        }
        if (!this.metadataFetchingDict[infoHashStr]) {
            this.metadataFetchingDict[infoHashStr] = 1;
        }
        else if (this.aggressiveLimit > 0) {
            this.metadataFetchingDict[infoHashStr] += 1;
        }
        this.fetchedTuple.set(nextFetchingKey, 1);
        metadataHelper
            .fetch({
            infoHash,
            peer
        }, this._options)
            .then(metadata => {
            if (metadata === undefined)
                return;
            _this.emit('metadata', infoHash, metadata);
            _this.fetchedInfoHash.set(infoHashStr, 1);
            _this.usefulPeers.set(`${peer["host"]}:${peer["port"]}`, peer);
            if (_this._options["ignoreFetched"]) {
                _this.removeDuplicatedWaitingObjects(infoHashStr);
            }
        }).catch(error => {
            _this.emit('metadataError', {
                infoHash,
                error
            });
        }).finally(() => {
            _this.dispatchMetadata();
            if (_this.metadataFetchingDict[infoHashStr] && _this.metadataFetchingDict[infoHashStr] > 1) {
                this.metadataFetchingDict[infoHashStr] -= 1;
            }
            else {
                Reflect.deleteProperty(_this.metadataFetchingDict, infoHashStr);
            }
            this.metadataFetchingCache.delete(infoHashStr);
        });
        this.dispatchMetadata();
    }
    boostMetadataFetching() {
        let counter;
        while (true) {
            if (this.metadataWaitingQueues.length === 0)
                break;
            let fetchingLength = Object.keys(this.metadataFetchingDict).length;
            if (fetchingLength >= this._options.maximumParallelFetchingTorrent)
                break;
            let waitingKeysNumber = this.getUniqueWaitingKeys().length;
            if (waitingKeysNumber > fetchingLength) {
                if (counter === undefined)
                    counter = this.metadataWaitingQueues.length;
                this.dispatchMetadata();
                counter--;
                if (counter <= 0)
                    break;
            }
            else {
                break;
            }
        }
    }
    removeDuplicatedWaitingObjects(infoHashStr) {
        this.metadataWaitingQueues = this.metadataWaitingQueues.filter(waitingObject => infoHashStr !== waitingObject["infoHashStr"]);
    }
    getSizes() {
        let fetchings = Object.keys(this.metadataFetchingDict);
        return {
            fetchingNum: fetchings.length,
            metadataWaitingQueueSize: this.metadataWaitingQueues.length,
            uniqueWaitingKeys: this.getUniqueWaitingKeys().length,
            fetchedTupleSize: this.fetchedTuple.keyMap.size,
            fetchedInfoHashSize: this.fetchedInfoHash.keyMap.size,
            fetchedTupleHit: this.counter.fetchedTupleHit,
            fetchedInfoHashHit: this.counter.fetchedInfoHashHit,
            metadataFetchingCacheSize: this.metadataFetchingCache.keyMap.size,
            rpcPendingSize: this.rpc.pending.length,
            nodeListSize: this.nodes.length,
            runTime: ((Date.now() - this.startTime) / 1000).toFixed(2)
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
    getUniqueWaitingKeys() {
        let keysDict = this.metadataWaitingQueues.reduce((prev, curr) => {
            prev[curr["infoHashStr"]] = 1;
            return prev;
        }, {});
        let keys = Object.keys(keysDict);
        return keys;
    }
    importUsefulPeers() {
        let peers = utils.shuffle([...this.usefulPeers.values()]);
        for (let peer of peers) {
            if (Math.random() > Math.min(0.99, (this.rpc.pending.length / 50 + this.nodes.length / 500))) {
                this.importPeer(peer);
            }
        }
    }
    importPeer(peer) {
        if (!Reflect.has(this.nodesDict, utils.getPeerKey(peer))) {
            this.dht.addNode({ host: peer.host, port: peer.port });
        }
    }
    exportUsefulPeers() {
        return [...this.usefulPeers.values()];
    }
    exportWaitingQueue() {
        return [...this.metadataWaitingQueues];
    }
    importWaitingQueue(arr) {
        if (!arr || Object.prototype.toString.call(arr) !== '[object Array]') {
            console.error("Not an array");
            return;
        }
        for (let tuple of arr) {
            if (!tuple.peer || !tuple.peer.host || !tuple.peer.port) {
                continue;
            }
            if (!tuple.infoHashStr) {
                continue;
            }
            tuple.infoHash = Buffer.from(tuple.infoHashStr, 'hex');
            this.metadataWaitingQueues.push(tuple);
        }
    }
}
exports.DHTSniffer = DHTSniffer;
let parseMetaData = metadataHelper.parseMetaData;
exports.parseMetaData = parseMetaData;
