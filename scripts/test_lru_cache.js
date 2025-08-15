const { LRUCache } = require("lru-cache");

let c = new LRUCache({ max: 1000 });

console.log(c.size);