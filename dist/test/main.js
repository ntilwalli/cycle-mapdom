import test from 'tape-catch';
import Rx from 'rx-dom';
import { VNode } from 'virtual-dom';
import { makeMapDOMDriver, g_mapElementRegistry as elementRegistry } from '../src/cycle-mapdom';

test("Basic functionality including instantiating VDOM after element is created", t => {
  t.equals(typeof makeMapDOMDriver, 'function', "should be a function");

  let rootEl = document.createElement("div");
  rootEl.setAttribute("id", "testId");
  let bodyEl = document.body.appendChild(rootEl);

  let testVMaps = [new VNode('map', { anchorId: "testId", centerZoom: { center: [4, 5], zoom: 5 } }), new VNode('map', { anchorId: "testId", centerZoom: { center: [4, 5], zoom: 5 } }, [new VNode('tileLayer', { tile: "testTile", attributes: { id: "testTile1" } })])];

  let map$ = Rx.Observable.interval(100).take(2).map(x => testVMaps[x]);

  let outFunc = makeMapDOMDriver(rootEl);
  t.equals(typeof outFunc, 'function', "should output a function");
  let outVal = outFunc(map$);
  t.ok(outVal.select && outVal.dispose, "should output object with valid select and dispose properties");

  setTimeout(() => {
    t.ok(rootEl.mapDOM, "should have valid mapDOM property on given element");
    t.end();
  }, 300);
});

// This is dependent test on the previous one since a map is already attached to
// the document and has not been removed
test("Allow two map streams at same time and removes anchor from registry when root element removed", t => {
  t.equals(typeof makeMapDOMDriver, 'function', "should be a function");

  let rootEl = document.createElement("div");

  rootEl.setAttribute("id", "testId2");

  let testVMaps = [new VNode('map', { anchorId: "testId2", centerZoom: { center: [4, 5], zoom: 5 } }), new VNode('map', { anchorId: "testId2", centerZoom: { center: [4, 5], zoom: 5 } }, [new VNode('tileLayer', { tile: "testTile", attributes: { id: "testTile2" } })])];

  let map$ = Rx.Observable.interval(100).take(2).map(x => testVMaps[x]);

  let outFunc = makeMapDOMDriver(rootEl);
  t.equals(typeof outFunc, 'function', "should output a function");
  let outVal = outFunc(map$);
  t.ok(outVal.select && outVal.dispose, "should output object with valid select and dispose properties");

  setTimeout(() => {
    let bodyEl = document.body.appendChild(rootEl);
  }, 150);

  setTimeout(() => {
    t.ok(rootEl.mapDOM, "should have valid mapDOM property on given element");
    document.body.removeChild(rootEl);
  }, 300);

  setTimeout(() => {
    t.notOk(elementRegistry.hasOwnProperty("testId2"), "anchor should not be registered after root element removal");
    t.end();
  }, 2000);
});

test("call to select returns a stream and select returns element based on selector", t => {
  t.plan(4);
  let rootEl = document.createElement("div");
  rootEl.setAttribute("id", "testId3");
  let bodyEl = document.body.appendChild(rootEl);

  let testVMaps = [new VNode('map', { anchorId: "testId3", centerZoom: { center: [4, 5], zoom: 5 } }), new VNode('map', { anchorId: "testId3", centerZoom: { center: [4, 5], zoom: 5 } }, [new VNode('tileLayer', { tile: "testTile", attributes: { id: "testTile3" } })])];

  let map$ = Rx.Observable.interval(100).take(2).map(x => testVMaps[x]);

  let outFunc = makeMapDOMDriver();
  let outVal = outFunc(map$);
  t.equal(typeof outVal.select, 'function', "makeMapDOMDriver should return object with select property that is a function");
  let elem$ = outVal.select("#testTile3").observable;
  t.ok(elem$.subscribe, "elem$ should have subscribe function");
  elem$.doOnNext(x => {
    x.forEach(y => {
      t.equal(y.tagName, "TILELAYER", "selected element should be tileLayer");
      t.ok(y.instance, "element should have in attached instance property");
    });
  }).publish().refCount().subscribe();
});
//# sourceMappingURL=main.js.map