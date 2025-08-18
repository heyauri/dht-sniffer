const { DHTSniffer } = require('../lib/dht-sniffer');
const { globalErrorHandler, ErrorType, ErrorSeverity } = require('../lib/utils/error-handler');

console.log('=== 错误处理系统测试 ===');

// 创建DHTSniffer实例
const sniffer = new DHTSniffer({
    port: 6881,
    maximumParallelFetchingTorrent: 2,
    downloadMaxTime: 5000
});

// 设置事件监听器
sniffer.on('systemError', (error) => {
    console.log('[系统错误]', error.toString());
});

sniffer.on('systemWarning', (error) => {
    console.log('[系统警告]', error.toString());
});

sniffer.on('criticalError', (error) => {
    console.log('[严重错误]', error.toString());
});

sniffer.on('errorStats', (stats) => {
    console.log('[错误统计]', {
        totalErrors: stats.totalErrors,
        errorRate: stats.errorRate.toFixed(2),
        topErrorTypes: stats.topErrorTypes.slice(0, 3)
    });
});

sniffer.on('errorAlert', (alert) => {
    console.log('[错误警报]', alert);
});

sniffer.on('errorRecovery', (recovery) => {
    console.log('[错误恢复]', recovery);
});

// 模拟一些错误
console.log('\n1. 模拟网络错误...');
globalErrorHandler.handleError(new Error('ECONNREFUSED: Connection refused'), { 
    operation: 'connect', 
    target: '192.168.1.100:6881' 
});

console.log('\n2. 模拟超时错误...');
globalErrorHandler.handleError(new Error('ETIMEDOUT: Connection timeout'), { 
    operation: 'download', 
    timeout: 5000 
});

console.log('\n3. 模拟协议错误...');
globalErrorHandler.handleError(new Error('Invalid handshake'), { 
    operation: 'handshake', 
    peer: '192.168.1.101:6881' 
});

console.log('\n4. 模拟元数据错误...');
globalErrorHandler.handleError(new Error('Invalid metadata format'), { 
    operation: 'parseMetadata', 
    infoHash: 'abcdef1234567890' 
});

// 等待一段时间查看统计信息
setTimeout(() => {
    console.log('\n=== 当前错误统计 ===');
    const stats = sniffer.getErrorStats();
    if (stats) {
        console.log('总错误数:', stats.totalErrors);
        console.log('错误率:', stats.errorRate.toFixed(2), '错误/分钟');
        console.log('按类型统计:', stats.errorsByType);
        console.log('按严重级别统计:', stats.errorsBySeverity);
    }
    
    // 获取错误趋势
    console.log('\n=== 错误趋势 ===');
    const trends = sniffer.getErrorTrends(1); // 1小时趋势
    console.log('趋势数据点数:', trends.length);
    
    // 重置统计
    console.log('\n=== 重置错误统计 ===');
    sniffer.resetErrorStats();
    
    // 停止sniffer
    setTimeout(() => {
        sniffer.stop();
        console.log('\n测试完成！');
    }, 1000);
}, 3000);

// 启动sniffer
sniffer.start();