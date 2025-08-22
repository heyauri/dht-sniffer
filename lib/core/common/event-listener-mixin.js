(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "../../types/error"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.EventListenerFactory = exports.withEventListeners = void 0;
    const error_1 = require("../../types/error");
    function withEventListeners(Base) {
        return class extends Base {
            constructor() {
                super(...arguments);
                this.eventListeners = new Map();
            }
            setupEventListeners() {
            }
            addEventListener(config) {
                const { event, handler, errorHandler, errorContext, once = false, priority = 0 } = config;
                if (!this.eventListeners.has(event)) {
                    this.eventListeners.set(event, []);
                }
                const listenerInfo = { handler, errorHandler, errorContext };
                const listeners = this.eventListeners.get(event);
                if (priority !== 0) {
                    let inserted = false;
                    for (let i = 0; i < listeners.length; i++) {
                        if (listeners[i].priority < priority) {
                            listeners.splice(i, 0, Object.assign(Object.assign({}, listenerInfo), { priority }));
                            inserted = true;
                            break;
                        }
                    }
                    if (!inserted) {
                        listeners.push(Object.assign(Object.assign({}, listenerInfo), { priority }));
                    }
                }
                else {
                    listeners.push(listenerInfo);
                }
                if (once) {
                    this.once(event, this.createSafeHandler(handler, errorHandler, errorContext));
                }
                else {
                    this.on(event, this.createSafeHandler(handler, errorHandler, errorContext));
                }
            }
            removeEventListener(event, handler) {
                const listeners = this.eventListeners.get(event);
                if (listeners) {
                    const index = listeners.findIndex(l => l.handler === handler);
                    if (index !== -1) {
                        listeners.splice(index, 1);
                        this.off(event, handler);
                    }
                }
            }
            removeAllEventListeners() {
                for (const [event, listeners] of this.eventListeners) {
                    for (const { handler } of listeners) {
                        this.off(event, handler);
                    }
                }
                this.eventListeners.clear();
            }
            safeEmit(event, ...args) {
                try {
                    return this.emit(event, ...args);
                }
                catch (error) {
                    console.error(`Error emitting event '${event}':`, error);
                    return false;
                }
            }
            createSafeHandler(handler, errorHandler, errorContext) {
                return (...args) => {
                    try {
                        handler(...args);
                    }
                    catch (error) {
                        if (errorHandler) {
                            errorHandler.handleError(error, Object.assign(Object.assign({ event, handler: handler.name || 'anonymous' }, errorContext), { errorType: error_1.ErrorType.SYSTEM }));
                        }
                        else {
                            console.error(`Error in event handler for '${event}':`, error);
                        }
                    }
                };
            }
            setupBatchEventListeners(configs) {
                configs.forEach(config => this.addEventListener(config));
            }
            getEventListenerCount(event) {
                var _a;
                if (event) {
                    return ((_a = this.eventListeners.get(event)) === null || _a === void 0 ? void 0 : _a.length) || 0;
                }
                return Array.from(this.eventListeners.values()).reduce((total, listeners) => total + listeners.length, 0);
            }
        };
    }
    exports.withEventListeners = withEventListeners;
    class EventListenerFactory {
        static createErrorListener(_errorHandler, managerName, errorContext) {
            return {
                event: 'error',
                handler: (error) => {
                    _errorHandler.handleError(error, Object.assign({ manager: managerName, operation: 'event_listener' }, errorContext));
                }
            };
        }
        static createWarningListener(_errorHandler, managerName) {
            return {
                event: 'warning',
                handler: (warning) => {
                    _errorHandler.handleError(new Error(warning), {
                        manager: managerName,
                        operation: 'event_listener',
                        severity: 'warning'
                    });
                }
            };
        }
        static createPerformanceWarningListener(_errorHandler, managerName) {
            return {
                event: 'performanceWarning',
                handler: (warning) => {
                    console.warn(`[${managerName}] Performance warning: ${warning.type} - ${warning.metric} = ${warning.value}`);
                }
            };
        }
        static createMemoryCleanupListener(_errorHandler, managerName) {
            return {
                event: 'memoryCleanup',
                handler: (cleanup) => {
                    console.log(`[${managerName}] Memory cleanup: ${cleanup.cleanupType} - freed ${cleanup.memoryFreed} bytes`);
                }
            };
        }
        static createRetryListener(_errorHandler, managerName) {
            return {
                event: 'retry',
                handler: (event) => {
                    console.log(`[${managerName}] Retry event: ${event.operation} - attempt ${event.attempt}/${event.maxAttempts}`);
                }
            };
        }
    }
    exports.EventListenerFactory = EventListenerFactory;
});
