const { getOptions } = require('loader-utils');
const { parse } = require('@vue/component-compiler-utils')
const path = require('path')

const praser = require('@babel/parser')
const t = require('@babel/types')
const traverse = require('@babel/traverse').default
const generator = require('@babel/generator').default;

module.exports = function(source){
  const loaderContext = this
  const {
    sourceMap,
    rootContext,
    resourcePath,
  } = loaderContext
  const options = getOptions(loaderContext) || {}
  const filename = path.basename(resourcePath)
  const context = rootContext || process.cwd()
  const sourceRoot = path.dirname(path.relative(context, resourcePath))

  const descriptor = parse({
    source,
    compiler: options.compiler || loadTemplateCompiler(loaderContext),
    filename,
    sourceRoot,
    needMap: sourceMap
  })

  const scriptContent = descriptor.script ? descriptor.script.content : ''

  const ast = praser.parse(scriptContent, {
    sourceType: 'unambiguous', 
    plugins: ['jsx']
  })

  traverse(ast, {
    ExportDefaultDeclaration(path) {
      path.traverse({
        ObjectExpression(opath){
          // 获取component path
          let compPath = opath.find((spath) => spath.node.key && spath.node.key.name === "components");
          let newPropA = t.objectProperty(t.stringLiteral('compS'), t.identifier('compS'))
          let newPropB = t.objectProperty(t.stringLiteral('compB'), t.identifier('compB'))
          // 若有components path 则insert组件注册
          // 若没有，则新增 components 属性
          if(compPath){
            compPath.traverse({
              Property(pPath){
                pPath.insertAfter([newPropA, newPropB])
                pPath.stop()
              }
            })
            compPath.stop()
          } else if(opath.parentPath.node && opath.parentPath.node.type === 'ExportDefaultDeclaration') {
            const props = opath.node.properties || []
            if(!props.some(sProp => sProp.key.name === 'components')){
              opath.traverse({
                Property(pPath){
                  let newNode = t.objectProperty(
                    t.stringLiteral('components'),
                    t.objectExpression([newPropA, newPropB])
                  )
                  pPath.insertBefore(newNode)
                  pPath.stop()
                }
              })
            }
          }
        }
      })
    }
  })

  let { code } = generator(ast)
  // code则为自动注册组件后的script
  // 后续只需将vue文件中的sctipt中的内容替换为code即可

  return source
}

function loadTemplateCompiler (loaderContext) {
  try {
    return require('vue-template-compiler')
  } catch (e) {
    if (/version mismatch/.test(e.toString())) {
      loaderContext.emitError(e)
    } else {
      loaderContext.emitError(new Error(
        `[vue-loader] vue-template-compiler must be installed as a peer dependency, ` +
        `or a compatible compiler implementation must be passed via options.`
      ))
    }
  }
}