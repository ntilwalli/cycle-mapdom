'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.g_registeredElement = exports.makeMapDOMDriver = undefined;

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }(); // Importing 'rx-dom' imports 'rx' under the hood, so no need to

//import document from 'global/document'


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

var _rxAdapter = require('@cycle/rx-adapter');

var _rxAdapter2 = _interopRequireDefault(_rxAdapter);

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

var g_MBAccessToken = void 0;
var g_MBMapOptions = void 0;

var g_registeredElement = void 0;

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

function diffAndPatchToElement$(_ref) {
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
  var mapDOM = (0, _virtualMapdom.getMapFromElement)(g_registeredElement);
  var diffInfo = VDOM.diff(oldVTree, newVTree);

  // console.log("Diff old vs new VDOM tree...")
  // console.log(diffInfo)

  var rootElem = VDOM.patch(mapDOM, diffInfo, { render: _virtualMapdom.render, patch: _virtualMapdom.patchRecursive });

  /* eslint-enable */

  return _rxDom2.default.Observable.just(mapDOM);
}

function getAnchorIdFromVTree(vtree) {
  return vtree.properties.anchorId;
}

function makeRegulatedRawRootElem$(vtree$) {

  var g_registeredAnchorId = void 0;
  var sharedVTree$ = vtree$.shareReplay(1);
  var anchorRegistration$ = sharedVTree$.do(function (vtree) {
    g_registeredAnchorId = getAnchorIdFromVTree(vtree);
  });

  var mutationObserverConfig = { childList: true, subtree: true };
  var elementRegistration$ = _rxDom2.default.DOM.fromMutationObserver(document, mutationObserverConfig);

  //.do(x => console.log(`mutation observed`))
  //.map(x => g_registeredElement = g_registeredAnchorId && document.getElementById(registeredAnchorId))

  var regulation$ = _rxDom2.default.Observable.merge(anchorRegistration$, elementRegistration$).map(function () {
    return g_registeredAnchorId && document.getElementById(g_registeredAnchorId);
  }).distinctUntilChanged().map(function (element) {
    if (element) {
      exports.g_registeredElement = g_registeredElement = element;
      (0, _virtualMapdom.createMapOnElement)(g_registeredElement, g_MBAccessToken, makeEmptyMapVDOMNode(g_MBMapOptions));
      return true;
    } else {
      if (g_registeredElement) {
        (0, _virtualMapdom.removeMapFromElement)(g_registeredElement);
        exports.g_registeredElement = g_registeredElement = undefined;
      }
      return false;
    }
  }).flatMapLatest(function (anchorAvailable) {
    //console.log(`anchorAvailable: ${anchorAvailable}`)
    if (anchorAvailable) {
      return sharedVTree$.flatMapLatest(_transposition.transposeVTree).startWith(makeEmptyMapVDOMNode(g_MBMapOptions)).pairwise().flatMap(diffAndPatchToElement$);
    } else {
      return _rxDom2.default.Observable.empty();
    }
  });

  return regulation$;
}

function renderRawRootElem$(vtree$) {
  return makeRegulatedRawRootElem$(vtree$);
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

function makeEventsSelector(element$, runStreamAdapter) {
  return function events(eventName) {
    if (typeof eventName !== 'string') {
      throw new Error('DOM driver\'s events() expects argument to be a ' + 'string representing the event type to listen for.');
    }

    var out$ = element$.flatMapLatest(function (elements) {
      //console.log("Resubscribing to event: ", eventName)
      if (elements.length === 0) {
        return _rxDom2.default.Observable.empty();
      }
      return (0, _fromevent.fromEvent)(elements, eventName);
    }).share();

    return runStreamAdapter ? runStreamAdapter.adapt(out$, _rxAdapter2.default.streamSubscribe) : out$kajsdkj;
  };
}

function makeElementSelector(rootEl$, runSA) {
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
      select: makeElementSelector(element$, runSA),
      events: makeEventsSelector(element$, runSA)
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

  return function mapDomDriver(vtree$, runSA) {

    validateMapDOMDriverInput(vtree$);

    var rootElem$ = renderRawRootElem$(vtree$).replay(null, 1);

    var disposable = rootElem$.connect();

    return {
      select: makeElementSelector(rootElem$, runSA),
      dispose: function dispose() {
        return disposable.dispose.bind(disposable);
      },
      isolateSource: isolateSource,
      isolateSink: isolateSink
    };
  };
}

exports.makeMapDOMDriver = makeMapDOMDriver;
exports.g_registeredElement = g_registeredElement;