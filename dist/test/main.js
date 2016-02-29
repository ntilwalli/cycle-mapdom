'use strict';

var _tapeCatch = require('tape-catch');

var _tapeCatch2 = _interopRequireDefault(_tapeCatch);

var _rxDom = require('rx-dom');

var _rxDom2 = _interopRequireDefault(_rxDom);

var _virtualDom = require('virtual-dom');

var _cycleMapdom = require('../src/cycle-mapdom');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

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
    t.end();
  }, 300);
});

// This is dependent test on the previous one since a map is already attached to
// the document and has not been removed
(0, _tapeCatch2.default)("Allow two map streams at same time and removes anchor from registry when root element removed", function (t) {

  var rootEl = document.createElement("div");

  rootEl.setAttribute("id", "testId2");

  var testVMaps = [new _virtualDom.VNode('map', { anchorId: "testId2", centerZoom: { center: [4, 5], zoom: 5 } }), new _virtualDom.VNode('map', { anchorId: "testId2", centerZoom: { center: [4, 5], zoom: 5 } }, [new _virtualDom.VNode('tileLayer', { tile: "testTile", attributes: { id: "testTile2" } })])];

  var map$ = _rxDom2.default.Observable.interval(100).take(2).map(function (x) {
    return testVMaps[x];
  });

  var outFunc = (0, _cycleMapdom.makeMapDOMDriver)("pk.eyJ1IjoibXJyZWRlYXJzIiwiYSI6IjQtVVRTZkEifQ.ef_cKBTmj8rSr7VypppZdg");
  t.equals(typeof outFunc === 'undefined' ? 'undefined' : _typeof(outFunc), 'function', "should output a function");
  var outVal = outFunc(map$);
  t.ok(outVal.select && outVal.dispose, "should output object with valid select and dispose properties");

  setTimeout(function () {
    var bodyEl = document.body.appendChild(rootEl);
  }, 150);

  setTimeout(function () {
    t.ok(rootEl.mapDOM, "should have valid mapDOM property on given element");
    document.body.removeChild(rootEl);
  }, 300);

  setTimeout(function () {
    t.notOk(_cycleMapdom.g_mapElementRegistry.hasOwnProperty("testId2"), "anchor should not be registered after root element removal");
    t.end();
  }, 2000);
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
  var outVal = outFunc(map$.do(function (x) {
    return console.log('Hidy ho');
  }));
  t.equal(_typeof(outVal.select), 'function', "makeMapDOMDriver should return object with select property that is a function");
  var elem$ = outVal.select("#testTile3").observable;
  t.ok(elem$.subscribe, "elem$ should have subscribe function");
  elem$.doOnNext(function (x) {
    console.log('Hello');
    x.forEach(function (y) {
      t.equal(y.tagName, "TILELAYER", "selected element should be tileLayer");
      t.ok(y.instance, "element should have in attached instance property");
    });
  }).publish().refCount().subscribe();
});