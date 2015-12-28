'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.fromEvent = fromEvent;

var _rxDom = require('rx-dom');

var _rxDom2 = _interopRequireDefault(_rxDom);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var disposableCreate = _rxDom2.default.Disposable.create;
var CompositeDisposable = _rxDom2.default.CompositeDisposable;
var AnonymousObservable = _rxDom2.default.AnonymousObservable;

function createListener(_ref) {
  var element = _ref.element;
  var eventName = _ref.eventName;
  var handler = _ref.handler;
  var useCapture = _ref.useCapture;

  if (element.instance && element.instance.addEventListener) {
    //console.log(`Adding event listener: ${eventName}`)
    //console.log(element)
    element.instance.addEventListener(eventName, handler);
    return disposableCreate(function removeEventListener() {
      //console.log("eventListener disposable called: ", eventName)
      element.instance.removeEventListener(eventName, handler);
    });
  }

  throw new Error('No instance or listener found');
}

function createEventListener(_ref2) {
  var element = _ref2.element;
  var eventName = _ref2.eventName;
  var handler = _ref2.handler;

  var disposables = new CompositeDisposable();

  var toStr = Object.prototype.toString;
  var elementToString = toStr.call(element);
  //console.log(toStr.call(element))
  if (elementToString === '[object NodeList]' || elementToString === '[object HTMLCollection]') {
    for (var i = 0, len = element.length; i < len; i++) {
      disposables.add(createEventListener({
        element: element.item(i),
        eventName: eventName,
        handler: handler }));
    }
  } else if (elementToString === '[object Array]') {
    for (var i = 0, len = element.length; i < len; i++) {
      disposables.add(createEventListener({
        element: element[i],
        eventName: eventName,
        handler: handler }));
    }
  } else if (element) {
    disposables.add(createListener({ element: element, eventName: eventName, handler: handler }));
  }
  return disposables;
}

function fromEvent(element, eventName) {
  //console.log("fromEvent...")
  //console.log(element)
  return new AnonymousObservable(function subscribe(observer) {
    return createEventListener({
      element: element,
      eventName: eventName,
      handler: function handler() {
        observer.onNext(arguments[0]);
      }
    });
  }).share();
}