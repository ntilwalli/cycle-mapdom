import xs from 'xstream'
import dropRepeats from 'xstream/extra/dropRepeats'
import pairwise from 'xstream/extra/pairwise'
import {VNode, diff, patch} from 'virtual-dom'
import {createMapOnElement, removeMapFromElement, getMapFromElement, patchRecursive, render} from 'virtual-mapdom'

import matchesSelector from 'matches-selector'
import isArray from 'x-is-array'
import fromEvent from './fromevent'

import xstreamSA from '@cycle/xstream-adapter'

const VDOM = {
  diff: diff,
  patch: patch
}

const noop = () => {}
const noopListener = {
  next: noop,
  error: noop,
  complete: noop
}

const g_unanchoredLedger = {}
//const g_anchoredLedger = {}

function makeEmptyMapVDOMNode(options) {
  return new VNode('map', {options})
}


function getAnchorIdFromVTree(vtree) {
  return vtree.properties.anchorId
}

function diffAndPatchToElement(vtree, accessToken) {
  if (typeof vtree === `undefined` || !vtree) { return undefined }

  const newVTree = filterNonTruthyDescendants(vtree)
  const anchorId = getAnchorIdFromVTree(newVTree)
  //console.log(anchorId)
  const anchor = document.getElementById(anchorId)
  //console.log(anchor)
  if (!anchor) {
    //console.log(`not anchored`)
    g_unanchoredLedger[anchorId] = newVTree
    return null
  } else {
    //console.log(`anchored`)
    let mapDOM = getMapFromElement(anchor)

    if (!mapDOM) {
      //g_anchoredLedger[anchorId] = anchor
      const initNode = makeEmptyMapVDOMNode(newVTree.properties.mapOptions || {})
      createMapOnElement(anchor, accessToken, initNode)
      anchor.vtree = initNode
      mapDOM = getMapFromElement(anchor)
    }

    const oldVTree = anchor.vtree

    // console.log("OldVTree")
    // console.log(oldVTree)
    // console.log("NewVTree")
    // console.log(newVTree)


    let diffInfo = VDOM.diff(oldVTree, newVTree)

    // console.log("Diff old vs new VDOM tree...")
    // console.log(diffInfo)


    let rootElem = VDOM.patch(mapDOM, diffInfo, {render: render, patch: patchRecursive})

    anchor.vtree = newVTree
    /* eslint-enable */

    return newVTree
  }

}



function filterNonTruthyDescendants(vtree) {
  if (vtree.children.length) {
    vtree.children = vtree.children.filter(x => x).map(filterNonTruthyDescendants)
    return vtree
  }

  return vtree
}


function renderRawRootElem$(vtree$, accessToken) {

  const anchored$ = vtree$
    .map(vtree => {
      return diffAndPatchToElement(vtree, accessToken)
    })

  const mutation$ = xs.create({
    disposer: null,
    next: null,
    start: function (listener) {
      this.next = function (mutations) {
        //console.log(`mo next`)
        listener.next(mutations)
      };
      const observer = new MutationObserver(this.next);
      const config = { childList: true, subtree: true };
      observer.observe(document, config);
      this.disposer = function () { observer.disconnect();}
    },
    stop: function () {
      if (this.disposer) this.disposer()
    }
  })
  //.debug(x => console.log(`Hey`))
  .map(() => {
    let anchorId

    // for (anchorId in g_anchoredLedger) {
    //   //console.log(`testing anchored`)
    //   const anchor = document.getElementById(anchorId)
    //   //console.log(`Hey`)
    //   if (!anchor) {
    //     //console.log(`saw anchored, removing`)
    //     removeMapFromElement(anchor)
    //     delete g_anchoredLedger[anchorId]
    //   }
    // }

    //return xs.never()

    const buffer = []
    for (anchorId in g_unanchoredLedger) {
      //console.log(`testing unanchored`)
      //console.log(`anchorId: ${anchorId}`)
      const anchor = document.getElementById(anchorId)
      if (anchor) {
        //console.log(`saw unanchored, adding`)
        const vtree = diffAndPatchToElement(g_unanchoredLedger[anchorId], accessToken)
        delete g_unanchoredLedger[anchorId]
        buffer.push(vtree)
      }
    }
    //return xs.never()
    //
    if (buffer.length) {
      return xs.of(...buffer)
    } else {
      return xs.never()
    }

  }).flatten()

  return xs.merge(anchored$, mutation$).filter(x => !!x)
}

function makeEventsSelector(element$, runSA) {
  return function events(eventName) {
    if (typeof eventName !== `string`) {
      throw new Error(`DOM driver's events() expects argument to be a ` +
        `string representing the event type to listen for.`)
    }

    const out$ = element$.map(elements => {
      //console.log("Resubscribing to event: ", eventName)
      if (elements.length === 0) {
        return xs.never()
      }
      return fromEvent(elements, eventName)
    })
    .flatten()

    return runSA ? runSA.adapt(out$, xstreamSA.streamSubscribe) : out$
  }
}

function makeElementSelector(rootEl$, runSA) {
  return function select(selector) {
    //console.log("Element selector, select called with selector: ", selector)
    if (typeof selector !== `string`) {
      throw new Error(`DOM driver's select() expects the argument to be a ` +
        `string as a CSS selector`)
    }

    let trimmedSelector = `${selector}`.trim()
    let element$ = selector.trim() === `:root` ? rootEl$ : rootEl$.map(x => {
      //console.log("Reselecting elements: ", selector);

      let array = isArray(x) ? x : [x]
      return array.map(element => {
        if (matchesSelector(element, trimmedSelector)) {
          return [element]
        } else {
          let nodeList = element.querySelectorAll(trimmedSelector)
          return Array.prototype.slice.call(nodeList)
        }
      })
      .reduce((prev, curr) => prev.concat(curr), [])

    })
    .remember()

    return {
      observable: element$,
      select: makeElementSelector(element$, runSA),
      events: makeEventsSelector(element$, runSA),
    }
  }
}

function makeMapSelector(applied$, runSA) {
  return function chooseMap(anchorId) {
    //console.log(`choosing map: ${anchorId}`)
    const mapDOM$ = applied$
      .filter(vtree => getAnchorIdFromVTree(vtree) === anchorId)
      .map(vtree => {
        const anchor = document.getElementById(anchorId)
        if (anchor) {
          return getMapFromElement(anchor)
        } else {
          return null
        }
      })
      .filter(x => !!x)
      .remember()

    return {
      observable: mapDOM$,
      select: makeElementSelector(mapDOM$, runSA)
    }
  }
}


function makeMapDOMDriver(accessToken) {
  if (!accessToken || (typeof(accessToken) !== 'string' && !(accessToken instanceof String))) throw new Error(`MapDOMDriver requires an access token.`)

  return function mapDomDriver(vtree$, runSA) {

    let adapted$
    if (runSA) {
      adapted$ = runSA.remember(runSA.adapt(vtree$, xstreamSA.streamSubscribe))
    } else {
      adapted$ = vtree$
        .remember()
    }

    var applied$ = renderRawRootElem$(adapted$, accessToken).remember();

    applied$.addListener(noopListener)

    return {
      observable: applied$,
      chooseMap: makeMapSelector(applied$, runSA)
    }
  }
}

export {
  makeMapDOMDriver
}
