'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _tapeCatch = require('tape-catch');

var _tapeCatch2 = _interopRequireDefault(_tapeCatch);

var _xstream = require('xstream');

var _xstream2 = _interopRequireDefault(_xstream);

var _delay = require('xstream/extra/delay');

var _delay2 = _interopRequireDefault(_delay);

var _virtualDom = require('virtual-dom');

var _cycleMapdom = require('../src/cycle-mapdom');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var noop = function noop() {};
var noopListener = {
  next: noop,
  error: noop,
  complete: noop
};

(0, _tapeCatch2.default)("Basic functionality including instantiating VDOM after element is created", function (t) {
  t.equals(typeof _cycleMapdom.makeMapDOMDriver === 'undefined' ? 'undefined' : _typeof(_cycleMapdom.makeMapDOMDriver), 'function', "should be a function");
  t.throws(function () {
    return (0, _cycleMapdom.makeMapDOMDriver)();
  }, 'should throw when missing accessToken');

  var rootEl = document.createElement("div");
  rootEl.setAttribute("id", "testId");
  var bodyEl = document.body.appendChild(rootEl);

  var testVMaps = [new _virtualDom.VNode('map', { anchorId: "testId", centerZoom: { center: [4, 5], zoom: 5 } }), new _virtualDom.VNode('map', { anchorId: "testId", centerZoom: { center: [4, 5], zoom: 5 } }, [new _virtualDom.VNode('tileLayer', { tile: "testTile", attributes: { id: "testTile1" } })])];

  //console.log(`testId element`)
  //console.log(document.getElementById('testId'))

  var map$ = _xstream2.default.periodic(500).take(2).map(function (x) {
    return testVMaps[x];
  }).compose((0, _delay2.default)(4));

  var outFunc = (0, _cycleMapdom.makeMapDOMDriver)("pk.eyJ1IjoibXJyZWRlYXJzIiwiYSI6IjQtVVRTZkEifQ.ef_cKBTmj8rSr7VypppZdg");
  t.equals(typeof outFunc === 'undefined' ? 'undefined' : _typeof(outFunc), 'function', "should output a function");
  var outVal = outFunc(map$);
  t.ok(outVal.chooseMap, "should output object with valid chooseMap method");
  var theMap = outVal.chooseMap('testId');
  t.ok(theMap.select, "chooseMap should output object with valid select");
  var theMapDOM = theMap.select('testId');
  t.ok(theMapDOM.select && theMapDOM.events, "select should output object with valid select and events methods");

  setTimeout(function () {
    t.ok(rootEl.mapDOM, "should have valid mapDOM property on given element");
    document.body.removeChild(rootEl);
  }, 600);

  setTimeout(function () {
    // t.notOk(rootEl.mapDOM, "map object should be removed after root element removal")
    rootEl = document.createElement("div");
    rootEl.setAttribute("id", "testId");
    bodyEl = document.body.appendChild(rootEl);
  }, 1500);

  setTimeout(function () {
    t.ok(rootEl.mapDOM, "should have valid mapDOM property on element when vtree is sent first then element attached");
    t.end();
  }, 2000);
});

(0, _tapeCatch2.default)("call to selectMap, select, events returns expected objects", function (t) {
  t.plan(9);
  var rootEl = document.createElement("div");
  rootEl.setAttribute("id", "testId3");
  var bodyEl = document.body.appendChild(rootEl);

  var testVMaps = [new _virtualDom.VNode('map', { anchorId: "testId3", centerZoom: { center: [4, 5], zoom: 5 } }), new _virtualDom.VNode('map', { anchorId: "testId3", centerZoom: { center: [4, 5], zoom: 5 } }, [new _virtualDom.VNode('tileLayer', { tile: "testTile", attributes: { id: "testTile3" } })])];

  var map$ = _xstream2.default.periodic(500).take(2).map(function (x) {
    return testVMaps[x];
  });

  var outFunc = (0, _cycleMapdom.makeMapDOMDriver)('pk.eyJ1IjoibXJyZWRlYXJzIiwiYSI6IjQtVVRTZkEifQ.ef_cKBTmj8rSr7VypppZdg');
  var outVal = outFunc(map$);
  t.equal(_typeof(outVal.chooseMap), 'function', "makeMapDOMDriver should return object with chooseMap property that is a function");
  var theMap = outVal.chooseMap('testId3');
  t.equal(_typeof(theMap.select), 'function', "chooseMap should return object with select property that is a function");
  t.ok(_typeof(theMap.observable), "chooseMap should return object with events property that is an observable");

  var theMapDOM = theMap.select("#testTile3");

  t.equal(_typeof(theMapDOM.events), 'function', "select should return object with events property that is a function");
  t.equal(_typeof(theMapDOM.select), 'function', "select should return object with select property that is a function");
  t.ok(_typeof(theMapDOM.observable), 'function', "select should return an observable property");

  var elem$ = theMapDOM.observable;
  t.ok(elem$.addListener, "elem$ should have addListener function");

  elem$.addListener({
    next: function next(x) {
      x.forEach(function (y) {
        t.equal(y.tagName, "TILELAYER", "selected element should be tileLayer");
        t.ok(y.instance, "element should have in attached instance property");
      });
    },
    error: function error() {},
    complete: function complete() {}
  });
  //.publish().refCount().subscribe()
});