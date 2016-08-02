'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.makeMapDOMDriver = undefined;

var _xstream = require('xstream');

var _xstream2 = _interopRequireDefault(_xstream);

var _dropRepeats = require('xstream/extra/dropRepeats');

var _dropRepeats2 = _interopRequireDefault(_dropRepeats);

var _pairwise = require('xstream/extra/pairwise');

var _pairwise2 = _interopRequireDefault(_pairwise);

var _virtualDom = require('virtual-dom');

var _virtualMapdom = require('virtual-mapdom');

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

var noop = function noop() {};
var noopListener = {
  next: noop,
  error: noop,
  complete: noop
};

var g_unanchoredLedger = {};
//const g_anchoredLedger = {}

function makeEmptyMapVDOMNode(options) {
  return new _virtualDom.VNode('map', { options: options });
}

function getAnchorIdFromVTree(vtree) {
  return vtree.properties.anchorId;
}

function diffAndPatchToElement(vtree, accessToken) {
  if (typeof vtree === 'undefined' || !vtree) {
    return undefined;
  }

  var newVTree = filterNonTruthyDescendants(vtree);
  var anchorId = getAnchorIdFromVTree(newVTree);
  //console.log(anchorId)
  var anchor = document.getElementById(anchorId);
  //console.log(anchor)
  if (!anchor) {
    //console.log(`not anchored`)
    g_unanchoredLedger[anchorId] = newVTree;
    return null;
  } else {
    //console.log(`anchored`)
    var mapDOM = (0, _virtualMapdom.getMapFromElement)(anchor);

    if (!mapDOM) {
      //g_anchoredLedger[anchorId] = anchor
      var initNode = makeEmptyMapVDOMNode(newVTree.properties.mapOptions || {});
      (0, _virtualMapdom.createMapOnElement)(anchor, accessToken, initNode);
      anchor.vtree = initNode;
      mapDOM = (0, _virtualMapdom.getMapFromElement)(anchor);
    }

    var oldVTree = anchor.vtree;

    // console.log("OldVTree")
    // console.log(oldVTree)
    // console.log("NewVTree")
    // console.log(newVTree)

    var diffInfo = VDOM.diff(oldVTree, newVTree);

    // console.log("Diff old vs new VDOM tree...")
    // console.log(diffInfo)

    var rootElem = VDOM.patch(mapDOM, diffInfo, { render: _virtualMapdom.render, patch: _virtualMapdom.patchRecursive });

    anchor.vtree = newVTree;
    /* eslint-enable */

    return newVTree;
  }
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

function renderRawRootElem$(vtree$, accessToken) {

  var anchored$ = vtree$.map(function (vtree) {
    return diffAndPatchToElement(vtree, accessToken);
  });

  var mutation$ = _xstream2.default.create({
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
  })
  //.debug(x => console.log(`Hey`))
  .map(function () {
    var anchorId = void 0;

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

    var buffer = [];
    for (anchorId in g_unanchoredLedger) {
      //console.log(`testing unanchored`)
      //console.log(`anchorId: ${anchorId}`)
      var anchor = document.getElementById(anchorId);
      if (anchor) {
        //console.log(`saw unanchored, adding`)
        var vtree = diffAndPatchToElement(g_unanchoredLedger[anchorId], accessToken);
        delete g_unanchoredLedger[anchorId];
        buffer.push(vtree);
      }
    }
    //return xs.never()
    //
    if (buffer.length) {
      return _xstream2.default.of.apply(_xstream2.default, buffer);
    } else {
      return _xstream2.default.never();
    }
  }).flatten();

  return _xstream2.default.merge(anchored$, mutation$).filter(function (x) {
    return !!x;
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
    }).remember();

    return {
      observable: runSA ? runSA.adapt(element$, _xstreamAdapter2.default.streamSubscribe) : element$,
      select: makeElementSelector(element$, runSA),
      events: makeEventsSelector(element$, runSA)
    };
  };
}

function makeMapSelector(applied$, runSA) {
  return function chooseMap(anchorId) {
    //console.log(`choosing map: ${anchorId}`)
    var mapDOM$ = applied$.filter(function (vtree) {
      return getAnchorIdFromVTree(vtree) === anchorId;
    }).map(function (vtree) {
      var anchor = document.getElementById(anchorId);
      if (anchor) {
        return (0, _virtualMapdom.getMapFromElement)(anchor);
      } else {
        return null;
      }
    }).filter(function (x) {
      return !!x;
    }).remember();

    return {
      observable: runSA ? runSA.adapt(mapDOM$, _xstreamAdapter2.default.streamSubscribe) : mapDOM$,
      select: makeElementSelector(mapDOM$, runSA)
    };
  };
}

function makeMapDOMDriver(accessToken) {
  if (!accessToken || typeof accessToken !== 'string' && !(accessToken instanceof String)) throw new Error('MapDOMDriver requires an access token.');

  function mapDOMDriver(vtree$, runSA) {

    var adapted$ = void 0;
    if (runSA) {
      adapted$ = _xstreamAdapter2.default.adapt(vtree$, runSA.streamSubscribe).remember();
    } else {
      adapted$ = vtree$.remember();
    }

    var applied$ = renderRawRootElem$(adapted$, accessToken).remember();

    applied$.addListener(noopListener);

    return {
      observable: runSA ? runSA.adapt(applied$, _xstreamAdapter2.default.streamSubscribe) : applied$,
      chooseMap: makeMapSelector(applied$, runSA)
    };
  }

  mapDOMDriver.stremAdapter = _xstreamAdapter2.default;
  return mapDOMDriver;
}

exports.makeMapDOMDriver = makeMapDOMDriver;