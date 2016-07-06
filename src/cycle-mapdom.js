import xs from 'xstream'
import dropRepeats from 'xstream/extra/dropRepeats'
import pairwise from 'xstream/extra/pairwise'
import {VNode, diff, patch} from 'virtual-dom'
import {createMapOnElement, removeMapFromElement, getMapFromElement as getMapDOMFromElement, patchRecursive, render} from 'virtual-mapdom'
import {transposeVTree} from './transposition'

import matchesSelector from 'matches-selector'
import isArray from 'x-is-array'
import fromEvent from './fromevent'

import xstreamSA from '@cycle/xstream-adapter'

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


function diffAndPatchToElement$([oldVTree, newVTree]) {
  if (typeof newVTree === `undefined`) { return undefined }

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

  return mapDOM
}

function getAnchorIdFromVTree(vtree) {
  return vtree.properties.anchorId
}

function makeRegulatedRawRootElem$(vtree$) {

  let g_registeredAnchorId

  const anchorRegistration$ = vtree$.map(function (vtree) {
    g_registeredAnchorId = getAnchorIdFromVTree(vtree);
    return vtree;
  });

  const mutationObserverConfig = { childList: true, subtree: true };

  const elementRegistration$ = xs.create({
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

  //
  //
  // const elementRegistration$ = xs.create({
  //   start: (listener) => {
  //     const observer = new MutationObserver((mutations) => {
  //       listener.next(mutations)
  //     });
  //
  //     const config = { childList: true, subtree: true };
  //     observer.observe(document, config);
  //
  //     removeFunc = function () { observer.disconnect();}
  //   },
  //   stop: () => {
  //     if (removeFunc) removeFunc()
  //   }
  // })

  const regulation$ = xs.merge(
    anchorRegistration$,
    elementRegistration$
  )
  .map(() => g_registeredAnchorId && document.getElementById(g_registeredAnchorId))
  .compose(dropRepeats())
  .map(element => {
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
  .map(anchorAvailable => {
    //console.log(`anchorAvailable: ${anchorAvailable}`)
    if (anchorAvailable) {
      return vtree$
        .startWith(makeEmptyMapVDOMNode(g_MBMapOptions))
        .compose(pairwise)
        .map(diffAndPatchToElement$)
        .filter(x => !!x)
    } else {
      return xs.never()
    }
  })
  .flatten()

  return regulation$
}

function renderRawRootElem$(vtree$) {
  return makeRegulatedRawRootElem$(vtree$)
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
    //.doOnNext(x => console.log(x))

    return {
      observable: element$,
      select: makeElementSelector(element$, runSA),
      events: makeEventsSelector(element$, runSA),
    }
  }
}

function validateMapDOMDriverInput(vtree$) {
  if (!vtree$ || typeof vtree$.subscribe !== `function`) {
    throw new Error(`The DOM driver function expects as input an ` +
      `Observable of virtual DOM elements`)
  }
}

const noop = () => {}
const noopListener = {
  next: noop,
  error: noop,
  complete: noop
}

function makeMapDOMDriver(accessToken, options) {
  if (!accessToken || (typeof(accessToken) !== 'string' && !(accessToken instanceof String))) throw new Error(`MapDOMDriver requires an access token.`)

  g_MBAccessToken = accessToken
  g_MBMapOptions = options || {}

  return function mapDomDriver(vtree$, runSA) {

    let adapted$
    if (runSA) {
      adapted$ = runSA.remember(runSA.adapt(vtree$, xstreamSA.streamSubscribe))
    } else {
      adapted$ = vtree$
        .remember()
    }

    var rootElem$ = renderRawRootElem$(adapted$).remember();


    rootElem$.addListener(noopListener)

    return {
      select: makeElementSelector(rootElem$, runSA),
      dispose: noop,
      isolateSource: isolateSource,
      isolateSink: isolateSink
    }
  }
}

export {
  makeMapDOMDriver,
  g_registeredElement
}
