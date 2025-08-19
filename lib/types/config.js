(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Logger = exports.LoggerImpl = exports.LogLevel = void 0;
    var LogLevel;
    (function (LogLevel) {
        LogLevel["ERROR"] = "ERROR";
        LogLevel["WARN"] = "WARN";
        LogLevel["INFO"] = "INFO";
        LogLevel["DEBUG"] = "DEBUG";
        LogLevel["TRACE"] = "TRACE";
    })(LogLevel || (exports.LogLevel = LogLevel = {}));
    class LoggerImpl {
        constructor() {
            this.level = LogLevel.INFO;
        }
        static getInstance() {
            if (!LoggerImpl.instance) {
                LoggerImpl.instance = new LoggerImpl();
            }
            return LoggerImpl.instance;
        }
        getInstance() {
            return LoggerImpl.getInstance();
        }
        setLevel(level) {
            this.level = level;
        }
        getLevel() {
            return this.level;
        }
        log(level, message, component, metadata) {
            if (this.shouldLog(level)) {
                const timestamp = new Date().toISOString();
                const componentStr = component ? `[${component}]` : '';
                const metadataStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
                console.log(`[${timestamp}] [${level}]${componentStr} ${message}${metadataStr}`);
            }
        }
        error(message, component, metadata) {
            this.log(LogLevel.ERROR, message, component, metadata);
        }
        warn(message, component, metadata) {
            this.log(LogLevel.WARN, message, component, metadata);
        }
        info(message, component, metadata) {
            this.log(LogLevel.INFO, message, component, metadata);
        }
        debug(message, component, metadata) {
            this.log(LogLevel.DEBUG, message, component, metadata);
        }
        trace(message, component, metadata) {
            this.log(LogLevel.TRACE, message, component, metadata);
        }
        shouldLog(level) {
            const levels = [LogLevel.TRACE, LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
            return levels.indexOf(level) >= levels.indexOf(this.level);
        }
    }
    exports.LoggerImpl = LoggerImpl;
    exports.Logger = LoggerImpl;
});
