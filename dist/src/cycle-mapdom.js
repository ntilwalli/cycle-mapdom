'use strict';

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; })(); // Importing 'rx-dom' imports 'rx' under the hood, so no need to

//import document from 'global/document'

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.makeMapDOMDriver = exports.g_mapElementRegistry = undefined;

var _rxDom = require('rx-dom');

var _rxDom2 = _interopRequireDefault(_rxDom);

var _virtualDom = require('virtual-dom');

var _virtualMapdom = require('virtual-mapdom');

var _transposition = require('./transposition');

var _matchesSelector = require('matches-selector');

var _matchesSelector2 = _interopRequireDefault(_matchesSelector);

var _xIsArray = require('x-is-array');

var _xIsArray2 = _interopRequireDefault(_xIsArray);

var _fromevent = require('./fromevent');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// // Try-catch to prevent unnecessary import of DOM-specifics in Node.js env:
// try {
//   matchesSelector = require(`matches-selector`)
// } catch (err) {
//   matchesSelector = () => {}
// }

var VDOM = {
  diff: _virtualDom.diff,
  patch: _virtualDom.patch
};

var g_MBAccessToken = undefined;
var g_MBMapOptions = undefined;

var g_mapElementRegistry = exports.g_mapElementRegistry = {};

function makeEmptyMapVDOMNode(options) {
  return new _virtualDom.VNode('map', { options: options });
}

function makeEmptyMapDOMElement() {
  return document.createElement('map');
}

// function Element(element) {
//   const options = { zoomControl: false }
//   const map = L.mapbox.map(element, null, options)
//   element.mapDOM = makeEmptyMapDOMElement()
//   element.mapDOM.instance = map
// }

function makeDiffAndPatchToElement$() {

  return function diffAndPatchToElement$(_ref) {
    var _ref2 = _slicedToArray(_ref, 2);

    var oldVTree = _ref2[0];
    var newVTree = _ref2[1];

    if (typeof newVTree === 'undefined') {
      return _rxDom2.default.Observable.empty();
    }

    // console.log("OldVTree")
    // console.log(oldVTree)
    // console.log("NewVTree")
    // console.log(newVTree)
    /* eslint-disable */

    var anchorId = getAnchorIdFromVTree(newVTree);
    var proxyElement = g_mapElementRegistry[anchorId];
    var diffInfo = VDOM.diff(oldVTree, newVTree);

    // console.log("Diff old vs new VDOM tree...")
    // console.log(diffInfo)

    var rootElem = VDOM.patch(proxyElement.mapDOM, diffInfo, { render: _virtualMapdom.render, patch: _virtualMapdom.patchRecursive });

    /* eslint-enable */

    return _rxDom2.default.Observable.just(proxyElement.mapDOM);
  };
}

function bufferWhile(source, selector, isRegulationMessage) {
  return _rxDom2.default.Observable.create(function (observer) {

    var buffer = [];
    source.subscribe(function (x) {
      var selectorVal = selector(x);
      var regulator = isRegulationMessage(x);
      if (selectorVal === false) {
        if (!regulator) {
          //console.log("Buffering value...")
          //console.log(x)
          buffer.push(x);
        }
        // else {
        //   console.log("Skipping extraneous regulation message...")
        // }
      } else {
          //console.log("Allowing buffered values release...")
          var bufferLen = buffer.length;
          if (bufferLen > 0) {
            //console.log("Buffered values exist...")
            var swapBuffer = [];
            var i = -1;
            while (++i < bufferLen) {
              var val = buffer[i];
              // There could be multiple unrelated streams
              // aggregated in buffer where predicate is true for one
              // stream but not for others, need to recheck each
              // buffered entry before releasing
              if (selector(val)) {
                //console.log("Releasing buffered value: " + JSON.stringify(val))
                observer.onNext(val);
              } else {
                //console.log("Not releasing buffered value: " + JSON.stringify(val))
                swapBuffer.push(val);
              }
            }

            buffer = swapBuffer;
          }

          if (!regulator) {
            //console.log("Passing through trigger message...")
            observer.onNext(x);
          } else {
            //console.log("Filtering out regulation message for onNext call...")
          }
        }
    }, observer.onError.bind(observer), observer.onCompleted.bind(observer));
  });
}

function vdomRegulator(x) {
  return x instanceof MutationRecord;
}

function getAnchorIdFromVTree(vtree) {
  return vtree.properties.anchorId;
}

