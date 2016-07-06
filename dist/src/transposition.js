'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.transposeVTree = transposeVTree;

var _xstream = require('xstream');

var _xstream2 = _interopRequireDefault(_xstream);

var _virtualDom = require('virtual-dom');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

/**
 * Converts a tree of VirtualNode|Observable<VirtualNode> into
 * Observable<VirtualNode>.
 */
function transposeVTree(vtree) {
  if (typeof vtree.addListener === 'function') {
    return vtree.map(transposeVTree).flatten();
  } else if (vtree.type === 'VirtualNode' && Array.isArray(vtree.children) && vtree.children.length > 0) {
    return _xstream2.default.combine.apply(_xstream2.default, _toConsumableArray(vtree.children.filter(function (x) {
      return x;
    }).map(transposeVTree))).map(function () {
      for (var _len = arguments.length, arr = Array(_len), _key = 0; _key < _len; _key++) {
        arr[_key] = arguments[_key];
      }

      return new _virtualDom.VNode(vtree.tagName, vtree.properties, arr, vtree.key, vtree.namespace);
    });
  } else if (vtree.type === 'VirtualNode') {
    return _xstream2.default.of(vtree);
  } else {
    throw new Error('Unhandled case in transposeVTree()');
  }
}