'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.transposeVTree = transposeVTree;

var _rxDom = require('rx-dom');

var _rxDom2 = _interopRequireDefault(_rxDom);

var _virtualDom = require('virtual-dom');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Converts a tree of VirtualNode|Observable<VirtualNode> into
 * Observable<VirtualNode>.
 */
function transposeVTree(vtree) {
  if (typeof vtree.subscribe === 'function') {
    return vtree.flatMap(transposeVTree);
  } else if (vtree.type === 'VirtualNode' && Array.isArray(vtree.children) && vtree.children.length > 0) {
    return _rxDom2.default.Observable.combineLatest(vtree.children.filter(function (x) {
      return x;
    }).map(transposeVTree), function () {
      for (var _len = arguments.length, arr = Array(_len), _key = 0; _key < _len; _key++) {
        arr[_key] = arguments[_key];
      }

      return new _virtualDom.VNode(vtree.tagName, vtree.properties, arr, vtree.key, vtree.namespace);
    });
  } else if (vtree.type === 'VirtualNode') {
    return _rxDom2.default.Observable.just(vtree);
  } else {
    throw new Error('Unhandled case in transposeVTree()');
  }
}