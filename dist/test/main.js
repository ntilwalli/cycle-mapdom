'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _tapeCatch = require('tape-catch');

var _tapeCatch2 = _interopRequireDefault(_tapeCatch);

var _rxDom = require('rx-dom');

var _rxDom2 = _interopRequireDefault(_rxDom);

var _virtualDom = require('virtual-dom');

var _cycleMapdom = require('../src/cycle-mapdom');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(0, _tapeCatch2.default)("Basic functionality including instantiating VDOM after element is created", function (t) {
  t.equals(typeof _cycleMapdom.makeMapDOMDriver === 'undefined' ? 'undefined' : _typeof(_cycleMapdom.makeMapDOMDriver), 'function', "should be a function");
  t.throws(function () {
    return (0, _cycleMapdom.makeMapDOMDriver)();
  }, 'should throw when missing accessToken');

  var rootEl = document.createElement("div");
  rootEl.setAttribute("id", "testId");
  var bodyEl = document.body.appendChild(rootEl);

  var testVMaps = [new _virtualDom.VNode('map', { anchorId: "testId", centerZoom: { center: [4, 5], zoom: 5 } }), new _virtualDom.VNode('map', { anchorId: "testId", centerZoom: { center: [4, 5], zoom: 5 } }, [new _virtualDom.VNode('tileLayer', { tile: "testTile", attributes: { id: "testTile1" } })])];

  var map$ = _rxDom2.default.Observable.interval(100).take(2).map(function (x) {
    return testVMaps[x];
  });

  var outFunc = (0, _cycleMapdom.makeMapDOMDriver)("pk.eyJ1IjoibXJyZWRlYXJzIiwiYSI6IjQtVVRTZkEifQ.ef_cKBTmj8rSr7VypppZdg");
  t.equals(typeof outFunc === 'undefined' ? 'undefined' : _typeof(outFunc), 'function', "should output a function");
  var outVal = outFunc(map$);
  t.ok(outVal.select && outVal.dispose, "should output object with valid select and dispose properties");

  setTimeout(function () {
    t.ok(rootEl.mapDOM, "should have valid mapDOM property on given element");
    document.body.removeChild(rootEl);
  }, 300);

  setTimeout(function () {
    t.notOk(_cycleMapdom.g_registeredElement, "anchor should not be registered after root element removal");
    rootEl = document.createElement("div");
    rootEl.setAttribute("id", "testId");
    bodyEl = document.body.appendChild(rootEl);
  }, 2000);

  setTimeout(function () {
    t.ok(rootEl.mapDOM, "should have valid mapDOM property on element 2nd time around");
    t.end();
  }, 3000);
});

(0, _tapeCatch2.default)("call to select returns a stream and select returns element based on selector", function (t) {
  t.plan(4);
  var rootEl = document.createElement("div");
  rootEl.setAttribute("id", "testId3");
  var bodyEl = document.body.appendChild(rootEl);

  var testVMaps = [new _virtualDom.VNode('map', { anchorId: "testId3", centerZoom: { center: [4, 5], zoom: 5 } }), new _virtualDom.VNode('map', { anchorId: "testId3", centerZoom: { center: [4, 5], zoom: 5 } }, [new _virtualDom.VNode('tileLayer', { tile: "testTile", attributes: { id: "testTile3" } })])];

  var map$ = _rxDom2.default.Observable.interval(100).take(2).map(function (x) {
    return testVMaps[x];
  });

  var outFunc = (0, _cycleMapdom.makeMapDOMDriver)('pk.eyJ1IjoibXJyZWRlYXJzIiwiYSI6IjQtVVRTZkEifQ.ef_cKBTmj8rSr7VypppZdg');
  var outVal = outFunc(map$);
  t.equal(_typeof(outVal.select), 'function', "makeMapDOMDriver should return object with select property that is a function");
  var elem$ = outVal.select("#testTile3").observable;
  t.ok(elem$.subscribe, "elem$ should have subscribe function");
  elem$.doOnNext(function (x) {
    x.forEach(function (y) {
      t.equal(y.tagName, "TILELAYER", "selected element should be tileLayer");
      t.ok(y.instance, "element should have in attached instance property");
    });
  }).publish().refCount().subscribe();
});