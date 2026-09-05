/* @ds-bundle: {"format":4,"namespace":"NIKOLASSDesignSystem_1f5ba6","components":[{"name":"AsciiDivider","sourcePath":"components/brand/AsciiDivider.jsx"},{"name":"Caret","sourcePath":"components/brand/Caret.jsx"},{"name":"Halftone","sourcePath":"components/brand/Halftone.jsx"},{"name":"Highlighter","sourcePath":"components/brand/Highlighter.jsx"},{"name":"PixlGlyph","sourcePath":"components/brand/PixlGlyph.jsx"},{"name":"Stamp","sourcePath":"components/brand/Stamp.jsx"},{"name":"TechMarker","sourcePath":"components/brand/TechMarker.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"MetaPair","sourcePath":"components/core/MetaPair.jsx"},{"name":"Panel","sourcePath":"components/core/Panel.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"DataTable","sourcePath":"components/data/DataTable.jsx"},{"name":"EntryCard","sourcePath":"components/data/EntryCard.jsx"},{"name":"MetaStrip","sourcePath":"components/data/MetaStrip.jsx"}],"sourceHashes":{"components/brand/AsciiDivider.jsx":"0339d4b5d793","components/brand/Caret.jsx":"7668b0e22c87","components/brand/Halftone.jsx":"8e18568248df","components/brand/Highlighter.jsx":"b0afdde4d83d","components/brand/PixlGlyph.jsx":"7eaa1446a73b","components/brand/Stamp.jsx":"e7ea58af85bb","components/brand/TechMarker.jsx":"96347c7af9ad","components/core/Button.jsx":"5592f53cd95f","components/core/Input.jsx":"cea5c69cc0c8","components/core/MetaPair.jsx":"8317191ee4b6","components/core/Panel.jsx":"2067edd9893a","components/core/Tag.jsx":"92a4c02a6454","components/data/DataTable.jsx":"8c4fcd73fe6d","components/data/EntryCard.jsx":"9dc455d8aac9","components/data/MetaStrip.jsx":"50c32dba40a8","ui_kits/portfolio/App.jsx":"26b048a9925c","ui_kits/portfolio/ArchiveView.jsx":"3cf5e0272be4","ui_kits/portfolio/Frame.jsx":"9ff9bdc70e8a","ui_kits/portfolio/IndexView.jsx":"308ca2d983f7","ui_kits/portfolio/Sidebar.jsx":"668c91d64e59","ui_kits/portfolio/Views.jsx":"fc73ff50f857","ui_kits/portfolio/data.jsx":"c929bc19df60"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.NIKOLASSDesignSystem_1f5ba6 = window.NIKOLASSDesignSystem_1f5ba6 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/AsciiDivider.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Repeating ASCII section break. Page furniture, not decoration. */
function AsciiDivider({
  glyph = '/',
  color = 'var(--ink-3)',
  size = 12,
  gap = 6,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({}, rest, {
    "aria-hidden": "true",
    style: {
      fontFamily: 'var(--ff-mono)',
      fontSize: size,
      letterSpacing: `${gap}px`,
      color,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      userSelect: 'none',
      lineHeight: 1.6,
      ...style
    }
  }), glyph.repeat(160));
}
Object.assign(__ds_scope, { AsciiDivider });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/AsciiDivider.jsx", error: String((e && e.message) || e) }); }

// components/brand/Caret.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Blinking █ terminal caret. steps(2), 1Hz — hard blink, never a fade. */
function Caret({
  color = 'var(--ink-0)',
  width = 8,
  height = 14,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({}, rest, {
    style: {
      display: 'inline-block',
      width,
      height,
      background: color,
      verticalAlign: -2,
      animation: 'nk-caret-blink 1s steps(2) infinite',
      ...style
    }
  }));
}
Object.assign(__ds_scope, { Caret });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Caret.jsx", error: String((e && e.message) || e) }); }

// components/brand/Halftone.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Dithered image block. Photographic content in this system is halftoned, never glossy. */
function Halftone({
  width = '100%',
  height = 120,
  density = 'medium',
  label,
  src,
  style,
  ...rest
}) {
  const sizes = {
    low: '10px 10px',
    medium: '6px 6px',
    high: '4px 4px'
  };
  return /*#__PURE__*/React.createElement("div", _extends({}, rest, {
    style: {
      position: 'relative',
      width,
      height,
      border: '1px solid var(--ink-0)',
      overflow: 'hidden',
      background: 'var(--paper-1)',
      ...style
    }
  }), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: "",
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      filter: 'grayscale(1) contrast(1.6)'
    }
  }) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      backgroundImage: `radial-gradient(circle at 30% 40%, var(--ink-0) 1.5px, transparent 2px),
                          radial-gradient(circle at 70% 60%, var(--ink-0) 1.5px, transparent 2px),
                          radial-gradient(circle at 50% 30%, var(--ink-0) 2px, transparent 2.5px)`,
      backgroundSize: `${sizes[density]}, 8px 8px, 10px 10px`,
      opacity: src ? 0.55 : 0.85,
      mixBlendMode: src ? 'multiply' : 'normal'
    }
  }), label ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      bottom: 4,
      left: 6,
      fontSize: 9,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: 'var(--paper-0)',
      background: 'var(--ink-0)',
      padding: '1px 5px'
    }
  }, label) : null);
}
Object.assign(__ds_scope, { Halftone });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Halftone.jsx", error: String((e && e.message) || e) }); }

