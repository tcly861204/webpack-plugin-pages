const path = require('path')
const fs = require('fs')
const process = require('process')
const glob = require('glob')
const __dirPath = process.cwd()
const pagePath = path.resolve(__dirPath, 'src/pages')
const parentPathlength = pagePath.length + 1

const SimpleProgressWebpackPlugin = require('simple-progress-webpack-plugin')
const CompressionWebpackPlugin = require('compression-webpack-plugin')
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
const TerserPlugin = require('terser-webpack-plugin')
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin')

const pages = function (isProd) {
  const entryFiles = glob.sync(pagePath + '/*/main.js')
  const map = {}
  let _pages = []
  if (!isProd) {
    const local = path.resolve(__dirPath, 'config/local.json')
    if (fs.existsSync(local)) {
      const files = fs.readFileSync(local)
      _pages = [].concat(JSON.parse(files.toString()).modules)
    }
  }
  entryFiles.forEach((filePath) => {
    const dirName = path.dirname(filePath)
    const pageName = dirName.substr(parentPathlength)
    if (!isProd && !_pages.includes(pageName)) {
      return
    }
    const configPath = path.resolve(`${pagePath}/${pageName}/env.json`)
    let configPage = {
      title: '首页',
      keywords: null,
      description: null
    }
    if (fs.existsSync(configPath)) {
      configPage = Object.assign(
        {},
        configPage,
        JSON.parse(fs.readFileSync(configPath).toString())
      )
    }
    map[pageName] = Object.assign({}, configPage, {
      entry: `src/pages/${pageName}/main.js`,
      template: `public/${pageName === 'login' ? 'login' : 'index'}.html`,
      filename: isProd ? `${pageName}/index.html` : `${pageName}.html`,
      chunks: ['vendors', 'commons', pageName]
    })
  })
  return map
}
module.exports = function (isProd, _config) {
  const _pages = pages(isProd)
  return {
    publicPath: _config.prefix(isProd),
    outputDir: 'dist',
    assetsDir: 'static',
    pages: _pages,
    indexPath: 'index.html',
    productionSourceMap: !isProd,
    chainWebpack: (config) => {
      _config.alias(config)
      Object.keys(_pages).forEach(entryName => {
        config.plugin(`html-${entryName}`).tap((args) => {
          console.log(entryName)
          args[0].cdn = _config.static(_config.prefix(isProd))(entryName)
          return args
        })
      })
      _config.chainWebpack && typeof _config.chainWebpack === 'function' && _config.chainWebpack(config)
    },
    configureWebpack: (config) => {
      config.externals = _config.externals
      config.performance = {
        hints: 'warning',
        maxEntrypointSize: 50000000,
        maxAssetSize: 30000000,
        assetFilter: function (assetFilename) {
          return assetFilename.endsWith('.js')
        }
      }
      if (isProd) {
        const productionGzipExtensions = ['html', 'js', 'css']
        config.plugins.push(
          new CompressionWebpackPlugin({
            filename: '[path].gz[query]',
            algorithm: 'gzip',
            test: new RegExp('\\.(' + productionGzipExtensions.join('|') + ')$'),
            threshold: 10240,
            minRatio: 0.8,
            deleteOriginalAssets: false
          }),
          new BundleAnalyzerPlugin({
            openAnalyzer: false,
            analyzerMode: 'static'
          })
        )
      }
      config.optimization = {
        splitChunks: {
          chunks: 'all',
          minSize: 30000,
          maxInitialRequests: Infinity,
          minChunks: 1,
          maxAsyncRequests: 5,
          automaticNameDelimiter: '.',
          name: false,
          cacheGroups: {
            commons: {
              name: 'commons',
              priority: 1,
              chunks: 'initial',
              minSize: 0,
              minChunks: 1
            },
            vendors: {
              name: 'vendors',
              priority: 2,
              test: /[\\/]node_modules[\\/]/,
              chunks: 'initial',
              minSize: 0,
              minChunks: 1
            }
          }
        },
        minimizer: [
          new TerserPlugin({
            cache: true,
            parallel: true,
            sourceMap: false,
            terserOptions: {
              compress: {
                drop_console: true,
                drop_debugger: true
              }
            }
          }),
          new OptimizeCSSAssetsPlugin({
            cssProcessorOptions: {
              safe: true
            }
          })
        ]
      }
      config.plugins.push(
        new SimpleProgressWebpackPlugin({ format: 'minimal' })
      )
      _config.configureWebpack && typeof _config.configureWebpack === 'function' && _config.configureWebpack(config)
    },
    devServer: _config.devServer,
    parallel: require('os').cpus().length > 1
  }
}