var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "events", "./core/container", "./config/validator", "./core/event-bus"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DHTSniffer = void 0;
    const events_1 = require("events");
    const container_1 = require("./core/container");
    const validator_1 = require("./config/validator");
    const event_bus_1 = require("./core/event-bus");
    class DHTSniffer extends events_1.EventEmitter {
        constructor(config = {}) {
            super();
            this.config = Object.assign({
                port: 6881,
                nodesMaxSize: 10000,
                refreshPeriod: 30000,
                announcePeriod: 30000,
                maximumParallelFetchingTorrent: 40,
                maximumWaitingQueueSize: -1,
                downloadMaxTime: 20000,
                ignoreFetched: true,
                aggressiveLevel: 0,
                enablePerformanceMonitoring: true,
                performanceMonitoringInterval: 30000,
                enableHealthCheck: true,
                healthCheckInterval: 60000,
                gracefulShutdownTimeout: 10000,
                maxMemoryUsage: 512 * 1024 * 1024,
                enableAutoRestart: false,
                restartDelay: 5000
            }, config);
            this.isRunning = false;
            this.startTime = Date.now();
            this.restartCount = 0;
            this.lastRestartTime = 0;
            this.isShuttingDown = false;
            const groupedConfig = this.transformConfigForValidation(this.config);
            this.initializeArchitectureComponents();
            this.initializeBusinessComponentsWithConfig(groupedConfig);
            this.setupEventListeners();
        }
        initializeArchitectureComponents() {
            this.configValidator = new validator_1.ConfigValidatorManager();
            const groupedConfig = this.transformConfigForValidation(this.config);
            const validationResult = this.configValidator.validateAll(groupedConfig);
            const hasErrors = Object.values(validationResult).some(result => !result.isValid);
            if (hasErrors) {
                const errorMessages = Object.entries(validationResult)
                    .filter(([, result]) => !result.isValid)
                    .map(([type, result]) => `${type}: ${result.errors.join(', ')}`)
                    .join('; ');
                throw new Error(`Configuration validation failed: ${errorMessages}`);
            }
            this.eventBus = (0, event_bus_1.createDefaultEventBus)();
            this.container = (0, container_1.createDefaultContainer)(this.config);
        }
        initializeBusinessComponentsWithConfig(groupedConfig) {
            this.container = (0, container_1.createDefaultContainer)(groupedConfig);
            this.errorHandler = this.container.get('errorHandler');
            this.errorMonitor = this.container.get('errorMonitor');
            this.cacheManager = this.container.get('cacheManager');
            this.peerManager = this.container.get('peerManager');
            this.metadataManager = this.container.get('metadataManager');
            this.dhtManager = this.container.get('dhtManager');
        }
        setupEventListeners() {
            this.setupEventBusListeners();
            this.setupManagerEventForwarding();
        }
        setupEventBusListeners() {
            this.eventBus.subscribe(event_bus_1.EventTypes.DHT.peerFound, (peerInfo) => {
                const { peer, infoHash } = peerInfo;
                this.eventBus.publish(event_bus_1.EventTypes.METADATA.queueRequest, { infoHash, peer });
                this.emit('peer', peerInfo);
            });
            this.eventBus.subscribe(event_bus_1.EventTypes.DHT.nodeFound, (node) => {
                this.emit('node', node);
            });
            this.eventBus.subscribe(event_bus_1.EventTypes.DHT.error, (error) => {
                this.emit('error', error);
            });
            this.eventBus.subscribe(event_bus_1.EventTypes.DHT.warning, (warning) => {
                this.emit('warning', warning);
            });
            this.eventBus.subscribe(event_bus_1.EventTypes.DHT.infoHashFound, (peerInfo) => {
                this.emit('infoHash', peerInfo);
            });
            this.eventBus.subscribe(event_bus_1.EventTypes.METADATA.fetched, (metadataInfo) => {
                this.emit('metadata', metadataInfo);
            });
            this.eventBus.subscribe(event_bus_1.EventTypes.METADATA.error, (errorInfo) => {
                this.emit('metadataError', errorInfo);
            });
            this.eventBus.subscribe(event_bus_1.EventTypes.SYSTEM.memoryWarning, (warning) => {
                this.emit('memoryWarning', warning);
            });
            this.eventBus.subscribe(event_bus_1.EventTypes.SYSTEM.performanceStats, (stats) => {
                this.emit('performanceStats', stats);
            });
            this.eventBus.subscribe(event_bus_1.EventTypes.SYSTEM.healthCheck, (health) => {
                this.emit('healthCheck', health);
            });
        }
        setupManagerEventForwarding() {
            this.dhtManager.on('peer', (peerInfo) => {
                this.eventBus.publish(event_bus_1.EventTypes.DHT.peerFound, peerInfo);
            });
            this.dhtManager.on('node', (node) => {
                this.eventBus.publish(event_bus_1.EventTypes.DHT.nodeFound, node);
            });
            this.dhtManager.on('error', (error) => {
                this.eventBus.publish(event_bus_1.EventTypes.DHT.error, error);
            });
            this.dhtManager.on('warning', (warning) => {
                this.eventBus.publish(event_bus_1.EventTypes.DHT.warning, { message: warning });
            });
            this.dhtManager.on('infoHash', (peerInfo) => {
                this.eventBus.publish(event_bus_1.EventTypes.DHT.infoHashFound, peerInfo);
            });
            this.metadataManager.on('metadata', (metadataInfo) => {
                this.eventBus.publish(event_bus_1.EventTypes.METADATA.fetched, metadataInfo);
            });
            this.metadataManager.on('metadataError', (errorInfo) => {
                this.eventBus.publish(event_bus_1.EventTypes.METADATA.error, errorInfo);
            });
        }
        start() {
            return __awaiter(this, void 0, void 0, function* () {
                if (this.isRunning) {
                    return;
                }
                try {
                    yield this.dhtManager.start();
                    const dhtInstance = this.dhtManager.getDHT();
                    this.peerManager.setDHT(dhtInstance);
                    this.container.register('dhtInstance', dhtInstance);
                    this.isRunning = true;
                    this.startTime = Date.now();
                    if (this.config.enablePerformanceMonitoring) {
                        this.startPerformanceMonitoring();
                    }
                    if (this.config.enableHealthCheck) {
                        this.startHealthCheck();
                    }
                    this.eventBus.publish(event_bus_1.EventTypes.SYSTEM.started, {
                        startTime: this.startTime,
                        config: this.config
                    });
                    this.emit('started');
                }
                catch (error) {
                    this.isRunning = false;
                    this.errorHandler.handleError(error, { operation: 'DHTSniffer.start' });
                    throw error;
                }
            });
        }
        stop() {
            return __awaiter(this, void 0, void 0, function* () {
                if (!this.isRunning || this.isShuttingDown) {
                    return;
                }
                this.isShuttingDown = true;
                try {
                    this.stopPerformanceMonitoring();
                    this.stopHealthCheck();
                    yield this.dhtManager.stop();
                    this.metadataManager.clear();
                    yield this.cacheManager.destroy();
                    this.peerManager.clear();
                    yield this.cleanupArchitectureComponents();
                    this.isRunning = false;
                    this.isShuttingDown = false;
                    this.emit('stopped');
                }
                catch (error) {
                    this.isShuttingDown = false;
                    this.errorHandler.handleError(error, { operation: 'DHTSniffer.stop' });
                    throw error;
                }
            });
        }
        cleanupArchitectureComponents() {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    this.eventBus.clearAllSubscriptions();
                    this.container.clear();
                }
                catch (error) {
                    this.errorHandler.handleError(error, { operation: 'DHTSniffer.cleanupArchitectureComponents' });
                }
            });
        }
        findNode(target) {
            this.dhtManager.findNode(target);
        }
        getPeers(infoHash) {
            this.dhtManager.getPeers(infoHash);
        }
        fetchMetaData(peerInfo) {
            const { infoHash, peer } = peerInfo;
            this.metadataManager.addQueuingMetadata(infoHash, peer);
        }
        parseMetaData(rawMetadata) {
            return this.metadataManager.parseMetaData(rawMetadata);
        }
        exportNodes() {
            return this.dhtManager.exportNodes();
        }
        importNodes(nodes) {
            this.dhtManager.importNodes(nodes);
        }
        exportPeers() {
            return this.dhtManager.exportPeers();
        }
        importPeers(peers) {
            this.dhtManager.importPeers(peers);
        }
        exportWaitingQueue() {
            return this.metadataManager.exportWaitingQueue();
        }
        importWaitingQueue(arr) {
            this.metadataManager.importWaitingQueue(arr);
        }
        getStats() {
            const dhtStats = this.dhtManager.getStats();
            const metadataStats = this.metadataManager.getStats();
            const errorStats = this.errorMonitor.getStats();
            const cacheStats = this.cacheManager.getStats();
            const peerStats = this.peerManager.getStats();
            const memoryUsage = process.memoryUsage();
            const uptime = Date.now() - this.startTime;
            return Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, dhtStats), metadataStats), cacheStats), peerStats), { errors: errorStats, system: {
                    uptime,
                    restartCount: this.restartCount,
                    lastRestartTime: this.lastRestartTime,
                    memory: {
                        rss: memoryUsage.rss,
                        heapTotal: memoryUsage.heapTotal,
                        heapUsed: memoryUsage.heapUsed,
                        external: memoryUsage.external,
                        maxMemoryUsage: this.config.maxMemoryUsage
                    },
                    cpu: process.cpuUsage()
                } });
        }
        isRunningStatus() {
            return this.isRunning;
        }
        getErrorHandler() {
            return this.errorHandler;
        }
        getErrorMonitor() {
            return this.errorMonitor;
        }
        getCacheManager() {
            return this.cacheManager;
        }
        getPeerManager() {
            return this.peerManager;
        }
        getMetadataManager() {
            return this.metadataManager;
        }
        getDHTManager() {
            return this.dhtManager;
        }
        getContainer() {
            return this.container;
        }
        getConfigValidator() {
            return this.configValidator;
        }
        transformConfigForValidation(config) {
            const groupedConfig = {
                dht: {},
                metadata: {},
                cache: {},
                peer: {},
                error: {}
            };
            if (config.port !== undefined)
                groupedConfig.dht.port = config.port;
            if (config.nodesMaxSize !== undefined)
                groupedConfig.dht.nodesMaxSize = config.nodesMaxSize;
            if (config.refreshPeriod !== undefined)
                groupedConfig.dht.refreshPeriod = config.refreshPeriod;
            if (config.announcePeriod !== undefined)
                groupedConfig.dht.announcePeriod = config.announcePeriod;
            if (config.bootstrapNodes !== undefined)
                groupedConfig.dht.bootstrap = config.bootstrapNodes;
            if (config.maximumParallelFetchingTorrent !== undefined)
                groupedConfig.metadata.maximumParallelFetchingTorrent = config.maximumParallelFetchingTorrent;
            if (config.maximumWaitingQueueSize !== undefined)
                groupedConfig.metadata.maximumWaitingQueueSize = config.maximumWaitingQueueSize;
            if (config.downloadMaxTime !== undefined)
                groupedConfig.metadata.downloadMaxTime = config.downloadMaxTime;
            if (config.ignoreFetched !== undefined)
                groupedConfig.metadata.ignoreFetched = config.ignoreFetched;
            if (config.aggressiveLevel !== undefined)
                groupedConfig.metadata.aggressiveLevel = config.aggressiveLevel;
            if (config.maxSize !== undefined)
                groupedConfig.cache.maxSize = config.maxSize;
            if (config.ttl !== undefined)
                groupedConfig.cache.ttl = config.ttl;
            groupedConfig.cache.fetchedTupleSize = config.fetchedTupleSize || 1000;
            groupedConfig.cache.fetchedInfoHashSize = config.fetchedInfoHashSize || 5000;
            groupedConfig.cache.findNodeCacheSize = config.findNodeCacheSize || 2000;
            groupedConfig.cache.latestCalledPeersSize = config.latestCalledPeersSize || 1000;
            groupedConfig.cache.usefulPeersSize = config.usefulPeersSize || 5000;
            groupedConfig.cache.metadataFetchingCacheSize = config.metadataFetchingCacheSize || 1000;
            if (config.maxNodes !== undefined)
                groupedConfig.peer.maxNodes = config.maxNodes;
            if (config.enableErrorHandling !== undefined)
                groupedConfig.error.enableErrorHandling = config.enableErrorHandling;
            if (config.maxErrorHistory !== undefined)
                groupedConfig.error.maxErrorHistory = config.maxErrorHistory;
            if (config.enablePerformanceMonitoring !== undefined) {
                groupedConfig.dht.enablePerformanceMonitoring = config.enablePerformanceMonitoring;
                groupedConfig.metadata.enablePerformanceMonitoring = config.enablePerformanceMonitoring;
            }
            if (config.performanceMonitoringInterval !== undefined) {
                groupedConfig.dht.performanceMonitoringInterval = config.performanceMonitoringInterval;
                groupedConfig.metadata.performanceMonitoringInterval = config.performanceMonitoringInterval;
            }
            if (config.enableHealthCheck !== undefined) {
                groupedConfig.dht.enableHealthCheck = config.enableHealthCheck;
                groupedConfig.metadata.enableHealthCheck = config.enableHealthCheck;
            }
            if (config.healthCheckInterval !== undefined) {
                groupedConfig.dht.healthCheckInterval = config.healthCheckInterval;
                groupedConfig.metadata.healthCheckInterval = config.healthCheckInterval;
            }
            if (config.gracefulShutdownTimeout !== undefined) {
                groupedConfig.dht.gracefulShutdownTimeout = config.gracefulShutdownTimeout;
                groupedConfig.metadata.gracefulShutdownTimeout = config.gracefulShutdownTimeout;
            }
            if (config.maxMemoryUsage !== undefined) {
                groupedConfig.dht.memoryThreshold = config.maxMemoryUsage;
                groupedConfig.metadata.memoryThreshold = config.maxMemoryUsage;
                groupedConfig.cache.memoryThreshold = config.maxMemoryUsage;
                groupedConfig.peer.memoryThreshold = config.maxMemoryUsage;
            }
            if (config.enableAutoRestart !== undefined) {
                groupedConfig.dht.enableAutoRestart = config.enableAutoRestart;
                groupedConfig.metadata.enableAutoRestart = config.enableAutoRestart;
            }
            if (config.restartDelay !== undefined) {
                groupedConfig.dht.restartDelay = config.restartDelay;
                groupedConfig.metadata.restartDelay = config.restartDelay;
            }
            return groupedConfig;
        }
        getEventBus() {
            return this.eventBus;
        }
        startPerformanceMonitoring() {
            if (this.performanceMonitoringInterval) {
                return;
            }
            this.performanceMonitoringInterval = setInterval(() => {
                const stats = this.getStats();
                const memoryUsage = stats.system.memory;
                if (memoryUsage.heapUsed > this.config.maxMemoryUsage) {
                    const memoryWarning = {
                        current: memoryUsage.heapUsed,
                        max: this.config.maxMemoryUsage,
                        message: 'Memory usage exceeds threshold'
                    };
                    this.eventBus.publish(event_bus_1.EventTypes.SYSTEM.memoryWarning, memoryWarning);
                    this.performMemoryCleanup();
                }
                const performanceStats = {
                    memory: memoryUsage,
                    uptime: stats.system.uptime,
                    cpu: stats.system.cpu,
                    cache: {
                        hitRate: stats.cacheHitRate || 0,
                        size: stats.cacheSize || 0
                    }
                };
                this.eventBus.publish(event_bus_1.EventTypes.SYSTEM.performanceStats, performanceStats);
            }, this.config.performanceMonitoringInterval);
        }
        stopPerformanceMonitoring() {
            if (this.performanceMonitoringInterval) {
                clearInterval(this.performanceMonitoringInterval);
                this.performanceMonitoringInterval = undefined;
            }
        }
        startHealthCheck() {
            if (this.healthCheckInterval) {
                return;
            }
            this.healthCheckInterval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    const health = yield this.performHealthCheck();
                    this.eventBus.publish(event_bus_1.EventTypes.SYSTEM.healthCheck, health);
                    if (!health.healthy && this.config.enableAutoRestart && !this.isShuttingDown) {
                        yield this.performRestart();
                    }
                }
                catch (error) {
                    this.errorHandler.handleError(error, { operation: 'DHTSniffer.healthCheck' });
                }
            }), this.config.healthCheckInterval);
        }
        stopHealthCheck() {
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = undefined;
            }
        }
        performHealthCheck() {
            return __awaiter(this, void 0, void 0, function* () {
                const checks = {
                    dhtManager: this.dhtManager.getIsRunning(),
                    peerManager: this.peerManager.getStats().nodeCount > 0,
                    metadataManager: this.metadataManager.getStats().activeFetchingCount >= 0,
                    cacheManager: this.cacheManager.getStats().totalSize >= 0,
                    memory: process.memoryUsage().heapUsed < this.config.maxMemoryUsage
                };
                const issues = [];
                if (!checks.dhtManager)
                    issues.push('DHT Manager is not running');
                if (!checks.peerManager)
                    issues.push('Peer Manager has no nodes');
                if (!checks.metadataManager)
                    issues.push('Metadata Manager has issues');
                if (!checks.cacheManager)
                    issues.push('Cache Manager has issues');
                if (!checks.memory)
                    issues.push('Memory usage too high');
                return {
                    healthy: Object.values(checks).every(check => check),
                    checks,
                    issues
                };
            });
        }
        performMemoryCleanup() {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.cacheManager.cleanupMemory();
                    this.peerManager.cleanup();
                    this.dhtManager.performMemoryCleanup();
                    if (global.gc) {
                        global.gc();
                    }
                    this.eventBus.publish(event_bus_1.EventTypes.SYSTEM.memoryCleanupCompleted, {
                        timestamp: Date.now()
                    });
                    this.emit('memoryCleanupCompleted');
                }
                catch (error) {
                    this.errorHandler.handleError(error, { operation: 'DHTSniffer.performMemoryCleanup' });
                }
            });
        }
        performRestart() {
            return __awaiter(this, void 0, void 0, function* () {
                if (this.isShuttingDown) {
                    return;
                }
                const restartInfo = {
                    restartCount: this.restartCount,
                    timestamp: Date.now()
                };
                this.eventBus.publish(event_bus_1.EventTypes.SYSTEM.restarting, restartInfo);
                this.emit('restarting');
                try {
                    yield this.stop();
                    yield new Promise(resolve => setTimeout(resolve, this.config.restartDelay));
                    yield this.start();
                    this.restartCount++;
                    this.lastRestartTime = Date.now();
                    const completedRestartInfo = {
                        restartCount: this.restartCount,
                        restartTime: this.lastRestartTime
                    };
                    this.eventBus.publish(event_bus_1.EventTypes.SYSTEM.restarted, completedRestartInfo);
                    this.emit('restarted', completedRestartInfo);
                }
                catch (error) {
                    this.errorHandler.handleError(error, { operation: 'DHTSniffer.performRestart' });
                    this.eventBus.publish(event_bus_1.EventTypes.SYSTEM.restartFailed, {
                        error,
                        timestamp: Date.now()
                    });
                    this.emit('restartFailed', error);
                }
            });
        }
        gracefulShutdown() {
            return __awaiter(this, void 0, void 0, function* () {
                if (this.isShuttingDown) {
                    return;
                }
                const shutdownInfo = {
                    timestamp: Date.now(),
                    timeout: this.config.gracefulShutdownTimeout
                };
                this.eventBus.publish(event_bus_1.EventTypes.SYSTEM.shuttingDown, shutdownInfo);
                this.emit('shuttingDown');
                try {
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Graceful shutdown timeout')), this.config.gracefulShutdownTimeout);
                    });
                    yield Promise.race([
                        this.stop(),
                        timeoutPromise
                    ]);
                    const completedShutdownInfo = {
                        timestamp: Date.now(),
                        duration: Date.now() - shutdownInfo.timestamp
                    };
                    this.eventBus.publish(event_bus_1.EventTypes.SYSTEM.shutdownCompleted, completedShutdownInfo);
                    this.emit('shutdownCompleted');
                }
                catch (error) {
                    this.errorHandler.handleError(error, { operation: 'DHTSniffer.gracefulShutdown' });
                    this.eventBus.publish(event_bus_1.EventTypes.SYSTEM.shutdownFailed, {
                        error,
                        timestamp: Date.now()
                    });
                    this.emit('shutdownFailed', error);
                    throw error;
                }
            });
        }
    }
    exports.DHTSniffer = DHTSniffer;
});