// components/brand/Highlighter.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Acid marker pass over inline text. Flat lime with explicit ink so it survives dark mode. */
function Highlighter({
  children,
  color = 'var(--lime)',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({}, rest, {
    style: {
      background: color,
      color: 'var(--ink-0)',
      padding: '1px 3px',
      fontWeight: 700,
      boxDecorationBreak: 'clone',
      WebkitBoxDecorationBreak: 'clone',
      ...style
    }
  }), children);
}
Object.assign(__ds_scope, { Highlighter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Highlighter.jsx", error: String((e && e.message) || e) }); }

// components/brand/PixlGlyph.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** PIXL — the brand mascot. 11×12 pixel silhouette, drawn crisp, optionally alive. */
function PixlGlyph({
  size = 22,
  color = 'var(--ink-0)',
  live = true,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, rest, {
    viewBox: "0 0 11 12",
    shapeRendering: "crispEdges",
    width: size,
    height: Math.round(size * 12 / 11),
    style: {
      color,
      display: 'block',
      ...style
    },
    className: live ? 'pixl-live' : undefined
  }), /*#__PURE__*/React.createElement("g", {
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "0",
    width: "5",
    height: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "2",
    width: "1",
    height: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "5",
    y: "2",
    width: "1",
    height: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "7",
    y: "2",
    width: "1",
    height: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "5",
    height: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "4",
    width: "7",
    height: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "1",
    y: "5",
    width: "2",
    height: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "8",
    y: "5",
    width: "2",
    height: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "7",
    width: "1",
    height: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "8",
    y: "7",
    width: "1",
    height: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "4",
    y: "5",
    width: "3",
    height: "4"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "9",
    width: "5",
    height: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "10",
    width: "2",
    height: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "6",
    y: "10",
    width: "2",
    height: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "11",
    width: "3",
    height: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "6",
    y: "11",
    width: "3",
    height: "1"
  })), live ? /*#__PURE__*/React.createElement("g", {
    className: "pixl-blink",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "4",
    y: "2",
    width: "1",
    height: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "6",
    y: "2",
    width: "1",
    height: "1"
  })) : null);
}
Object.assign(__ds_scope, { PixlGlyph });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/PixlGlyph.jsx", error: String((e && e.message) || e) }); }

// components/brand/Stamp.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** [STAMP] — bracketed code label. The brand's most-used mark. */
function Stamp({
  children,
  color = 'var(--ink-0)',
  bg = 'transparent',
  size = 'md',
  style,
  ...rest
}) {
  const sizes = {
    sm: {
      fontSize: 9,
      padding: '1px 5px'
    },
    md: {
      fontSize: 11,
      padding: '2px 7px'
    }
  };
  return /*#__PURE__*/React.createElement("span", _extends({}, rest, {
    style: {
      fontFamily: 'var(--ff-mono)',
      letterSpacing: 'var(--tr-wider)',
      textTransform: 'uppercase',
      border: `1px solid ${color}`,
      color,
      background: bg,
      display: 'inline-block',
      lineHeight: 1.2,
      borderRadius: 0,
      ...sizes[size],
      ...style
    }
  }), children);
}
Object.assign(__ds_scope, { Stamp });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Stamp.jsx", error: String((e && e.message) || e) }); }

// components/brand/TechMarker.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Absolutely-positioned annotation box, FLAME³ poster style: [FL33], [PX333]. */
function TechMarker({
  children,
  top,
  left,
  right,
  bottom,
  color = 'var(--cobalt)',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({}, rest, {
    style: {
      position: 'absolute',
      top,
      left,
      right,
      bottom,
      fontFamily: 'var(--ff-mono)',
      fontSize: 9,
      letterSpacing: '0.15em',
      textTransform: 'uppercase',
      color,
      border: `1.5px solid ${color}`,
      padding: '2px 6px',
      background: 'transparent',
      borderRadius: 0,
      ...style
    }
  }), children);
}
Object.assign(__ds_scope, { TechMarker });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/TechMarker.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Stamp button. Square, 1px ink border, presses down into the page. */
function Button({
  children,
  kind = 'secondary',
  disabled = false,
  onClick,
  style,
  ...rest
}) {
  const [pressed, setPressed] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const base = {
    fontFamily: 'var(--ff-mono)',
    fontSize: 12,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    padding: '9px 16px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: '1px solid var(--ink-0)',
    color: 'var(--ink-0)',
    background: 'transparent',
    borderRadius: 0,
    transition: 'transform 80ms linear, background 100ms linear, color 100ms linear, border-color 100ms linear'
  };
  const kinds = {
    primary: {
      background: 'var(--ink-0)',
      color: 'var(--paper-0)'
    },
    secondary: {},
    acid: {
      background: 'var(--lime)',
      borderColor: 'var(--lime)',
      color: 'var(--ink-0)',
      fontWeight: 700
    },
    pink: {
      background: 'var(--vermillion)',
      borderColor: 'var(--vermillion)',
      color: '#fff',
      fontWeight: 700
    },
    cobalt: {
      background: 'transparent',
      borderColor: 'var(--cobalt)',
      color: 'var(--cobalt)'
    },
    ghost: {
      border: '1px dashed var(--ink-3)',
      color: 'var(--ink-3)'
    }
  };
  const state = disabled ? {
    color: 'var(--fg-disabled)',
    borderColor: 'var(--ink-5)',
    background: 'transparent'
  } : {
    transform: pressed ? 'translate(2px, 2px)' : hover ? 'translate(1px, 1px)' : 'none'
  };
  return /*#__PURE__*/React.createElement("button", _extends({}, rest, {
    disabled: disabled,
    onClick: disabled ? undefined : onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPressed(false);
    },
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
    style: {
      ...base,
      ...kinds[kind],
      ...state,
      ...style
    }
  }), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Labelled text field. Focus = 3px acid ring. Error = terminal red. */
function Input({
  label,
  badge,
  helper,
  error,
  value,
  defaultValue,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  style,
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  const tone = error ? 'var(--term-red)' : 'var(--ink-0)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 9,
      letterSpacing: 'var(--tr-widest)',
      textTransform: 'uppercase',
      color: error ? 'var(--term-red)' : 'var(--ink-3)',
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", null, label), badge ? /*#__PURE__*/React.createElement("span", null, badge) : null) : null, /*#__PURE__*/React.createElement("input", _extends({}, rest, {
    type: type,
    value: value,
    defaultValue: defaultValue,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      fontFamily: 'var(--ff-mono)',
      fontSize: 13,
      padding: '9px 10px',
      border: `1px solid ${disabled ? 'var(--ink-5)' : tone}`,
      background: disabled ? 'var(--paper-2)' : focused ? 'var(--paper-1)' : 'var(--paper-0)',
      color: disabled ? 'var(--fg-disabled)' : 'var(--ink-0)',
      borderRadius: 0,
      outline: 'none',
      width: '100%',
      boxSizing: 'border-box',
      boxShadow: focused && !error ? '0 0 0 3px var(--acid)' : 'none'
    }
  })), helper || error ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: error ? 'var(--term-red)' : 'var(--ink-3)',
      marginTop: 2
    }
  }, error || helper) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/MetaPair.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Label-left / value-right row on a dotted hairline. The atom of every data panel. */
