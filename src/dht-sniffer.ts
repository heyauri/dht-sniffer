import * as crypto from 'crypto';
import { DHT } from './dht/dht';
import * as metadataHelper from './metadata/metadata-helper';

import { EventEmitter } from 'events';
import * as utils from './utils';
import { LRUCache } from "lru-cache";
import { ErrorHandler, NetworkError, TimeoutError, DHTError, MetadataError, ErrorType, ErrorSeverity } from './utils/error-handler';
import { ErrorMonitor } from './utils/error-monitor';

class DHTSniffer extends EventEmitter {
    private _options: any;
    dht: any;
    startTime: any;
    latestReceive: Date;
    refreshIntervalId: any;
    rpc: any;
    status: boolean;
    metadataWaitingQueues: Array<any>;
    metadataFetchingDict: any;
    metadataFetchingCache: any;
    fetchedTuple: any;
    findNodeCache: any;
    latestCalledPeers: any;
    fetchedInfoHash: any;
    usefulPeers: any;
    nodes: any;
    nodesDict: Object;
    counter: any;
    aggressiveLimit: number;
    private errorHandler: ErrorHandler;
    private errorMonitor: ErrorMonitor;
    constructor(options) {
        super();
        this._options = Object.assign(
            {
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
            },
            options
        );
        this.status = false;
        this.metadataWaitingQueues = [];
        this.nodes = [];
        this.nodesDict = {};
        this.metadataFetchingDict = {};
        this.fetchedTuple = new LRUCache({ max: this._options.fetchedTupleSize, ttl: 3 * 60 * 60 * 1000 });
        this.fetchedInfoHash = new LRUCache({ max: this._options.fetchedInfoHashSize, ttl: 72 * 60 * 60 * 1000 });
        this.findNodeCache = new LRUCache({ max: this._options.findNodeCacheSize, ttl: 24 * 60 * 60 * 1000, updateAgeOnHas: true });
        this.latestCalledPeers = new LRUCache({ max: 1000, ttl: 5 * 60 * 1000 });
        this.usefulPeers = new LRUCache({ max: 5000 });
        this.metadataFetchingCache = new LRUCache({ max: 1000, ttl: 20 * 1000 });
        let aggressiveLevel = this._options["aggressiveLevel"]
        this.aggressiveLimit = aggressiveLevel && aggressiveLevel > 0 ? aggressiveLevel * this._options["maximumParallelFetchingTorrent"] : 0
        this.counter = {
            fetchedTupleHit: 0,
            fetchedInfoHashHit: 0
        }
        
        // 初始化错误处理器和监控器
        this.errorHandler = new ErrorHandler({
            enableErrorTracking: true,
            maxErrorHistory: 1000,
            enableConsoleLog: true,
            enableStructuredLogging: true
        });
        
        this.errorMonitor = new ErrorMonitor(this.errorHandler, {
            statsIntervalMs: 60000,
            maxRecentErrors: 100,
            enableAlerts: true,
            alertThresholds: {
                errorRate: 10,
                criticalErrors: 5,
                consecutiveErrors: 20
            }
        });
        
        // 设置错误监控器的事件监听
        this.errorMonitor.on('alert', (alert) => {
            this.emit('errorAlert', alert);
        });
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
        this.startTime = Date.now();
        this.dht.listen(this._options.port, () => {
            console.log(`DHT init: now listening:${_this._options.port}`);
            _this.emit("start", {
                startTime: this.startTime,
                ..._this._options
            })
        });
        this.dht.on('warning', err => {
            const warning = new DHTError(
                `DHT warning: ${err.message || err}`,
                { operation: 'dht_operation' },
                err instanceof Error ? err : new Error(String(err)),
                true
            );
            // 将警告转换为适当的错误实例并处理
            const warningError = new DHTError(`DHT warning: ${warning}`, {
                operation: 'dht_warning',
                component: 'dht',
                severity: ErrorSeverity.WARNING
            });
            this.errorHandler.handleError(warningError);
            _this.emit('warning', warning);
        });
        
        this.dht.on('error', err => {
            const error = new DHTError(
                `DHT error: ${err.message || err}`,
                { operation: 'dht_operation' },
                err instanceof Error ? err : new Error(String(err)),
                false
            );
            this.errorHandler.handleError(error);
            _this.emit('error', error);
        });

        /**
         *  emit data like {infoHash, peer: { host: '123.123.123.123', family: 'IPv4', port: 6882, size: 104 }}
         */
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
            // console.log(node)
        })

        /**
         * Found potential peer of InfoHash.
         */
        this.dht.on('peer', function (peer, infoHash, from) {
            // console.log('found potential peer ' + peer.host + ':' + peer.port + ' through ' + from.address + ':' + from.port, infoHash)
            _this.importPeer(peer);
            _this.addQueuingMetadata(infoHash, peer, true);
        });

        /**
         *  If no request is received within a configured time period, lookup some new nodes
         */
        this.refreshIntervalId = setInterval(() => {
            let nodes = this.dht._rpc.nodes.toArray();
            this.nodes = nodes;
            this.nodesDict = nodes.reduce((prev, curr) => {
                prev[utils.getPeerKey(curr)] = 1;
                return prev;
            }, {})
            utils.shuffle(this.nodes)
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
            
            // 停止错误监控器
            if (this.errorMonitor) {
                this.errorMonitor.stop();
            }
            
            // 清理错误处理器
            if (this.errorHandler) {
                this.errorHandler.clearHistory();
            }
            
            _this.status = false;
            _this.emit("stop")
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
                        _this.importPeer(node);
                    }
                }
            }
            // console.log("make neighbor query", err, reply);
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
                    const error = new DHTError(
                        `DHT lookup failed for ${infoHash.toString('hex')}: ${err.message || err}`,
                        { operation: 'dht_lookup', infoHash: infoHash.toString('hex') },
                        err instanceof Error ? err : new Error(String(err))
                    );
                    _this.errorHandler.handleError(error);
                    _this.emit("error", error);
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
            if (this.aggressiveLimit > 0 && this.aggressiveLimit > fetchings.length) {
                // AGGRESSIVE CHOICE: continue to fetch this tuple
            } else {
                this.metadataWaitingQueues.unshift(nextFetching);
                // To prevent endless dispatch of duplicate infoHashes that are still fetching
                if (!this.metadataFetchingCache.get(infoHashStr)) {
                    // console.log("insert fetching cache")
                    this.metadataFetchingCache.set(infoHashStr, 1);
                    this.dispatchMetadata();
                }
                return;
            }
        }
        if (this._options["ignoreFetched"] && this.fetchedTuple.get(nextFetchingKey)) {
            // console.log("fetchedTuple ignore")
            this.counter.fetchedTupleHit++;
            this.dispatchMetadata();
            return;
        }
        if (this._options["ignoreFetched"] && this.fetchedInfoHash.get(infoHashStr)) {
            // console.log("fetchedInfoHash ignore")
            this.counter.fetchedInfoHashHit++;
            this.dispatchMetadata();
            return;
        }
        if (!this.metadataFetchingDict[infoHashStr]) {
            this.metadataFetchingDict[infoHashStr] = 1;
        } else if (this.aggressiveLimit > 0) {
            this.metadataFetchingDict[infoHashStr] += 1;
        }
        this.fetchedTuple.set(nextFetchingKey, 1);
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
                _this.fetchedInfoHash.set(infoHashStr, 1);
                _this.usefulPeers.set(`${peer["host"]}:${peer["port"]}`, peer);
                if (_this._options["ignoreFetched"]) {
                    _this.removeDuplicatedWaitingObjects(infoHashStr)
                }
            }).catch(error => {
                // 使用错误处理器处理metadata获取错误
                if (error instanceof NetworkError || error instanceof TimeoutError || error instanceof MetadataError) {
                    _this.errorHandler.handleError(error);
                } else {
                    const metadataError = new MetadataError(
                        `Metadata fetch failed for ${infoHashStr}: ${error.message || error}`,
                        { 
                            operation: 'metadata_fetch', 
                            infoHash: infoHashStr, 
                            peer: { host: peer.host, port: peer.port } 
                        },
                        error instanceof Error ? error : new Error(String(error))
                    );
                    _this.errorHandler.handleError(metadataError);
                    error = metadataError;
                }
                _this.emit('metadataError', {
                    infoHash,
                    error
                });
            }).finally(() => {
                _this.dispatchMetadata();
                if (_this.metadataFetchingDict[infoHashStr] && _this.metadataFetchingDict[infoHashStr] > 1) {
                    this.metadataFetchingDict[infoHashStr] -= 1;
                } else {
                    Reflect.deleteProperty(_this.metadataFetchingDict, infoHashStr);
                }
                this.metadataFetchingCache.delete(infoHashStr);
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
                if (counter === undefined) counter = this.metadataWaitingQueues.length;
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
            fetchedTupleSize: this.fetchedTuple.size,
            fetchedInfoHashSize: this.fetchedInfoHash.size,
            fetchedTupleHit: this.counter.fetchedTupleHit,
            fetchedInfoHashHit: this.counter.fetchedInfoHashHit,
            metadataFetchingCacheSize: this.metadataFetchingCache.size,
            rpcPendingSize: this.rpc.pending.length,
            nodeListSize: this.nodes.length,
            runTime: ((Date.now() - this.startTime) / 1000).toFixed(2)
        }
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
let parseMetaData = metadataHelper.parseMetaData;
export { DHTSniffer, parseMetaData };
