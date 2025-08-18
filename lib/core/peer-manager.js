(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "events", "../utils"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PeerManager = void 0;
    const events_1 = require("events");
    const utils = require("../utils");
    class PeerManager extends events_1.EventEmitter {
        constructor(config, dht, cacheManager) {
            super();
            this.config = config;
            this.dht = dht;
            this.rpc = dht === null || dht === void 0 ? void 0 : dht._rpc;
            this.cacheManager = cacheManager;
            this.nodes = [];
            this.nodesDict = {};
        }
        importPeer(peer) {
            const peerKey = utils.getPeerKey(peer);
            if (!this.nodesDict[peerKey]) {
                this.dht.addNode({ host: peer.host, port: peer.port });
            }
        }
        importUsefulPeers() {
            const usefulPeers = this.cacheManager.getUsefulPeers();
            const peers = utils.shuffle([...usefulPeers.values()]);
            for (const peer of peers) {
                if (Math.random() > Math.min(0.99, (this.rpc.pending.length / 50 + this.nodes.length / 500))) {
                    this.importPeer(peer);
                }
            }
        }
        exportUsefulPeers() {
            const usefulPeers = this.cacheManager.getUsefulPeers();
            return [...usefulPeers.values()];
        }
        updateNodes() {
            const nodes = this.dht._rpc.nodes.toArray();
            this.nodes = nodes;
            this.nodesDict = nodes.reduce((prev, curr) => {
                prev[utils.getPeerKey(curr)] = 1;
                return prev;
            }, {});
            utils.shuffle(this.nodes);
        }
        getNodeCount() {
            return this.nodes.length;
        }
        getNodesDict() {
            return Object.assign({}, this.nodesDict);
        }
        getNodes() {
            return [...this.nodes];
        }
        shouldExpandNodes(lastReceiveTime) {
            const timeDiff = Date.now() - lastReceiveTime.getTime();
            return this.nodes.length < 5 || timeDiff > this.config.nodeRefreshTime;
        }
        shouldCallFindNode(node) {
            const nodeKey = `${node.host}:${node.port}`;
            const findNodeCache = this.cacheManager.getFindNodeCache();
            const latestCalledPeers = this.cacheManager.getLatestCalledPeers();
            return !findNodeCache.get(nodeKey) &&
                !latestCalledPeers.get(nodeKey) &&
                Math.random() > this.config.findNodeProbability + this.rpc.pending.length / 10 &&
                this.nodes.length < this.config.maxNodes;
        }
        markNodeAsCalled(node) {
            const nodeKey = `${node.host}:${node.port}`;
            const findNodeCache = this.cacheManager.getFindNodeCache();
            const latestCalledPeers = this.cacheManager.getLatestCalledPeers();
            findNodeCache.set(nodeKey, 1);
            latestCalledPeers.set(nodeKey, 1);
        }
        isNodeCountCritical() {
            return this.nodes.length <= 3;
        }
        setDHT(dht) {
            this.dht = dht;
            this.rpc = dht === null || dht === void 0 ? void 0 : dht._rpc;
        }
        addNode(node) {
            const nodeKey = utils.getPeerKey(node);
            if (!this.nodesDict[nodeKey]) {
                this.nodes.push(node);
                this.nodesDict[nodeKey] = this.nodes.length - 1;
                this.emit('node', node);
            }
        }
        addPeer(peerInfo) {
            const { peer, infoHash } = peerInfo;
            const peerKey = utils.getPeerKey(peer);
            this.cacheManager.addPeerToCache(peerKey, { peer, infoHash });
            this.emit('peer', { infoHash, peer });
        }
        exportNodes() {
            return [...this.nodes];
        }
        importNodes(nodes) {
            for (const node of nodes) {
                this.addNode(node);
            }
        }
        exportPeers() {
            return this.cacheManager.getAllPeers();
        }
        importPeers(peers) {
            for (const peer of peers) {
                this.cacheManager.addPeerToCache(utils.getPeerKey(peer), peer);
            }
        }
        getStats() {
            return {
                nodeCount: this.nodes.length,
                peerCount: this.cacheManager.getPeerCount(),
                cacheStats: this.cacheManager.getStats()
            };
        }
        clear() {
            this.nodes = [];
            this.nodesDict = {};
        }
    }
    exports.PeerManager = PeerManager;
});
