const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'production',
  entry: './src/dht-sniffer.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'dht-sniffer.js',
    library: {
      name: 'DhtSniffer',
      type: 'umd',
      export: 'default',
    },
    globalObject: 'this',
  },
  resolve: {
    extensions: ['.ts', '.js'],
    fallback: {
      'crypto': false,
      'net': false,
      'stream': false,
      'buffer': false,
      'util': false,
      'dns': false,
      'os': false,
      'dgram': false,
      'uint8-util': false,
      'tty': false,
      'process': false
    },
    mainFields: ['module', 'main'],
    exportsFields: [],
    conditionNames: ['require', 'node', 'default']
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser'
    })
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      }
    ],
  },
  // 所有依赖包都打包进bundle文件中，使用alias处理ES模块导入
};