function makeSelectorFunction(isRegulationMessage) {
  var rma = g_mapElementRegistry;

  function getDOMElement(x) {
    //console.log("Printing observation root...")
    //console.dir(observationRoot)
    return document.getElementById(x);
  }

  // This function will be called whenever a node is added or removed from the
  // DOM or when a new map state is sent
  return function selectorFunction(x) {

    //console.log("Calling selectorFunction...")

    // If it's not a regulator message then it's a VDOM message and
    // the root vdom element should always have an anchorId propery
    // (to-be-attached or attached map)
    if (!isRegulationMessage(x)) {
      //console.log("VTree message sent to selector...")
      //console.log(x)
      // Not a regulator message
      var anchorId = getAnchorIdFromVTree(x);
      if (!anchorId) {
        // For some reason console.error is not called from tape...
        console.log('WARNING: No anchorId given in VTree. AnchorId is required for map to be created.');
        // Should never throw an exception from a subscribe function so commenting, also because
        // exception is not being passed up all the way and is causing tape/testling to hang when thrown.
        // That should not happen but I don't know which layer is the issue, RxJS, testling or tap... don't know which,
        // but I'm pretty sure it shouldn't cause a hang... leaving here to investigate later...
        //throw new Error("No anchorId in sent VMapDOM node.")
      }

      // We can only operate on a map that is attached to a valid DOM element.
      // There could be a period of time where we start sending map state
      // for a map that is anchored to an element that is not created in the
      // DOM yet.

      // Check if we've seen this anchorId before, if not register it while
      // initializing the value (boolean indicating if anchor represents a
      // valid DOM element, i.e. element that is attached to DOM) to false
      var firstTime = false;
      if (!rma.hasOwnProperty(anchorId)) {
        //console.log("Registering record for anchor: " + anchorId)
        rma[anchorId] = false;
        firstTime = true;
      }

      // Check the registeredMapAnchor state, if true, then element is
      // registered and map operations can commence
      if (rma[anchorId] === false) {
        // Check if the anchorId is attached to the DOM (i.e. DOM change
        // happened before the anchorId was registered so a test against
        // the registeredMapAnchors would have failedwhen the addedNode message
        // came)
        var domEl = getDOMElement(anchorId);
        if (domEl) {
          if (firstTime) {
            //console.log("Anchor has already been attached, returning true...")
          } else {
              console.log("Dunno if this else statement is ever called...");
              console.log("Anchor is registered, was not attached but now is, returning true...");
            }

          (0, _virtualMapdom.createMapOnElement)(domEl, g_MBAccessToken, makeEmptyMapVDOMNode(g_MBMapOptions));
          //console.dir(domEl)
          rma[anchorId] = domEl;
          return true;
        } else {
          // This means the anchorId is registered and the element is not yet
          // valid and we should not allow it to pass
          //console.log("anchorId is registered but not attached, returning false...")
          return false;
        }
      } else {
        //console.log("anchorId is registered and attached, returning true...")
        return true;
      }
    } else {
      //console.log("Regulation message sent to selector...")
      //console.log(x)
      var anyAdded = false;
      // The message is from the MutationObserver, check all the keys in the
      // registeredMutationObserver. If a key exists then test if the element
      // exists in the DOM and set it's DOM state appropriately
      for (var key in rma) {
        var inDOM = getDOMElement(key);
        //let testVal = inDOM ? "true" : "false"
        //console.log("Testing key: " + key + ", " + testVal )
        if (inDOM) {
          // If it's in the DOM but the registration is false, set it
          // to true, and return a message indicating which key was added
          if (rma[key] === false) {
            //console.log("Transition made: " + key + ", added")
            //console.log("Adding map element registry...")
            (0, _virtualMapdom.createMapOnElement)(inDOM, g_MBAccessToken, makeEmptyMapVDOMNode(g_MBMapOptions));
            rma[key] = inDOM;
            anyAdded = true;
          }
        } else {
          if (rma[key] !== false) {
            //console.log("Transition made: " + key + ", removed")
            //console.log("Removing key from map element registry...")
            delete rma[key];
          }
        }
      }

      // If any relevant elements were added to the DOM then send true
      // signal
      return anyAdded;
    }
  };
}

