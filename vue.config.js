const { resolve } = require('path')

module.exports = {
  chainWebpack: config => {
    config.module
      .rule('vue-auto-import')
      .test(/.vue$/)
      .use('vue-auto-import')
      .loader(resolve('./vue2-import-loader'))
      .end()
  }
}