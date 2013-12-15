/*jshint browser: true */
/*globals define */

/*
CustomElement code near the bottom of this file is
from polymer-v0.0.20131107
*/
define(function() {
  var slice = Array.prototype.slice,
      callbackSuffix = 'Callback',
      callbackSuffixLength = callbackSuffix.length;

  /**
   * Converts an attribute like a-long-attr to aLongAttr
   * @param  {String} attrName The attribute name
   * @return {String}
   */
  function makePropName(attrName) {
    var parts = attrName.split('-');
    for (var i = 1; i < parts.length; i++) {
      parts[i] = parts[i].charAt(0).toUpperCase() + parts[i].substring(1);
    }
    return parts.join('');
  }

  /**
   * Given an attribute name, set the corresponding property
   * name on the custom element instance, if it has such a
   * property.
   * @param  {Object} instance the custom element instance.
   * @param  {String} attrName the attribute name.
   * @param  {String} attrValue The attribute value.
   */
  function setPropFromAttr(instance, attrName, attrValue) {
    var propName = makePropName(attrName);

    // Purposely using this instead of getOwnPropertyDescriptor
    // since the methos is likely on the object prototype. This
    // means it could be hazardous to use attribute IDs that
    // conflict with JS object properties.
    if (propName in instance) {
      instance[propName] = attrValue;
    }
  }

  function makePropFn(prop) {
    return function () {
      var i, ret,
          args = slice.call(arguments),
          fns = this._element.props[prop];

      for (i = 0; i < fns.length; i++) {
        ret = fns[i].apply(this, args);
      }

      // Last function wins on the return value.
      return ret;
    };
  }

  function mixFnProp(proto, prop, value, operation) {
    if (proto.hasOwnProperty(prop)) {
      var existing = proto._element.props[prop];
      if (!existing) {
        existing = proto._element.props[prop] = [proto[prop]];
        proto[prop] = makePropFn(prop);
      }
      operation = operation || 'push';
      existing[operation](value);
    } else {
      proto[prop] = value;
    }
  }

  function mix(proto, mixin) {
    if (Array.isArray(mixin)) {
      mixin.forEach(function (mixin) {
        mix(proto, mixin);
      });
      return;
    }

    Object.keys(mixin).forEach(function (key) {
      var suffixIndex,
          descriptor = Object.getOwnPropertyDescriptor(mixin, key);

      if (Array.isArray(descriptor.value)) {
        mix(proto, descriptor.value);
      } else {
        // Any property that ends in Callback, like the custom element
        // lifecycle events, can be multiplexed.
        suffixIndex = key.indexOf(callbackSuffix);
        if (suffixIndex > 0 &&
            suffixIndex === key.length - callbackSuffixLength) {
          mixFnProp(proto, key, descriptor.value);
        } else {
          Object.defineProperty(proto, key, descriptor);
        }
      }
    });
  }

  /**
   * Main module export. These methods are visible to
   * any module.
   */
  var element = {
    /**
     * The AMD loader plugin API. Called by an AMD loader
     * to handle 'element!' resources.
     * @param  {String} id     module ID to load.
     * @param  {Function} req  context-specific `require` function.
     * @param  {Function} onload function to call once loading is complete.
     * @param  {Object} config config from the loader. Normally just has
     * config.isBuild if in a build scenario.
     */
    load: function (id, req, onload, config) {
      // Normal dependency request.
      req([id], function (mod) {
        // For builds do nothing else. Also if no module export or
        // it is a function because the module already called
        // document.register itself, then do not bother with the
        // other work.
        if (config.isBuild || !mod || typeof mod === 'function') {
          return onload();
        }

        // Create the prototype for the custom element.
        // Allow the module to be an array of mixins.
        // If it is an array, then mix them all in to the
        // prototype.
        var proto = Object.create(HTMLElement.prototype);

        // Define a property to hold all the element-specific information
        Object.defineProperty(proto, '_element', {
          enumerable: false,
          configurable: false,
          writable: false,
          value: {}
        });
        proto._element.props = {};

        mix(proto, mod);

        // Wire attributes to this element's custom/getter setters.
        // Because of the 'unshift' use, this will actually execute
        // before the templateCreatedCallback, which is good. The
        // exterior API should set up the internal state before
        // other parts of createdCallback run.
        mixFnProp(proto, 'createdCallback', function attrCreated() {
          var i, item,
              attrs = this.attributes;

          for (i = 0; i < attrs.length; i++) {
            item = attrs.item(i);
            setPropFromAttr(this, item.nodeName, item.value);
          }
        }, 'unshift');

        // Listen for attribute changed calls, and just trigger getter/setter
        // calling if matching property. Make sure it is the first one in
        // the listener set.
        mixFnProp(proto, 'attributeChangedCallback',
        function attrChanged(name, oldValue, newValue) {
            // Only called if value has changed, so no need to check
            // oldValue !== newValue
            setPropFromAttr(this, name, newValue);
        }, 'unshift');

        onload(document.register(id, {
          prototype: proto
        }));
      });
    }
  };

  return element;
});
