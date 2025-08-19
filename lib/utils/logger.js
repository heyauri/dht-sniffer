(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "../types/config"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Logger = exports.LogLevel = exports.logger = void 0;
    const config_1 = require("../types/config");
    Object.defineProperty(exports, "LogLevel", { enumerable: true, get: function () { return config_1.LogLevel; } });
    Object.defineProperty(exports, "Logger", { enumerable: true, get: function () { return config_1.Logger; } });
    exports.logger = config_1.Logger.getInstance();
});
