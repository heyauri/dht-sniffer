import * as crypto from 'crypto';
import { DHT } from './dht';
import * as metadataHelper from './metadata-helper';

import { EventEmitter } from 'events';
import * as utils from './utils';
import * as LRU from "lru-cache";

class DHTSniffer extends EventEmitter {
    private _options: any;
    dht: any;
    latestReceive: Date;
    refreshIntervalId: any;
    rpc: any;
    status: boolean;
    metadataWaitingQueues: Array<any>;
    metadataFetchingDict: any;
    metadataFetchingCache: any;
    fetchdTuple: any;
    findNodeCache: any;
    latestCalledPeers: any;
    fetchdInfoHash: any;
    nodes: any;
    counter: any;
    constructor(options) {
        super();
        this._options = Object.assign(
            {
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
            },
            options
        );
        this.status = false;
        this.metadataWaitingQueues = [];
        this.nodes = [];
        this.metadataFetchingDict = {};
        this.fetchdTuple = new LRU({ max: this._options.fetchdTupleSize, ttl: 3 * 60 * 60 * 1000 });
        this.fetchdInfoHash = new LRU({ max: this._options.fetchdInfoHashSize, ttl: 72 * 60 * 60 * 1000 });
        this.findNodeCache = new LRU({ max: this._options.findNodeCacheSize, ttl: 24 * 60 * 60 * 1000, updateAgeOnHas: true });
        this.latestCalledPeers = new LRU({ max: 1000, ttl: 5 * 60 * 1000 });
        this.metadataFetchingCache = new LRU({ max: 1000, ttl: 20 * 1000 });
        this.counter = {
            fetchedTupleHit: 0,
            fetchedInfoHashHit: 0
        }
    }