function makeRegulatedRawRootElem$(vtree$) {
  var moConfig = { childList: true, subtree: true };

  var regulation$ = _rxDom2.default.DOM.fromMutationObserver(document, moConfig).concatMap(function (x) {
    return _rxDom2.default.Observable.from(x);
  }).filter(function (x) {
    return x.addedNodes.length > 0 || x.removedNodes.length > 0;
  });
  //.doOnNext(x => {console.log("MutationRecord..."); console.log(x)})

  return bufferWhile(_rxDom2.default.Observable.merge(regulation$, vtree$), makeSelectorFunction(vdomRegulator), vdomRegulator);
  //return Rx.Observable.merge(regulation$, vtree$)
}

function renderRawRootElem$(vtree$) {

  var diffAndPatchToElement$ = makeDiffAndPatchToElement$();

  // The makeEmptyMapVDOMNode call below is replicated in the function
  // makeSelectorFunction.  If the line below is changed then the line
  // in that section should change too since the initial element of pairwise
  // needs to be mirrored in the actual initial state of the instantiated mapVDOM
  return makeRegulatedRawRootElem$(vtree$).flatMapLatest(_transposition.transposeVTree).startWith(makeEmptyMapVDOMNode(g_MBMapOptions)).pairwise().flatMap(diffAndPatchToElement$);
}

function isolateSource(source, scope) {
  return source.select(".cycle-scope-" + scope);
}

function isolateSink(sink, scope) {
  return sink.map(function (vtree) {
    vtree.properties = vtree.properties || {};
    vtree.properties.attributes = vtree.properties.attributes || {};
    var vtreeClass = vtree.properties.attributes.class === undefined ? '' : vtree.properties.attributes.class;

    if (vtreeClass.indexOf("cycle-scope-" + scope) === -1) {
      var c = (vtreeClass + " cycle-scope-" + scope).trim();
      vtree.properties.attributes.class = c;
    }
    return vtree;
  });
}

function makeEventsSelector(element$) {
  return function events(eventName) {
    if (typeof eventName !== 'string') {
      throw new Error('DOM driver\'s events() expects argument to be a ' + 'string representing the event type to listen for.');
    }

    return element$.flatMapLatest(function (elements) {
      //console.log("Resubscribing to event: ", eventName)
      if (elements.length === 0) {
        return _rxDom2.default.Observable.empty();
      }
      return (0, _fromevent.fromEvent)(elements, eventName);
    }).share();
  };
}

function makeElementSelector(rootEl$) {
  return function select(selector) {
    //console.log("Element selector, select called with selector: ", selector)
    if (typeof selector !== 'string') {
      throw new Error('DOM driver\'s select() expects the argument to be a ' + 'string as a CSS selector');
    }

    var trimmedSelector = ('' + selector).trim();
    var element$ = selector.trim() === ':root' ? rootEl$ : rootEl$.map(function (x) {
      //console.log("Reselecting elements: ", selector);

      var array = (0, _xIsArray2.default)(x) ? x : [x];
      return array.map(function (element) {
        if ((0, _matchesSelector2.default)(element, trimmedSelector)) {
          return [element];
        } else {
          var nodeList = element.querySelectorAll(trimmedSelector);
          return Array.prototype.slice.call(nodeList);
        }
      }).reduce(function (prev, curr) {
        return prev.concat(curr);
      }, []);
    });
    //.doOnNext(x => console.log(x))

    return {
      observable: element$,
      select: makeElementSelector(element$),
      events: makeEventsSelector(element$)
    };
  };
}

function validateMapDOMDriverInput(vtree$) {
  if (!vtree$ || typeof vtree$.subscribe !== 'function') {
    throw new Error('The DOM driver function expects as input an ' + 'Observable of virtual DOM elements');
  }
}

function makeMapDOMDriver(accessToken, options) {
  if (!accessToken || typeof accessToken !== 'string' && !(accessToken instanceof String)) throw new Error('MapDOMDriver requires an access token.');

  g_MBAccessToken = accessToken;
  g_MBMapOptions = options || {};

  return function mapDomDriver(vtree$, driverName) {

    validateMapDOMDriverInput(vtree$);

    var rootElem$ = renderRawRootElem$(vtree$).replay(null, 1);

    var disposable = rootElem$.connect();

    return {
      select: makeElementSelector(rootElem$),
      dispose: function dispose() {
        return disposable.dispose.bind(disposable);
      },
      isolateSource: isolateSource,
      isolateSink: isolateSink
    };
  };
}

exports.makeMapDOMDriver = makeMapDOMDriver;