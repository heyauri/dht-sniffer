(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "../types/error", "../utils", "./base-manager"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PeerManager = void 0;
    const error_1 = require("../types/error");
    const utils = require("../utils");
    const base_manager_1 = require("./base-manager");
    class PeerManager extends base_manager_1.BaseManager {
        constructor(config, dht, cacheManager, errorHandler) {
            super(config, errorHandler);
            this.config = Object.assign({ enableMemoryMonitoring: true, memoryThreshold: 100 * 1024 * 1024, cleanupInterval: 5 * 60 * 1000, maxNodeAge: 24 * 60 * 60 * 1000 }, config);
            this.dht = dht;
            this.rpc = dht === null || dht === void 0 ? void 0 : dht._rpc;
            this.cacheManager = cacheManager;
            this.nodes = [];
            this.nodesDict = {};
            this.nodeCreationTimes = new Map();
        }
        importPeer(peer) {
            try {
                if (!peer || !peer.host || !peer.port) {
                    throw new error_1.ValidationError('Invalid peer data', { peer });
                }
                const peerKey = utils.getPeerKey(peer);
                if (!this.nodesDict[peerKey]) {
                    this.dht.addNode({ host: peer.host, port: peer.port });
                }
            }
            catch (error) {
                this.handleError('importPeer', error, { peer, errorType: error instanceof error_1.ValidationError ? error_1.ErrorType.VALIDATION : error_1.ErrorType.NETWORK });
            }
        }
        importUsefulPeers() {
            try {
                if (!this.cacheManager || !this.cacheManager.getUsefulPeers) {
                    throw new error_1.ValidationError('Cache manager not available', { operation: 'importUsefulPeers' });
                }
                const usefulPeers = this.cacheManager.getUsefulPeers();
                const peers = utils.shuffle([...usefulPeers.values()]);
                for (const peer of peers) {
                    if (Math.random() > Math.min(0.99, (this.rpc.pending.length / 50 + this.nodes.length / 500))) {
                        this.importPeer(peer);
                    }
                }
            }
            catch (error) {
                this.handleError('importUsefulPeers', error, { errorType: error instanceof error_1.ValidationError ? error_1.ErrorType.VALIDATION : error_1.ErrorType.SYSTEM });
            }
        }
        exportUsefulPeers() {
            const usefulPeers = this.cacheManager.getUsefulPeers();
            return [...usefulPeers.values()];
        }
        updateNodes() {
            try {
                if (!this.dht || !this.dht._rpc || !this.dht._rpc.nodes) {
                    throw new error_1.ValidationError('DHT RPC not available', { operation: 'updateNodes' });
                }
                const nodes = this.dht._rpc.nodes.toArray();
                this.nodes = nodes;
                this.nodesDict = nodes.reduce((prev, curr) => {
                    prev[utils.getPeerKey(curr)] = 1;
                    return prev;
                }, {});
                utils.shuffle(this.nodes);
            }
            catch (error) {
                this.handleError('updateNodes', error, { errorType: error instanceof error_1.ValidationError ? error_1.ErrorType.VALIDATION : error_1.ErrorType.NETWORK });
            }
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
        cleanup() {
            try {
                const now = Date.now();
                const maxAge = this.config.maxNodeAge || 24 * 60 * 60 * 1000;
                this.nodes = this.nodes.filter(node => {
                    const nodeKey = utils.getPeerKey(node);
                    const creationTime = this.nodeCreationTimes.get(nodeKey);
                    if (creationTime && (now - creationTime) > maxAge) {
                        delete this.nodesDict[nodeKey];
                        this.nodeCreationTimes.delete(nodeKey);
                        return false;
                    }
                    return true;
                });
                for (const [nodeKey, creationTime] of this.nodeCreationTimes.entries()) {
                    if ((now - creationTime) > maxAge) {
                        this.nodeCreationTimes.delete(nodeKey);
                        delete this.nodesDict[nodeKey];
                    }
                }
                this.emit('cleanupCompleted', {
                    remainingNodes: this.nodes.length,
                    cleanedNodes: this.nodes.length - this.nodes.length
                });
            }
            catch (error) {
                this.emit('cleanupError', error);
            }
        }
        addNode(node) {
            try {
                if (!node || !node.host || !node.port) {
                    throw new error_1.ValidationError('Invalid node data', { node });
                }
                const nodeKey = utils.getPeerKey(node);
                if (!this.nodesDict[nodeKey]) {
                    if (this.nodes.length >= this.config.maxNodes) {
                        this.cleanupOldNodes();
                    }
                    if (this.nodes.length >= this.config.maxNodes) {
                        return;
                    }
                    this.nodes.push(node);
                    this.nodesDict[nodeKey] = this.nodes.length - 1;
                    this.nodeCreationTimes.set(nodeKey, Date.now());
                    this.emit('node', node);
                }
            }
            catch (error) {
                this.handleError('addNode', error, { node, errorType: error instanceof error_1.ValidationError ? error_1.ErrorType.VALIDATION : error_1.ErrorType.SYSTEM });
            }
        }
        addPeer(peerInfo) {
            try {
                if (!peerInfo || !peerInfo.peer || !peerInfo.infoHash) {
                    throw new error_1.ValidationError('Invalid peer info', { peerInfo });
                }
                const { peer, infoHash } = peerInfo;
                const peerKey = utils.getPeerKey(peer);
                this.cacheManager.addPeerToCache(peerKey, { peer, infoHash });
                this.emit('peer', { infoHash, peer });
            }
            catch (error) {
                this.handleError('addPeer', error instanceof Error ? error : new Error(String(error)), { peerInfo, errorType: error instanceof error_1.ValidationError ? error_1.ErrorType.VALIDATION : error_1.ErrorType.CACHE });
            }
        }
        exportNodes() {
            return [...this.nodes];
        }
        importNodes(nodes) {
            try {
                if (!Array.isArray(nodes)) {
                    throw new error_1.ValidationError('Nodes must be an array', { nodes });
                }
                for (const node of nodes) {
                    this.addNode(node);
                }
            }
            catch (error) {
                this.handleError('importNodes', error instanceof Error ? error : new Error(String(error)), { nodes, errorType: error instanceof error_1.ValidationError ? error_1.ErrorType.VALIDATION : error_1.ErrorType.SYSTEM });
            }
        }
        exportPeers() {
            return this.cacheManager.getAllPeers();
        }
        importPeers(peers) {
            try {
                if (!Array.isArray(peers)) {
                    throw new error_1.ValidationError('Peers must be an array', { peers });
                }
                for (const peer of peers) {
                    this.cacheManager.addPeerToCache(utils.getPeerKey(peer), peer);
                }
            }
            catch (error) {
                this.handleError('importPeers', error instanceof Error ? error : new Error(String(error)), { peers, errorType: error instanceof error_1.ValidationError ? error_1.ErrorType.VALIDATION : error_1.ErrorType.CACHE });
            }
        }
        getPeerStats() {
            return {
                nodeCount: this.nodes.length,
                peerCount: this.cacheManager.getPeerCount(),
                cacheStats: this.cacheManager.getStats()
            };
        }
        clearPeerData() {
            this.nodes = [];
            this.nodesDict = {};
            this.nodeCreationTimes.clear();
            this.emit('peerDataCleared');
        }
        cleanupOldNodes() {
            const now = Date.now();
            const maxAge = this.config.maxNodeAge || 24 * 60 * 60 * 1000;
            this.nodes = this.nodes.filter((node, index) => {
                const nodeKey = utils.getPeerKey(node);
                const creationTime = this.nodeCreationTimes.get(nodeKey);
                if (creationTime && (now - creationTime) > maxAge) {
                    delete this.nodesDict[nodeKey];
                    this.nodeCreationTimes.delete(nodeKey);
                    return false;
                }
                return true;
            });
            this.nodesDict = {};
            this.nodes.forEach((node, index) => {
                this.nodesDict[utils.getPeerKey(node)] = index;
            });
        }
        validateConfig(config) {
            const peerConfig = config;
            if (!peerConfig) {
                throw new error_1.ValidationError('PeerManager config is required', { config: peerConfig });
            }
            if (peerConfig.maxNodes !== undefined && (typeof peerConfig.maxNodes !== 'number' || peerConfig.maxNodes <= 0)) {
                throw new error_1.ValidationError('maxNodes must be a positive number', { maxNodes: peerConfig.maxNodes });
            }
            if (peerConfig.cleanupInterval !== undefined && (typeof peerConfig.cleanupInterval !== 'number' || peerConfig.cleanupInterval <= 0)) {
                throw new error_1.ValidationError('cleanupInterval must be a positive number', { cleanupInterval: peerConfig.cleanupInterval });
            }
            if (peerConfig.maxNodeAge !== undefined && (typeof peerConfig.maxNodeAge !== 'number' || peerConfig.maxNodeAge <= 0)) {
                throw new error_1.ValidationError('maxNodeAge must be a positive number', { maxNodeAge: peerConfig.maxNodeAge });
            }
        }
        deepCleanup() {
            try {
                const nodeAges = Array.from(this.nodeCreationTimes.entries())
                    .sort((a, b) => a[1] - b[1]);
                const nodesToRemove = Math.floor(nodeAges.length / 2);
                for (let i = 0; i < nodesToRemove; i++) {
                    const [nodeKey] = nodeAges[i];
                    const index = this.nodesDict[nodeKey];
                    if (index !== undefined) {
                        this.nodes.splice(index, 1);
                        delete this.nodesDict[nodeKey];
                        this.nodeCreationTimes.delete(nodeKey);
                    }
                }
                this.nodesDict = {};
                this.nodes.forEach((node, index) => {
                    this.nodesDict[utils.getPeerKey(node)] = index;
                });
                if (this.cacheManager && this.cacheManager.clearAll) {
                    this.cacheManager.clearAll();
                }
                if (global.gc) {
                    global.gc();
                }
            }
            catch (error) {
                this.handleError('deepCleanup', error instanceof Error ? error : new Error(String(error)), { errorType: error_1.ErrorType.SYSTEM });
            }
        }
        stopPeriodicCleanup() {
            try {
                if (this.cleanupInterval) {
                    clearInterval(this.cleanupInterval);
                    this.cleanupInterval = null;
                }
            }
            catch (error) {
                this.handleError('stopPeriodicCleanup', error instanceof Error ? error : new Error(String(error)), { errorType: error_1.ErrorType.SYSTEM });
            }
        }
        getManagerName() {
            return 'PeerManager';
        }
        performCleanup() {
            try {
                this.cleanupOldNodes();
                if (this.config.enableMemoryMonitoring) {
                }
            }
            catch (error) {
                this.handleError('performCleanup', error instanceof Error ? error : new Error(String(error)), { errorType: error_1.ErrorType.SYSTEM });
            }
        }
        clearData() {
            this.clearPeerData();
        }
        getStats() {
            return Object.assign(Object.assign({}, super.getStats()), this.getPeerStats());
        }
        handlePeerError(operation, error, context) {
            const peerError = new error_1.ValidationError(`Peer operation failed: ${operation}`, Object.assign(Object.assign({ operation }, context), { cause: error instanceof Error ? error : new Error(String(error)) }));
            super.handleError(operation, peerError, context);
        }
        performDeepCleanup() {
            try {
                this.clearPeerData();
                super.performDeepCleanup();
            }
            catch (error) {
                this.handlePeerError('performDeepCleanup', error);
            }
        }
    }
    exports.PeerManager = PeerManager;
});
