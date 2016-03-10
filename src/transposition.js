import Rx from 'rx-dom'
import {VNode} from 'virtual-dom'

/**
 * Converts a tree of VirtualNode|Observable<VirtualNode> into
 * Observable<VirtualNode>.
 */
export function transposeVTree(vtree) {
  if (typeof vtree.subscribe === `function`) {
    return vtree.flatMap(transposeVTree)
  } else if (vtree.type === `VirtualNode` && Array.isArray(vtree.children) &&
    vtree.children.length > 0)
  {
    return Rx.Observable
      .combineLatest(vtree.children.filter(x => x).map(transposeVTree), (...arr) =>
        new VNode(
          vtree.tagName, vtree.properties, arr, vtree.key, vtree.namespace
        )
      )
  } else if (vtree.type === `VirtualNode`)
  {
    return Rx.Observable.just(vtree)
  } else {
    throw new Error(`Unhandled case in transposeVTree()`)
  }
}
