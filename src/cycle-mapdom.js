// Importing 'rx-dom' imports 'rx' under the hood, so no need to
import Rx from 'rx-dom'
//import document from 'global/document'
import {VNode, diff, patch} from 'virtual-dom'
import {createMapOnElement, removeMapFromElement, getMapFromElement as getMapDOMFromElement, patchRecursive, render} from 'virtual-mapdom'
import {transposeVTree} from './transposition'

import matchesSelector from 'matches-selector'
import isArray from 'x-is-array'
import {fromEvent} from './fromevent'
// // Try-catch to prevent unnecessary import of DOM-specifics in Node.js env:
// try {
//   matchesSelector = require(`matches-selector`)
// } catch (err) {
//   matchesSelector = () => {}
// }

const VDOM = {
  diff: diff,
  patch: patch
}

let g_MBAccessToken
let g_MBMapOptions


let g_registeredElement

function makeEmptyMapVDOMNode(options) {
  return new VNode('map', {options})
}

function makeEmptyMapDOMElement() {
  return document.createElement('map')
}


// function Element(element) {
//   const options = { zoomControl: false }
//   const map = L.mapbox.map(element, null, options)
//   element.mapDOM = makeEmptyMapDOMElement()
//   element.mapDOM.instance = map
// }


function makeDiffAndPatchToElement$() {

  return function diffAndPatchToElement$([oldVTree, newVTree]) {
    if (typeof newVTree === `undefined`) { return Rx.Observable.empty() }

    // console.log("OldVTree")
    // console.log(oldVTree)
    // console.log("NewVTree")
    // console.log(newVTree)
    /* eslint-disable */

    const anchorId = getAnchorIdFromVTree(newVTree)
    const mapDOM = getMapDOMFromElement(g_registeredElement)
    let diffInfo = VDOM.diff(oldVTree, newVTree)

    // console.log("Diff old vs new VDOM tree...")
    // console.log(diffInfo)


    let rootElem = VDOM.patch(mapDOM, diffInfo, {render: render, patch: patchRecursive})

    /* eslint-enable */

    return Rx.Observable.just(mapDOM)
  }
}

function getAnchorIdFromVTree(vtree) {
  return vtree.properties.anchorId
}

function makeRegulatedRawRootElem$(vtree$) {

  let g_registeredAnchorId
  const sharedVTree$ = vtree$.shareReplay(1)
  const anchorRegistration$ = sharedVTree$.do(vtree => {
    g_registeredAnchorId = getAnchorIdFromVTree(vtree)
  })

  const mutationObserverConfig = { childList: true, subtree: true }
  const elementRegistration$ = Rx.DOM.fromMutationObserver(document, mutationObserverConfig)

    //.do(x => console.log(`mutation observed`))
    //.map(x => g_registeredElement = g_registeredAnchorId && document.getElementById(registeredAnchorId))

  const regulation$ = Rx.Observable.merge(
    anchorRegistration$,
    elementRegistration$
  )
  .map(() => g_registeredAnchorId && document.getElementById(g_registeredAnchorId))
  .distinctUntilChanged()
  .filter(element => {
    if (element) {
      g_registeredElement = element
      createMapOnElement(g_registeredElement, g_MBAccessToken, makeEmptyMapVDOMNode(g_MBMapOptions))
      return true
    } else {
      if (g_registeredElement) {
        removeMapFromElement(g_registeredElement)
        g_registeredElement = undefined
      }
      return false
    }
  })
  .flatMapLatest(anchorAvailable => anchorAvailable ? sharedVTree$ : Rx.Observable.empty())

  return regulation$
}

function renderRawRootElem$(vtree$) {

  let diffAndPatchToElement$ = makeDiffAndPatchToElement$()

  // The makeEmptyMapVDOMNode call below is replicated in the function
  // makeSelectorFunction.  If the line below is changed then the line
  // in that section should change too since the initial element of pairwise
  // needs to be mirrored in the actual initial state of the instantiated mapVDOM
  return makeRegulatedRawRootElem$(vtree$)
    .flatMapLatest(transposeVTree)
    .startWith(makeEmptyMapVDOMNode(g_MBMapOptions))
    .pairwise()
    .flatMap(diffAndPatchToElement$)
}

function isolateSource(source, scope) {
  return source.select(".cycle-scope-" + scope);
}

function isolateSink(sink, scope) {
  return sink.map(function (vtree) {
    vtree.properties = vtree.properties || {}
    vtree.properties.attributes = vtree.properties.attributes || {}
    const vtreeClass = vtree.properties.attributes.class === undefined ? `` : vtree.properties.attributes.class

    if (vtreeClass.indexOf("cycle-scope-" + scope) === -1) {
      const c = (vtreeClass + " cycle-scope-" + scope).trim();
      vtree.properties.attributes.class = c;
    }
    return vtree;
  });
}


function makeEventsSelector(element$) {
  return function events(eventName) {
    if (typeof eventName !== `string`) {
      throw new Error(`DOM driver's events() expects argument to be a ` +
        `string representing the event type to listen for.`)
    }

    return element$.flatMapLatest(elements => {
      //console.log("Resubscribing to event: ", eventName)
      if (elements.length === 0) {
        return Rx.Observable.empty()
      }
      return fromEvent(elements, eventName)
    }).share()
  }
}

function makeElementSelector(rootEl$) {
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
    //.doOnNext(x => console.log(x))

    return {
      observable: element$,
      select: makeElementSelector(element$),
      events: makeEventsSelector(element$),
    }
  }
}

function validateMapDOMDriverInput(vtree$) {
  if (!vtree$ || typeof vtree$.subscribe !== `function`) {
    throw new Error(`The DOM driver function expects as input an ` +
      `Observable of virtual DOM elements`)
  }
}

function makeMapDOMDriver(accessToken, options) {
  if (!accessToken || (typeof(accessToken) !== 'string' && !(accessToken instanceof String))) throw new Error(`MapDOMDriver requires an access token.`)

  g_MBAccessToken = accessToken
  g_MBMapOptions = options || {}

  return function mapDomDriver(vtree$, driverName) {

    validateMapDOMDriverInput(vtree$)

    let rootElem$ = renderRawRootElem$(vtree$)
      .replay(null, 1)

    let disposable = rootElem$.connect()

    return {
      select: makeElementSelector(rootElem$),
      dispose: () => disposable.dispose.bind(disposable),
      isolateSource: isolateSource,
      isolateSink: isolateSink
    }
  }
}

export {
  makeMapDOMDriver,
  g_registeredElement
}
