'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.g_registeredElement = exports.makeMapDOMDriver = undefined;

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _xstream = require('xstream');

var _xstream2 = _interopRequireDefault(_xstream);

var _dropRepeats = require('xstream/extra/dropRepeats');

var _dropRepeats2 = _interopRequireDefault(_dropRepeats);

var _pairwise = require('xstream/extra/pairwise');

var _pairwise2 = _interopRequireDefault(_pairwise);

var _virtualDom = require('virtual-dom');

var _virtualMapdom = require('virtual-mapdom');

var _transposition = require('./transposition');

var _matchesSelector = require('matches-selector');

var _matchesSelector2 = _interopRequireDefault(_matchesSelector);

var _xIsArray = require('x-is-array');

var _xIsArray2 = _interopRequireDefault(_xIsArray);

var _fromevent = require('./fromevent');

var _fromevent2 = _interopRequireDefault(_fromevent);

var _xstreamAdapter = require('@cycle/xstream-adapter');

var _xstreamAdapter2 = _interopRequireDefault(_xstreamAdapter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
    return undefined;
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

  return mapDOM;
}

function getAnchorIdFromVTree(vtree) {
  return vtree.properties.anchorId;
}

function filterNonTruthyDescendants(vtree) {
  if (vtree.children.length) {
    vtree.children = vtree.children.filter(function (x) {
      return x;
    }).map(filterNonTruthyDescendants);
    return vtree;
  }

  return vtree;
}

function makeRegulatedRawRootElem$(vtree$) {

  var g_registeredAnchorId = void 0;

  var anchorRegistration$ = vtree$.filter(function (vtree) {
    return vtree;
  }).map(function (vtree) {
    //console.log(`Registering anchor`)
    g_registeredAnchorId = getAnchorIdFromVTree(vtree);
    return vtree;
  });

  var mutationObserverConfig = { childList: true, subtree: true };

  var elementRegistration$ = _xstream2.default.create({
    disposer: null,
    next: null,
    start: function start(listener) {
      this.next = function (mutations) {
        //console.log(`mo next`)
        listener.next(mutations);
      };
      var observer = new MutationObserver(this.next);
      var config = { childList: true, subtree: true };
      observer.observe(document, config);
      this.disposer = function () {
        observer.disconnect();
      };
    },
    stop: function stop() {
      if (this.disposer) this.disposer();
    }
  });

  var regulation$ = _xstream2.default.merge(anchorRegistration$, elementRegistration$).map(function () {
    return g_registeredAnchorId && document.getElementById(g_registeredAnchorId);
  }).compose((0, _dropRepeats2.default)()).map(function (element) {
    if (element) {
      exports.g_registeredElement = g_registeredElement = element;
      //console.log(`Found anchor element`)
      //createMapOnElement(g_registeredElement, g_MBAccessToken, makeEmptyMapVDOMNode(g_MBMapOptions))
      return true;
    } else {
      if (g_registeredElement) {
        if ((0, _virtualMapdom.getMapFromElement)(g_registeredElement)) {
          //console.log(`Removing map`)
          (0, _virtualMapdom.removeMapFromElement)(g_registeredElement);
        }

        //console.log(`Unregistering anchor`)
        exports.g_registeredElement = g_registeredElement = undefined;
      }
      return false;
    }
  }).map(function (anchorAvailable) {
    //console.log(`anchorAvailable: ${anchorAvailable}`)
    if (anchorAvailable) {
      return vtree$.map(filterNonTruthyDescendants).map(function (vtree) {
        if (!(0, _virtualMapdom.getMapFromElement)(g_registeredElement)) {
          var initNode = makeEmptyMapVDOMNode(vtree.properties.mapOptions);
          (0, _virtualMapdom.createMapOnElement)(g_registeredElement, g_MBAccessToken, initNode);

          return _xstream2.default.of(initNode, vtree);
        } else {
          return _xstream2.default.of(vtree);
        }
      }).flatten().compose(_pairwise2.default).map(diffAndPatchToElement$).filter(function (x) {
        return !!x;
      });
    } else {
      return _xstream2.default.never();
    }
  }).flatten();

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

function makeEventsSelector(element$, runSA) {
  return function events(eventName) {
    if (typeof eventName !== 'string') {
      throw new Error('DOM driver\'s events() expects argument to be a ' + 'string representing the event type to listen for.');
    }

    var out$ = element$.map(function (elements) {
      //console.log("Resubscribing to event: ", eventName)
      if (elements.length === 0) {
        return _xstream2.default.never();
      }
      return (0, _fromevent2.default)(elements, eventName);
    }).flatten();

    return runSA ? runSA.adapt(out$, _xstreamAdapter2.default.streamSubscribe) : out$;
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

var noop = function noop() {};
var noopListener = {
  next: noop,
  error: noop,
  complete: noop
};

function makeMapDOMDriver(accessToken, options) {
  if (!accessToken || typeof accessToken !== 'string' && !(accessToken instanceof String)) throw new Error('MapDOMDriver requires an access token.');

  g_MBAccessToken = accessToken;
  g_MBMapOptions = options || {};

  return function mapDomDriver(vtree$, runSA) {

    var adapted$ = void 0;
    if (runSA) {
      adapted$ = runSA.remember(runSA.adapt(vtree$, _xstreamAdapter2.default.streamSubscribe));
    } else {
      adapted$ = vtree$.remember();
    }

    var rootElem$ = renderRawRootElem$(adapted$).remember();

    rootElem$.addListener(noopListener);

    return {
      select: makeElementSelector(rootElem$, runSA),
      dispose: noop,
      isolateSource: isolateSource,
      isolateSink: isolateSink
    };
  };
}

exports.makeMapDOMDriver = makeMapDOMDriver;
exports.g_registeredElement = g_registeredElement;