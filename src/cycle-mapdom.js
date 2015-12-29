// Importing 'rx-dom' imports 'rx' under the hood, so no need to
import Rx from 'rx-dom'
//import document from 'global/document'
import {VNode, diff, patch} from 'virtual-dom'
import {createMapOnElement, patchRecursive, render} from 'virtual-mapdom'
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
export const g_mapElementRegistry = {}

function makeEmptyMapVDOMNode() {
  return new VNode('map', {})
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
    const proxyElement = g_mapElementRegistry[anchorId]
    let diffInfo = VDOM.diff(oldVTree, newVTree)

    // console.log("Diff old vs new VDOM tree...")
    // console.log(diffInfo)

    let rootElem = VDOM.patch(proxyElement.mapDOM, diffInfo, {render: render, patch: patchRecursive})

    /* eslint-enable */

    return Rx.Observable.just(proxyElement.mapDOM)
  }
}



function bufferWhile(source, selector, isRegulationMessage) {
  return Rx.Observable.create((observer) => {

    let buffer = []
    source.subscribe(
      x => {
        let selectorVal = selector(x)
        let regulator = isRegulationMessage(x)
        if(selectorVal === false) {
          if(!regulator) {
            //console.log("Buffering value...")
            //console.log(x)
            buffer.push(x)
          }
          // else {
          //   console.log("Skipping extraneous regulation message...")
          // }
        } else {
          //console.log("Allowing buffered values release...")
          let bufferLen = buffer.length
          if(bufferLen > 0) {
            //console.log("Buffered values exist...")
            let swapBuffer = []
            let i = -1
            while(++i < bufferLen) {
              let val = buffer[i]
              // There could be multiple unrelated streams
              // aggregated in buffer where predicate is true for one
              // stream but not for others, need to recheck each
              // buffered entry before releasing
              if(selector(val)) {
                //console.log("Releasing buffered value: " + JSON.stringify(val))
                observer.onNext(val)
              } else {
                //console.log("Not releasing buffered value: " + JSON.stringify(val))
                swapBuffer.push(val)
              }
            }

            buffer = swapBuffer
          }

          if(!regulator) {
            //console.log("Passing through trigger message...")
            observer.onNext(x)
          } else {
            //console.log("Filtering out regulation message for onNext call...")
          }
        }
      },
      observer.onError.bind(observer),
      observer.onCompleted.bind(observer)
    )
  })
}

function vdomRegulator(x) {
  return x instanceof MutationRecord
}

function getAnchorIdFromVTree(vtree) {
  return vtree.properties.anchorId
}

function makeSelectorFunction(isRegulationMessage) {
  let rma = g_mapElementRegistry

  function getDOMElement(x) {
    //console.log("Printing observation root...")
    //console.dir(observationRoot)
    return document.getElementById(x)
  }

  // This function will be called whenever a node is added or removed from the
  // DOM or when a new map state is sent
  return function selectorFunction(x) {

    //console.log("Calling selectorFunction...")

    // If it's not a regulator message then it's a VDOM message and
    // the root vdom element should always have an anchorId propery
    // (to-be-attached or attached map)
    if(!isRegulationMessage(x)) {
      //console.log("VTree message sent to selector...")
      //console.log(x)
      // Not a regulator message
      let anchorId = getAnchorIdFromVTree(x)
      if(!anchorId) {
        throw new Error("No anchorId in sent VMapDOM node.")
      }

      // We can only operate on a map that is attached to a valid DOM element.
      // There could be a period of time where we start sending map state
      // for a map that is anchored to an element that is not created in the
      // DOM yet.

      // Check if we've seen this anchorId before, if not register it while
      // initializing the value (boolean indicating if anchor represents a
      // valid DOM element, i.e. element that is attached to DOM) to false
      let firstTime = false
      if(!rma.hasOwnProperty(anchorId)) {
        //console.log("Registering record for anchor: " + anchorId)
        rma[anchorId] = false
        firstTime = true
      }

      // Check the registeredMapAnchor state, if true, then element is
      // registered and map operations can commence
      if(rma[anchorId] === false) {
        // Check if the anchorId is attached to the DOM (i.e. DOM change
        // happened before the anchorId was registered so a test against
        // the registeredMapAnchors would have failedwhen the addedNode message
        // came)
        const domEl = getDOMElement(anchorId)
        if(domEl) {
          if(firstTime) {
            //console.log("Anchor has already been attached, returning true...")
          } else {
            console.log("Dunno if this else statement is ever called...")
            console.log("Anchor is registered, was not attached but now is, returning true...")
          }

          createMapOnElement(domEl, g_MBAccessToken, makeEmptyMapVDOMNode())
          //console.dir(domEl)
          rma[anchorId] = domEl
          return true
        } else {
          // This means the anchorId is registered and the element is not yet
          // valid and we should not allow it to pass
          //console.log("anchorId is registered but not attached, returning false...")
          return false
        }
      } else {
        //console.log("anchorId is registered and attached, returning true...")
        return true
      }
    } else {
      //console.log("Regulation message sent to selector...")
      //console.log(x)
      let anyAdded = false
      // The message is from the MutationObserver, check all the keys in the
      // registeredMutationObserver. If a key exists then test if the element
      // exists in the DOM and set it's DOM state appropriately
      for(var key in rma) {
        let inDOM = getDOMElement(key)
        //let testVal = inDOM ? "true" : "false"
        //console.log("Testing key: " + key + ", " + testVal )
        if(inDOM) {
          // If it's in the DOM but the registration is false, set it
          // to true, and return a message indicating which key was added
          if (rma[key] === false ) {
            //console.log("Transition made: " + key + ", added")
            //console.log("Adding map element registry...")
            createMapOnElement(inDOM, g_MBAccessToken, makeEmptyMapVDOMNode())
            rma[key] = inDOM
            anyAdded = true
          }
        } else {
          if(rma[key] !== false) {
            //console.log("Transition made: " + key + ", removed")
            //console.log("Removing key from map element registry...")
            delete rma[key]
          }
        }
      }

      // If any relevant elements were added to the DOM then send true
      // signal
      return anyAdded
    }
  }
}

function makeRegulatedRawRootElem$(vtree$) {
  let moConfig = { childList: true, subtree: true}

  let regulation$ = Rx.DOM.fromMutationObserver(document, moConfig)
           .concatMap((x) => Rx.Observable.from(x))
           .filter((x) => {
             return (x.addedNodes.length > 0 || x.removedNodes.length > 0)
             })
           //.doOnNext(x => {console.log("MutationRecord..."); console.log(x)})

  return bufferWhile(Rx.Observable.merge(regulation$, vtree$), makeSelectorFunction(vdomRegulator), vdomRegulator)
  //return Rx.Observable.merge(regulation$, vtree$)
}

function renderRawRootElem$(vtree$) {

  let diffAndPatchToElement$ = makeDiffAndPatchToElement$()

  // The makeEmptyMapVDOMNode call below is replicated in the function
  // makeSelectorFunction.  If the line below is changed then the line
  // in that section should change too since the initial element of pairwise
  // needs to be mirrored in the actual initial state of the instantiated mapVDOM
  return makeRegulatedRawRootElem$(vtree$)
    .flatMapLatest(transposeVTree)
    .startWith(makeEmptyMapVDOMNode())
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

function makeMapDOMDriver(accessToken) {
  if (!accessToken || (typeof(accessToken) !== 'string' && !(accessToken instanceof String))) throw new Error(`MapDOMDriver requires an access token.`)

  g_MBAccessToken = accessToken

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
}
