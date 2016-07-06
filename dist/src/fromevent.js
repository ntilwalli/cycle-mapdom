'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.default = fromMapboxEvent;

var _xstream = require('xstream');

var _xstream2 = _interopRequireDefault(_xstream);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var CompositeProducer = function () {
  function CompositeProducer() {
    _classCallCheck(this, CompositeProducer);

    this._disposables = [];
  }

  _createClass(CompositeProducer, [{
    key: 'add',
    value: function add(disposer) {
      this._disposables.push(disposer);
    }
  }, {
    key: 'start',
    value: function start(listener) {
      this._disposables.forEach(function (producer) {
        return producer.start(listener);
      });
    }
  }, {
    key: 'stop',
    value: function stop() {
      this._disposables.forEach(function (producer) {
        return producer.stop();
      });
      this._disposables = [];
    }
  }]);

  return CompositeProducer;
}();

function createProducer(element, eventName, handler) {
  if (element.instance && element.instance.addEventListener) {
    //console.log(`Adding event listener: ${eventName}`)
    //console.log(element)
    return {
      start: function start() {
        element.instance.addEventListener(eventName, handler);
      },
      stop: function stop() {
        element.instance.removeEventListener(eventName, handler);
      }
    };
  }

  throw new Error('No instance or listener found');
}

function createEventProducer(element, eventName, handler) {
  var producer = new CompositeProducer();

  var toStr = Object.prototype.toString;
  var elementToString = toStr.call(element);
  //console.log(toStr.call(element))
  if (elementToString === '[object NodeList]' || elementToString === '[object HTMLCollection]') {
    for (var i = 0, len = element.length; i < len; i++) {
      producer.add(createProducer(element.item(i), eventName, handler));
    }
  } else if (elementToString === '[object Array]') {
    for (var _i = 0, _len = element.length; _i < _len; _i++) {
      producer.add(createProducer(element[_i], eventName, handler));
    }
  } else if (element) {
    producer.add(createProducer(element, eventName, handler));
  }

  return producer;
}

function fromMapboxEvent(element, eventName) {
  //console.log("fromEvent...")
  //console.log(element)

  return _xstream2.default.create({
    element: element,
    eventName: eventName,
    next: null,
    producer: null,
    start: function start(listener) {
      this.next = function next(event) {
        listener.next(event);
      };
      this.producer = createEventProducer(this.element, this.eventName, this.next);
      this.producer.start();
    },
    stop: function stop() {
      if (this.producer) this.producer.stop();
    }
  });
}