function MetaPair({
  label,
  value,
  sub,
  labelWidth = 90,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({}, rest, {
    style: {
      display: 'grid',
      gridTemplateColumns: `${labelWidth}px 1fr`,
      gap: 12,
      padding: '4px 0',
      borderBottom: '1px dotted var(--ink-5)',
      ...style
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--ink-0)'
    }
  }, value, sub ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--ink-3)',
      marginLeft: 8
    }
  }, sub) : null));
}
Object.assign(__ds_scope, { MetaPair });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/MetaPair.jsx", error: String((e && e.message) || e) }); }

// components/core/Panel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Bordered panel with a header strip. The system's card: bordered, not shadowed. */
function Panel({
  title,
  code,
  children,
  stamp = false,
  tone = 'paper',
  style,
  ...rest
}) {
  const bg = tone === 'recessed' ? 'var(--paper-2)' : 'var(--paper-1)';
  return /*#__PURE__*/React.createElement("div", _extends({}, rest, {
    style: {
      border: '1px solid var(--ink-0)',
      background: bg,
      borderRadius: 0,
      boxShadow: stamp ? 'var(--sh-stamp)' : 'none',
      ...style
    }
  }), title || code ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 12,
      padding: '6px 10px',
      background: 'var(--paper-2)',
      borderBottom: '1px solid var(--ink-0)',
      fontSize: 9,
      letterSpacing: 'var(--tr-widest)',
      textTransform: 'uppercase'
    }
  }, /*#__PURE__*/React.createElement("span", null, title), code ? /*#__PURE__*/React.createElement("span", null, code) : null) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12
    }
  }, children));
}
Object.assign(__ds_scope, { Panel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Panel.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Category tag / status pill. The only component in the system with a radius (2px). */
function Tag({
  children,
  variant = 'outline',
  color,
  dot = false,
  style,
  ...rest
}) {
  const variants = {
    outline: {},
    solid: {
      background: 'var(--ink-0)',
      color: 'var(--paper-0)',
      borderColor: 'var(--ink-0)'
    },
    acid: {
      background: 'var(--lime)',
      borderColor: 'var(--lime)',
      color: 'var(--ink-0)',
      fontWeight: 700
    },
    dashed: {
      borderStyle: 'dashed',
      color: 'var(--ink-3)'
    }
  };
  const tone = color ? {
    color,
    borderColor: color
  } : null;
  return /*#__PURE__*/React.createElement("span", _extends({}, rest, {
    style: {
      fontFamily: 'var(--ff-mono)',
      fontSize: 11,
      letterSpacing: 'var(--tr-wider)',
      textTransform: 'uppercase',
      padding: '3px 8px',
      border: '1px solid var(--ink-0)',
      color: 'var(--ink-0)',
      background: 'transparent',
      borderRadius: 'var(--r-2)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      lineHeight: 1.3,
      ...variants[variant],
      ...tone,
      ...style
    }
  }), dot ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'currentColor',
      display: 'inline-block'
    }
  }) : null, children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/data/DataTable.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** File-list table. Hairline rows, tabular numerals, acid row hover. */
function DataTable({
  columns = [],
  rows = [],
  onRowClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(-1);
  return /*#__PURE__*/React.createElement("table", _extends({}, rest, {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 13,
      fontFamily: 'var(--ff-mono)',
      ...style
    }
  }), /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    style: {
      fontSize: 9,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      borderBottom: '1px solid var(--ink-0)',
      padding: '6px 8px',
      textAlign: c.align || 'left',
      fontWeight: 500
    }
  }, c.label)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: r.id ?? i,
    onClick: onRowClick ? () => onRowClick(r) : undefined,
    onMouseEnter: () => setHover(i),
    onMouseLeave: () => setHover(-1),
    style: {
      cursor: onRowClick ? 'pointer' : 'default',
      background: hover === i ? 'rgba(212,230,53,0.5)' : 'transparent'
    }
  }, columns.map(c => /*#__PURE__*/React.createElement("td", {
    key: c.key,
    style: {
      padding: '8px 8px',
      borderBottom: '1px dotted var(--ink-5)',
      textAlign: c.align || 'left',
      color: c.strong ? 'var(--ink-0)' : 'var(--ink-2)',
      fontWeight: c.strong ? 700 : 400,
      fontVariantNumeric: c.align === 'right' ? 'tabular-nums' : 'normal'
    }
  }, r[c.key]))))));
}
Object.assign(__ds_scope, { DataTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/DataTable.jsx", error: String((e && e.message) || e) }); }

// components/data/EntryCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Catalogue entry card: header strip, optional halftone thumb, title, dotted meta row. */
function EntryCard({
  kind = 'ENTRY',
  code,
  title,
  excerpt,
  meta = [],
  thumb = false,
  stamp = false,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", _extends({}, rest, {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    style: {
      border: '1px solid var(--ink-0)',
      background: 'var(--paper-1)',
      position: 'relative',
      cursor: onClick ? 'pointer' : 'default',
      borderRadius: 0,
      transition: 'transform 90ms linear, box-shadow 90ms linear',
      transform: press ? 'translate(2px, 2px)' : hover ? 'translate(-1px, -1px)' : 'none',
      boxShadow: press ? 'none' : stamp ? hover ? '5px 5px 0 0 var(--ink-0)' : 'var(--sh-stamp)' : hover ? 'var(--sh-stamp)' : 'none',
      ...style
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '5px 8px',
      borderBottom: '1px solid var(--ink-0)',
      fontSize: 9,
      letterSpacing: 'var(--tr-widest)',
      textTransform: 'uppercase',
      transition: 'background 100ms linear, color 100ms linear',
      background: hover ? 'var(--ink-0)' : 'var(--paper-2)',
      color: hover ? 'var(--paper-0)' : 'var(--ink-0)'
    }
  }, /*#__PURE__*/React.createElement("span", null, kind), code ? /*#__PURE__*/React.createElement("span", null, code) : null), thumb ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--ink-0)',
      height: 60,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--paper-0)',
      fontFamily: 'var(--ff-pixel)',
      fontSize: 18,
      position: 'relative',
      overflow: 'hidden'
    }
  }, "\u2593\u2593\u2591\u2591 HALFTONE \u2591\u2591\u2593\u2593") : null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: thumb ? '10px 12px' : '14px 12px 10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--ff-mono)',
      fontWeight: 700,
      fontSize: 14,
      lineHeight: 1.25,
      margin: '0 0 4px',
      color: hover ? 'var(--cobalt)' : 'var(--ink-0)',
      transition: 'color 100ms linear'
    }
  }, title), excerpt ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--ink-2)'
    }
  }, excerpt) : null, meta.length ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--ink-3)',
      display: 'flex',
      gap: 10,
      borderTop: '1px dotted var(--ink-5)',
      paddingTop: 5,
      marginTop: 6
    }
  }, meta.map((m, i) => /*#__PURE__*/React.createElement("span", {
    key: i
  }, i ? '· ' : '', m))) : null), onClick ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: 10,
      bottom: 10,
      fontFamily: 'var(--ff-mono)',
      fontSize: 11,
      letterSpacing: '0.15em',
      color: 'var(--lime)',
      background: 'var(--ink-0)',
      padding: '2px 6px',
      opacity: hover ? 1 : 0,
      transform: hover ? 'translateX(0)' : 'translateX(-4px)',
      transition: 'opacity 100ms linear, transform 120ms steps(3)'
    }
  }, "OPEN \u25B8") : null);
}
Object.assign(__ds_scope, { EntryCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/EntryCard.jsx", error: String((e && e.message) || e) }); }

// components/data/MetaStrip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Edge-to-edge ruled band of ambient data across the top of a page. */
function MetaStrip({
  items = [],
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({}, rest, {
    style: {
      display: 'grid',
      gridTemplateColumns: `repeat(${items.length || 1}, 1fr)`,
      borderBottom: '1px solid var(--ink-0)',
      background: 'var(--paper-0)',
      ...style
    }
  }), items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: '8px 12px',
      borderRight: i < items.length - 1 ? '1px solid var(--ink-0)' : 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      fontSize: 10,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)'
    }
  }, it.icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--ink-0)'
    }
  }, it.icon) : null, /*#__PURE__*/React.createElement("span", null, it.key)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      marginTop: 2,
      color: 'var(--ink-0)'
    }
  }, it.value), it.sub ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--ink-3)'
    }
  }, it.sub) : null)));
}
Object.assign(__ds_scope, { MetaStrip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/MetaStrip.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portfolio/App.jsx
try { (() => {
// App.jsx — root shell: chrome + sidebar + view switching + theme toggle.

const {
  useState,
  useEffect
} = React;
function App() {
  const [view, setView] = useState('index');
  const [activeId, setActiveId] = useState('lib-d');
  const [activeTag, setActiveTag] = useState(null);
  const [search, setSearch] = useState('');
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    return () => document.documentElement.removeAttribute('data-theme');
  }, [theme]);
  const setEntry = id => {
    setActiveId(id);
    setView('index');
  };
  const entry = ENTRIES.find(e => e.id === activeId);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      background: 'var(--paper-0)',
      color: 'var(--ink-0)',
      fontFamily: 'var(--ff-mono)',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement(WeatherBand, null), /*#__PURE__*/React.createElement(TopBar, {
    view: view,
    setView: setView,
    search: search,
    setSearch: setSearch
  }), /*#__PURE__*/React.createElement(Tagline, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '300px 1fr',
      flex: 1,
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement(Sidebar, {
    activeId: activeId,
    setEntry: setEntry,
    activeTag: activeTag,
    setActiveTag: setActiveTag
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      minHeight: 0,
      overflowY: 'auto'
    }
  }, view === 'index' && /*#__PURE__*/React.createElement(IndexView, {
    entry: entry
  }), view === 'archive' && /*#__PURE__*/React.createElement(ArchiveView, {
    setEntry: setEntry
  }), view === 'journal' && /*#__PURE__*/React.createElement(JournalView, null), view === 'about' && /*#__PURE__*/React.createElement(AboutView, null))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setTheme(theme === 'light' ? 'dark' : 'light'),
    style: {
      position: 'fixed',
      bottom: 64,
      right: 18,
      zIndex: 50,
      fontFamily: 'var(--ff-mono)',
      fontSize: 10,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      padding: '6px 10px',
      border: '1px solid var(--ink-0)',
      background: 'var(--paper-1)',
      color: 'var(--ink-0)',
      cursor: 'pointer',
      borderRadius: 0,
      boxShadow: 'var(--sh-stamp)'
    }
  }, theme === 'light' ? '◐ DARK' : '◑ LIGHT'), /*#__PURE__*/React.createElement(FooterTerminal, null));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portfolio/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portfolio/ArchiveView.jsx
try { (() => {
// ArchiveView.jsx — the file-list table of everything.

const {
  DataTable
} = window.NIKOLASSDesignSystem_1f5ba6;
const COLUMNS = [{
  key: 'date',
  label: 'DATE'
}, {
  key: 'title',
  label: 'TITLE',
  strong: true
}, {
  key: 'kind',
  label: 'TYPE'
}, {
  key: 'price',
  label: 'SIZE',
  align: 'right'
}, {
  key: 'n',
  label: 'N°',
  align: 'right'
}];
function ArchiveView({
  setEntry
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '28px 36px 60px',
      background: 'var(--paper-0)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      borderBottom: '1px solid var(--ink-0)',
      paddingBottom: 8,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--ff-display)',
      fontSize: 44,
      fontWeight: 700,
      letterSpacing: '-0.025em',
      textTransform: 'uppercase',
      margin: 0
    }
  }, "Archive"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)'
    }
  }, ENTRIES.length, " ENTRIES // SORTED BY DATE")), /*#__PURE__*/React.createElement(DataTable, {
    columns: COLUMNS,
    rows: ENTRIES,
    onRowClick: r => setEntry(r.id)
  }));
}
Object.assign(window, {
  ArchiveView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portfolio/ArchiveView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portfolio/Frame.jsx
try { (() => {
// Frame.jsx — site chrome: weather band, top nav, tagline, footer terminal.

const {
  MetaStrip,
  PixlGlyph,
  Caret
} = window.NIKOLASSDesignSystem_1f5ba6;
function WeatherBand() {
  return /*#__PURE__*/React.createElement(MetaStrip, {
    items: WEATHER
  });
}
function TopBar({
  view,
  setView,
  search,
  setSearch
}) {
  const navLink = (key, label) => /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      setView(key);
    },
    style: {
      textDecoration: view === key ? 'none' : 'underline',
      textUnderlineOffset: 3,
      background: view === key ? 'var(--acid)' : 'transparent',
      color: 'var(--ink-0)',
      padding: '2px 6px'
    }
  }, label);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '120px 1fr auto',
      alignItems: 'center',
      padding: '10px 14px',
      borderBottom: '1px solid var(--ink-0)',
      background: 'var(--paper-0)'
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      setView('index');
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      textDecoration: 'none',
      color: 'var(--ink-0)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 22,
      height: 24,
      border: '1px solid var(--ink-0)',
      background: 'var(--paper-1)'
    }
  }, /*#__PURE__*/React.createElement(PixlGlyph, {
    size: 14
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      letterSpacing: '0.15em',
      fontSize: 13
    }
  }, "NIKOLASS")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      paddingLeft: 24
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--ink-3)'
    }
  }, "\u2315"), /*#__PURE__*/React.createElement("input", {
    value: search,
    onChange: e => setSearch(e.target.value),
    placeholder: "Rechercher",
    style: {
      fontFamily: 'var(--ff-mono)',
      fontSize: 12,
      padding: '4px 6px',
      border: 'none',
      borderBottom: '1px solid var(--ink-3)',
      background: 'transparent',
      outline: 'none',
      width: 220,
      color: 'var(--ink-0)'
    }
  })), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      gap: 14,
      fontFamily: 'var(--ff-mono)',
      fontSize: 12,
      letterSpacing: '0.18em',
      textTransform: 'uppercase'
    }
  }, navLink('index', 'Index'), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--ink-3)'
    }
  }, "\xB7"), navLink('archive', 'Archive'), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--ink-3)'
    }
  }, "\xB7"), navLink('journal', 'Journal'), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--ink-3)'
    }
  }, "\xB7"), navLink('about', 'About')));
}
function Tagline() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '7px 14px',
      fontSize: 10,
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      borderBottom: '1px solid var(--ink-0)',
      color: 'var(--ink-3)',
      background: 'var(--paper-1)'
    }
  }, "NI V\xC9RITABLEMENT UN PORTFOLIO, NI VRAIMENT UN JOURNAL, ENCORE MOINS UN MANIFESTE. \u25C7 NIKOLASS \xB7 2025");
}
function FooterTerminal() {
  const letters = 'SOMEWHERE'.split('');
  const div = /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      background: 'var(--ink-3)',
      alignSelf: 'stretch'
    }
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--ink-0)',
      color: 'var(--paper-0)',
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      fontFamily: 'var(--ff-mono)',
      fontSize: 11,
      letterSpacing: '0.2em',
      borderTop: '1px solid var(--ink-0)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--acid)'
    }
  }, "\u25BA"), /*#__PURE__*/React.createElement("span", null, "\u25AE\u25AE"), div, /*#__PURE__*/React.createElement("span", null, "00:00"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--ink-5)'
    }
  }, "/ 12:01"), div, /*#__PURE__*/React.createElement("span", null, "\u25D0"), /*#__PURE__*/React.createElement("span", null, "\u21BB"), /*#__PURE__*/React.createElement("span", null, "\u25CF"), div, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, letters.map((l, i) => /*#__PURE__*/React.createElement("span", {
    key: i
  }, l))), div, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--acid)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(PixlGlyph, {
    size: 13,
    color: "var(--acid)"
  }), /*#__PURE__*/React.createElement("span", null, "PIXL")), /*#__PURE__*/React.createElement(Caret, {
    color: "var(--acid)"
  }));
}
Object.assign(window, {
  WeatherBand,
  TopBar,
  Tagline,
  FooterTerminal
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portfolio/Frame.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portfolio/IndexView.jsx
try { (() => {
// IndexView.jsx — the homepage: display title, metadata dispersion, figure, actions.

const {
  Stamp,
  TechMarker,
  MetaPair,
  Halftone,
  Highlighter,
  Button
} = window.NIKOLASSDesignSystem_1f5ba6;
function IndexView({
  entry
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '28px 36px 60px',
      position: 'relative',
      background: 'var(--paper-0)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 14,
      right: 24,
      fontSize: 9,
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)'
    }
  }, "REC.", entry.n, " // ", entry.kind, " // V.01"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 18,
      alignItems: 'center',
      borderBottom: '1px solid var(--ink-0)',
      paddingBottom: 6,
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      letterSpacing: '0.25em',
      textTransform: 'uppercase'
    }
  }, "PARTAGE"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 10,
      color: 'var(--ink-3)',
      fontSize: 13
    }
  }, ['✕', 'ƒ', 'g', 'in', 't', 'p', 'r', 'w', 'x', '◯'].map((g, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "uline"
  }, g))), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 9,
      letterSpacing: '0.2em',
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pulse-dot",
    style: {
      display: 'inline-block',
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: 'var(--kelly)'
    }
  }), "LIVE")), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--ff-display)',
      fontWeight: 700,
      fontSize: 68,
      lineHeight: 0.96,
      letterSpacing: '-0.025em',
      textTransform: 'uppercase',
      margin: 0,
      color: 'var(--ink-0)',
      maxWidth: 760
    }
  }, entry.title, " \u2014 ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--cobalt)'
    }
  }, "Appel \xE0 Contribution")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 28,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '0 36px'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(MetaPair, {
    label: "DATE",
    value: entry.date,
    sub: "\u25C7"
  }), /*#__PURE__*/React.createElement(MetaPair, {
    label: "AUTEUR",
    value: "COLLECTIF SILO"
  }), /*#__PURE__*/React.createElement(MetaPair, {
    label: "DUR\xC9E",
    value: "6:11",
    sub: "\u25CF"
  }), /*#__PURE__*/React.createElement(MetaPair, {
    label: "COMM.",
    value: "1"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(MetaPair, {
    label: "OBJET",
    value: "APPEL \xC0 CONTRIBUTIONS"
  }), /*#__PURE__*/React.createElement(MetaPair, {
    label: "NUM\xC9RO",
    value: entry.id.toUpperCase()
  }), /*#__PURE__*/React.createElement(MetaPair, {
    label: "DEADLINE",
    value: "16 AVRIL 2019"
  }), /*#__PURE__*/React.createElement(MetaPair, {
    label: "ENVOI",
    value: "archive@nikolass.fr"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 18,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Stamp, null, entry.kind), /*#__PURE__*/React.createElement(Stamp, {
    color: "var(--cobalt)"
  }, "DISPERSION"), /*#__PURE__*/React.createElement(Stamp, null, "\xC9DITION"), /*#__PURE__*/React.createElement(Stamp, {
    color: "var(--kelly)"
  }, "2025"), /*#__PURE__*/React.createElement("span", {
    className: "flicker",
    style: {
      display: 'inline-block',
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement(Stamp, {
    bg: "var(--vermillion)",
    color: "#fff"
  }, "APPEL \xC0 CONTRIBUTIONS"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 44,
      paddingTop: 20,
      borderTop: '1px solid var(--ink-0)',
      display: 'grid',
      gridTemplateColumns: '160px 1fr',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)'
    }
  }, "A, B, C,", /*#__PURE__*/React.createElement("br", null), "DISPERSION!"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 16,
      marginBottom: 4
    }
  }, "Nom f\xE9minin"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--ff-serif)',
      fontStyle: 'italic',
      fontSize: 24,
      lineHeight: 1.25
    }
  }, /*#__PURE__*/React.createElement(Highlighter, null, "dispergere"), " \xAB r\xE9pandre \xE7\xE0 et l\xE0, \xE9parpiller. \xBB"), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 14,
      fontSize: 13,
      color: 'var(--ink-2)',
      lineHeight: 1.55,
      maxWidth: 620
    }
  }, "I keep notes here. Some entries are essays, some are inventories, some are receipts. The point is to ", /*#__PURE__*/React.createElement(Highlighter, null, "scatter"), " the work in public so it stays alive while it settles. ", /*#__PURE__*/React.createElement(Highlighter, null, "If you find a thread, pull it.")))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 36,
      position: 'relative',
      border: '1px solid var(--ink-0)',
      height: 240,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(Halftone, {
    height: 240,
    density: "medium",
    label: "FIG.04 // FLAME\xB3 // 2025.03.22"
  }), /*#__PURE__*/React.createElement("div", {
    className: "scan-bar"
  }), /*#__PURE__*/React.createElement(TechMarker, {
    top: 20,
    left: 120
  }, "[FL33]"), /*#__PURE__*/React.createElement(TechMarker, {
    top: 70,
    right: 40,
    color: "var(--vermillion)"
  }, "[PX333]"), /*#__PURE__*/React.createElement(TechMarker, {
    bottom: 50,
    left: 300,
    color: "var(--kelly)"
  }, "[WD03]")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement(Button, {
    kind: "primary"
  }, "[READ ENTRY]"), /*#__PURE__*/React.createElement(Button, null, "+ ADD TO LIST"), /*#__PURE__*/React.createElement(Button, {
    kind: "pink"
  }, "\u2191 SUBMIT"), /*#__PURE__*/React.createElement(Button, {
    kind: "cobalt"
  }, "\u2192 EXTERNAL"), /*#__PURE__*/React.createElement(Button, {
    kind: "ghost"
  }, "cancel \xD7")));
}
Object.assign(window, {
  IndexView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portfolio/IndexView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portfolio/Sidebar.jsx
try { (() => {
// Sidebar.jsx — left rail: étalage list + tag filters.

function Sidebar({
  activeId,
  setEntry,
  activeTag,
  setActiveTag
}) {
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      borderRight: '1px solid var(--ink-0)',
      background: 'var(--paper-0)',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 12px',
      fontSize: 9,
      letterSpacing: '0.25em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      borderBottom: '1px solid var(--ink-0)',
      background: 'var(--paper-1)'
    }
  }, "\xC9 T A L A G E"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, ENTRIES.map(e => {
    const active = activeId === e.id;
    return /*#__PURE__*/React.createElement("a", {
      key: e.id,
      href: "#",
      onClick: ev => {
        ev.preventDefault();
        setEntry(e.id);
      },
      style: {
        display: 'grid',
        gridTemplateColumns: '40px 1fr auto',
        gap: 8,
        padding: '10px 12px',
        borderBottom: '1px dotted var(--ink-5)',
        background: active ? 'var(--acid)' : 'transparent',
        textDecoration: 'none',
        color: 'var(--ink-0)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 36,
        height: 36,
        background: 'var(--ink-0)',
        backgroundImage: `radial-gradient(circle at 30% 40%, var(--paper-0) 1px, transparent 1.5px),
                                  radial-gradient(circle at 70% 60%, var(--paper-0) 1px, transparent 1.5px)`,
        backgroundSize: '4px 4px, 6px 6px'
      }
    }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        color: 'var(--ink-3)',
        letterSpacing: '0.1em'
      }
    }, e.date), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.25
      }
    }, e.title), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 9,
        letterSpacing: '0.2em',
        color: 'var(--ink-3)'
      }
    }, e.kind)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        alignSelf: 'center'
      }
    }, e.price));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 10px 14px',
      borderTop: '1px solid var(--ink-0)',
      display: 'flex',
      flexWrap: 'wrap',
      gap: 4
    }
  }, TAGS.map(t => {
    const on = activeTag === t;
    return /*#__PURE__*/React.createElement("button", {
      key: t,
      onClick: () => setActiveTag(on ? null : t),
      style: {
        fontFamily: 'var(--ff-mono)',
        fontSize: 9,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        padding: '3px 6px',
        border: '1px solid var(--ink-0)',
        background: on ? 'var(--ink-0)' : 'transparent',
        color: on ? 'var(--paper-0)' : 'var(--ink-0)',
        cursor: 'pointer',
        borderRadius: 0
      }
    }, t);
  })));
}
Object.assign(window, {
  Sidebar
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portfolio/Sidebar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portfolio/Views.jsx
try { (() => {
// Views.jsx — Journal (log entries) + About (colophon).

const {
  EntryCard,
  MetaPair,
  Panel,
  Highlighter
} = window.NIKOLASSDesignSystem_1f5ba6;
const POSTS = [{
  d: '25.10.06',
  n: '#047',
  t: 'Rewiring the studio. Day 2.',
  x: 'Ground loop traced to the input strip. Will replace tonight.',
  k: 'LOG'
}, {
  d: '25.09.28',
  n: '#046',
  t: 'Currently reading: Calvino.',
  x: "If on a winter's night a traveller. Slow, deliberate.",
  k: 'NOTE'
}, {
  d: '25.09.14',
  n: '#045',
  t: 'Notes on Kiarostami, second viewing.',
  x: 'The notebook scene reads completely differently the second time.',
  k: 'FILM'
}, {
  d: '25.08.30',
  n: '#044',
  t: 'On dispersion as a method.',
  x: 'A scattered archive is one that survives. A neat one gets thrown out.',
  k: 'ESSAI'
}];
function JournalView() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '28px 36px 60px',
      background: 'var(--paper-0)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      borderBottom: '1px solid var(--ink-0)',
      paddingBottom: 8,
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--ff-display)',
      fontSize: 44,
      fontWeight: 700,
      letterSpacing: '-0.025em',
      textTransform: 'uppercase',
      margin: 0
    }
  }, "Journal"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)'
    }
  }, "47 ENTRIES \xB7 ", '{newest first}')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 18
    }
  }, POSTS.map((p, i) => /*#__PURE__*/React.createElement(EntryCard, {
    key: p.n,
    kind: `ENTRY · ${p.n}`,
    code: `[${p.k}]`,
    thumb: i === 0,
    stamp: i === 0,
    title: p.t,
    excerpt: p.x,
    meta: [p.d, 'read entry →'],
    onClick: () => {}
  }))));
}
function AboutView() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '28px 36px 60px',
      background: 'var(--paper-0)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr',
      gap: 36
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--ff-display)',
      fontSize: 56,
      fontWeight: 700,
      letterSpacing: '-0.025em',
      textTransform: 'uppercase',
      margin: 0,
      lineHeight: 0.95
    }
  }, "I keep notes.", /*#__PURE__*/React.createElement("br", null), "These are some", /*#__PURE__*/React.createElement("br", null), "of them."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 28,
      fontFamily: 'var(--ff-serif)',
      fontStyle: 'italic',
      fontSize: 22,
      lineHeight: 1.3,
      color: 'var(--ink-1)',
      maxWidth: 540
    }
  }, "\"", /*#__PURE__*/React.createElement(Highlighter, null, "The ability to craft something that from a wider perspective feels one dimensional, yet gradually gets nuanced as you dive deeper."), "\""), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 18,
      fontSize: 14,
      color: 'var(--ink-1)',
      lineHeight: 1.6,
      maxWidth: 540
    }
  }, "I'm Nikolass. I make things \u2014 sometimes in code, sometimes on paper, often somewhere between. This site is a logbook, not a portfolio. It's where I publish whatever I'd otherwise lose track of. If something here is useful to you, take it.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      alignSelf: 'start'
    }
  }, /*#__PURE__*/React.createElement(Panel, {
    title: "STATS",
    code: "[2025.10]"
  }, [['Mods', '0005'], ['Pages', '0072'], ['Images', '0550'], ['Jour', '0068'], ['Files', '0591'], ['Comm.', '0030']].map(([k, v]) => /*#__PURE__*/React.createElement(MetaPair, {
    key: k,
    label: k,
    value: v,
    labelWidth: 70
  }))), /*#__PURE__*/React.createElement(Panel, {
    title: "MACHINE",
    code: "[ENV]",
    tone: "recessed"
  }, /*#__PURE__*/React.createElement(MetaPair, {
    label: "Macint.",
    value: "10.13.6",
    labelWidth: 70
  }), /*#__PURE__*/React.createElement(MetaPair, {
    label: "Nav.",
    value: "Safari",
    labelWidth: 70
  }), /*#__PURE__*/React.createElement(MetaPair, {
    label: "Robot",
    value: "false",
    labelWidth: 70
  }), /*#__PURE__*/React.createElement(MetaPair, {
    label: "Mobile",
    value: "false",
    labelWidth: 70
  })))));
}
Object.assign(window, {
  JournalView,
  AboutView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portfolio/Views.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portfolio/data.jsx
try { (() => {
// data.jsx — fake catalogue content for the prototype.

const ENTRIES = [{
  id: 'silo-001',
  date: '01.02.16',
  title: 'Silo 001',
  kind: 'LABEL',
  price: '15 €',
  n: '001'
}, {
  id: 'silo-003',
  date: '02.10.17',
  title: 'Silo 003',
  kind: 'LABEL',
  price: '10 €',
  n: '003'
}, {
  id: 'silo-004',
  date: '16.01.18',
  title: 'Silo 004',
  kind: 'LABEL',
  price: '15 €',
  n: '004'
}, {
  id: 'lib-b',
  date: '07.10.17',
  title: 'Librarioli N°B — Babillage',
  kind: 'ÉDITION',
  price: '15 €',
  n: 'B'
}, {
  id: 'lib-c',
  date: '09.06.18',
  title: 'Librarioli N°C — Conapt',
  kind: 'ÉDITION',
  price: '15 €',
  n: 'C'
}, {
  id: 'lib-d',
  date: '11.02.19',
  title: 'Librarioli N°D — Dispersion',
  kind: 'ÉDITION',
  price: '15 €',
  n: 'D'
}];
const TAGS = ['3D', '2024', '2025', '2026', 'ACHEIROPOÏÈTE', 'AFFICHE', 'ANALYSE', 'APPEL À CONTRIBUTIONS', 'ARCHITECTURE', 'ARCHIVE', 'ARTICLE'];
const WEATHER = [{
  icon: '☀',
  key: '06.10.25',
  value: 'Ciel dégagé',
  sub: '↘ 10.4°C  ↗ 13.6°C'
}, {
  icon: '☀',
  key: '07.10.25',
  value: 'Ciel dégagé',
  sub: '↘ 9.6°C  ↗ 12.0°C'
}, {
  icon: '☀',
  key: '08.10.25',
  value: 'Ciel dégagé',
  sub: '↘ 8.8°C  ↗ 10.4°C'
}, {
  icon: '◐',
  key: '09.10.25',
  value: 'Nuages',
  sub: '↘ 9.2°C  ↗ 10.0°C'
}, {
  icon: '◑',
  key: '10.10.25',
  value: 'Pluie',
  sub: '↘ 7.4°C  ↗ 9.4°C'
}];
Object.assign(window, {
  ENTRIES,
  TAGS,
  WEATHER
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portfolio/data.jsx", error: String((e && e.message) || e) }); }

__ds_ns.AsciiDivider = __ds_scope.AsciiDivider;

__ds_ns.Caret = __ds_scope.Caret;

__ds_ns.Halftone = __ds_scope.Halftone;

__ds_ns.Highlighter = __ds_scope.Highlighter;

__ds_ns.PixlGlyph = __ds_scope.PixlGlyph;

__ds_ns.Stamp = __ds_scope.Stamp;

__ds_ns.TechMarker = __ds_scope.TechMarker;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.MetaPair = __ds_scope.MetaPair;

__ds_ns.Panel = __ds_scope.Panel;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.DataTable = __ds_scope.DataTable;

__ds_ns.EntryCard = __ds_scope.EntryCard;

__ds_ns.MetaStrip = __ds_scope.MetaStrip;

})();