    start() {
        const _this = this;
        if (this.status) {
            console.log('The sniffer is already working');
            return;
        }
        this.dht = new DHT({
            concurrency: this._options.concurrency || 16
        });
        this.rpc = this.dht._rpc;
        this.latestReceive = new Date();
        this.dht.listen(this._options.port, () => {
            console.log(`DHT init: now listening:${_this._options.port}`);
        });
        this.dht.on('warning', err => _this.emit('warning', err));
        this.dht.on('error', err => _this.emit('error', err));

        /**
         *  emit data like {infoHash, peer: { host: '123.123.123.123', family: 'IPv4', port: 6882, size: 104 }}
         */
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

        /**
         * Found potential peer of InfoHash.
         */
        this.dht.on('peer', function (peer, infoHash, from) {
            // console.log('found potential peer ' + peer.host + ':' + peer.port + ' through ' + from.address + ':' + from.port, infoHash)
            peer["id"] = crypto.createHash('sha1').update(`${peer.host}:${peer.port}`).digest();
            _this.dht.addNode(peer);
            _this.addQueuingMetadata(infoHash, peer, true);
        });

        /**
         *  If no request is received within a configured time period, lookup some new nodes
         */
        this.refreshIntervalId = setInterval(() => {
            let nodes = this.dht._rpc.nodes.toArray();
            this.nodes = nodes;
            utils.shuffle(this.nodes)
            if (_this._options["aggressive"] || new Date().getTime() - _this.latestReceive.getTime() > _this._options.refreshTime) {
                nodes.map(node => {
                    let nodeKey = `${node["host"]}:${node["port"]}`;
                    if (!_this.latestCalledPeers.get(nodeKey) && _this.nodes.length < 400 && Math.random() > _this.rpc.pending.length / 12) {
                        // console.log('try find nodes', node);
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
                        _this.rpc.remove(peer.id)
                    }
                }
            } catch (e) {
                // do nothing
            }
            if (reply && reply.r && reply.r.nodes) {
                let nodes = utils.parseNodes(reply.r.nodes, 20);
                for (let node of nodes) {
                    if (utils.isNodeId(node.id, 20)) {
                        // console.log(node);
                        // _this.rpc.nodes.add(node);
                        _this.dht.addNode(node);
                    }
                }
            }
            // console.log("make neighboor query", err, reply);
        });
    }
    /**
     * @param infoHash
     * @param targetNode the origin node that is looking for the target infoHash, generally offered by the intergrated dht module. If it is ignored, the sniffer will try to look up some peer.
     * @param mode the mode of the fetching, true is stronger, false is weaker.
     */
    fetchMetaData(infoHash: Buffer, peer: any, mode: boolean = false) {
        const _this = this;
        if (mode === false) {
            if (!peer || (peer.host === undefined || peer.port === undefined)) return false;
        }
        if (peer) {
            this.addQueuingMetadata(infoHash, peer);
        }
        if (mode) {
            // console.log("try lookup", infoHash.toString("hex"));
            this.dht.lookup(infoHash, function (err, totalNodes) {
                if (err) {
                    _this.emit("error", err);
                }
                else {
                    // console.log("total nodes", totalNodes)
                }
            });
        }
    }
    /**
     * @param infoHash
     * @param peer
     * @param reverse default is false -> the infoHash is from `find_node` message, while true, it is from `lookup` function.
     */
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
        if (!nextFetching) return;
        let {
            infoHash,
            infoHashStr,
            peer
        } = nextFetching;
        let nextFetchingKey = this.getNextFetchingKey(nextFetching);
        /**
         *  Fetch one unique infoHash at a same time
         */
        if (Reflect.has(this.metadataFetchingDict, infoHashStr)) {
            // console.log("fetching ignore")
            this.metadataWaitingQueues.unshift(nextFetching);
            if (!this.metadataFetchingCache.get(infoHashStr)) {
                // console.log("insert fetching cache")
                this.metadataFetchingCache.set(infoHashStr, 1);
                this.dispatchMetadata();
            }
            return;
        }
        if (this._options["ignoreFetched"] && this.fetchdTuple.get(nextFetchingKey)) {
            // console.log("fetchdTuple ignore")
            this.counter.fetchedTupleHit++;
            this.dispatchMetadata();
            return;
        }
        if (this._options["ignoreFetched"] && this.fetchdInfoHash.get(infoHashStr)) {
            // console.log("fetchdInfoHash ignore")
            this.counter.fetchedInfoHashHit++;
            this.dispatchMetadata();
            return;
        }
        this.metadataFetchingDict[infoHashStr] = 1;
        this.fetchdTuple.set(nextFetchingKey, 1);
        metadataHelper
            .fetch({
                infoHash,
                peer
            },
                this._options
            )
            .then(metadata => {
                if (metadata === undefined) return;
                _this.emit('metadata',
                    infoHash,
                    metadata
                );
                _this.fetchdInfoHash.set(infoHashStr, 1);
                if (_this._options["ignoreFetched"]) {
                    _this.removeDuplicatedWaitingObjects(infoHashStr)
                }
            }).catch(error => {
                _this.emit('metadataError', {
                    infoHash,
                    error
                });
            }).finally(() => {
                _this.dispatchMetadata();
                Reflect.deleteProperty(_this.metadataFetchingDict, infoHashStr);
            });
        // boost efficiency
        this.dispatchMetadata();
    }
    boostMetadataFetching() {
        let counter;
        while (true) {
            if (this.metadataWaitingQueues.length === 0) break;
            let fetchingLength = Object.keys(this.metadataFetchingDict).length;
            if (fetchingLength >= this._options.maximumParallelFetchingTorrent) break;
            let waitingKeysNumber = this.getUniqueWaitingKeys().length;
            if (waitingKeysNumber > fetchingLength) {
                if (counter === undefined) counter = waitingKeysNumber;
                this.dispatchMetadata();
                counter--;
                if (counter <= 0) break;
            } else {
                break;
            }
        }
    }
    removeDuplicatedWaitingObjects(infoHashStr) {
        this.metadataWaitingQueues = this.metadataWaitingQueues.filter(waitingObject => infoHashStr !== waitingObject["infoHashStr"]);
    }
    parseMetaData = metadataHelper.parseMetaData
    getSizes() {
        let fetchings = Object.keys(this.metadataFetchingDict);
        return {
            fetchingNum: fetchings.length,
            metadataWaitingQueueSize: this.metadataWaitingQueues.length,
            uniqueWaitingKeys: this.getUniqueWaitingKeys().length,
            fetchdTupleSize: this.fetchdTuple.keyMap.size,
            fetchdInfoHashSize: this.fetchdInfoHash.keyMap.size,
            fetchdTupleHit: this.counter.fetchdTupleHit,
            fetchedInfoHashHit: this.counter.fetchedInfoHashHit,
            metadataFetchingCacheSize: this.metadataFetchingCache.keyMap.size,
            rpcPendingSize: this.rpc.pending.length,
            nodeListSize: this.nodes.length
        }
        // console.log(fetchings.length, this.metadataWaitingQueues.length, this.fetchdTuple.keyMap.size,
        // this.fetchdInfoHash.keyMap.size, this.rpc.pending.length);
    }
    reduceRPCPendingArray() {
        let pending = this.rpc.pending.slice(0, 1000);
        this.rpc.pending = pending;
    }
    getNextFetchingKey(nextFetching) {
        let {
            infoHash,
            peer
        } = nextFetching;
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
}

export { DHTSniffer };
