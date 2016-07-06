import xs from 'xstream'
import {VNode} from 'virtual-dom'

/**
 * Converts a tree of VirtualNode|Observable<VirtualNode> into
 * Observable<VirtualNode>.
 */
export function transposeVTree(vtree) {
  if (typeof vtree.addListener === `function`) {
    return vtree.map(transposeVTree).flatten()
  } else if (vtree.type === `VirtualNode` && Array.isArray(vtree.children) &&
    vtree.children.length > 0)
  {
    return xs.combine(...vtree.children.filter(x => x).map(transposeVTree))
      .map((...arr) =>
        new VNode(
          vtree.tagName, vtree.properties, arr, vtree.key, vtree.namespace
        )
      )
  } else if (vtree.type === `VirtualNode`) {
    return xs.of(vtree)
  } else {
    throw new Error(`Unhandled case in transposeVTree()`)
  }
}
