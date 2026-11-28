// A stand-in for phone AR in Chrome on Android (WebXR "immersive-ar" with hit testing), for the browser
// tests. The room is one flat floor 1.35 m below where the phone starts, and, when the test puts one there
// (`state.wall` = its z), a flat wall facing the phone's first view, for units that hang on a wall. The test aims the phone,
// decides when the floor has been "found", and touches the screen; hit tests answer from the floor.
// It is not ARCore: real tracking, drift, shiny floors and camera images are not part of it.
// Light estimation ("light-estimation", which model-viewer asks for with xr-environment) is off unless the test sets
// `state.light` before AR starts: { sh: 27 numbers, dir: [x, y, z], intensity: [r, g, b] } is the room's light as
// ARCore would estimate it, sent once `state.light.on` is true; `state.light.reflection` = [r, g, b] (0-255) is a plain
// room-coloured reflection cube map, sent with a "reflectionchange" when the test calls __phone.reflect() (again after
// a change of colour, for a room whose light changes).
// Inject it before the page loads (Page.addScriptToEvaluateOnNewDocument), with an Android user agent.
(() => {
  const FLOOR = -1.35, FOV_Y = 62 * Math.PI / 180, NEAR = 0.05, FAR = 100;
  const phone = { pos: [0, 0, 0], q: [0, 0, 0, 1], floorFound: true, wall: null, light: null, probe: null, session: null, touch: null, frames: 0 };

  const qRotate = ([x, y, z, w], [vx, vy, vz]) => {
    const ix = w * vx + y * vz - z * vy, iy = w * vy + z * vx - x * vz, iz = w * vz + x * vy - y * vx, iw = -x * vx - y * vy - z * vz;
    return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
  };
  const compose = (p, [x, y, z, w]) => new Float32Array([
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
    p[0], p[1], p[2], 1]);
  const invert = (p, [x, y, z, w]) => { const qi = [-x, -y, -z, w], t = qRotate(qi, p); return compose([-t[0], -t[1], -t[2]], qi); };
  const rigid = (p, q) => ({
    position: new DOMPointReadOnly(p[0], p[1], p[2], 1), orientation: new DOMPointReadOnly(q[0], q[1], q[2], q[3]),
    matrix: compose(p, q), inverse: { matrix: invert(p, q) },
  });
  const aspect = () => innerWidth / innerHeight;
  const projection = () => {
    const f = 1 / Math.tan(FOV_Y / 2);
    return new Float32Array([f / aspect(), 0, 0, 0, 0, f, 0, 0, 0, 0, (FAR + NEAR) / (NEAR - FAR), -1, 0, 0, 2 * FAR * NEAR / (NEAR - FAR), 0]);
  };
  // a ray from the phone, through a point on the screen given as -1..1 across and -1..1 down
  const screenRay = (ax, ay) => {
    const t = Math.tan(FOV_Y / 2), d = [ax * t * aspect(), -ay * t, -1], l = Math.hypot(...d);
    return { o: phone.pos, d: qRotate(phone.q, d.map((v) => v / l)) };
  };
  // the nearest surface along a ray: the floor (its pose's y axis points up), or the wall (its y axis points out of
  // the wall, towards the room, as ARCore gives a wall's hit pose)
  const floorHit = ({ o, d }) => {
    if (!phone.floorFound) return null;
    const hits = [];
    if (d[1] < -1e-6) hits.push([(FLOOR - o[1]) / d[1], [0, 0, 0, 1]]);
    if (phone.wall != null && d[2] < -1e-6) hits.push([(phone.wall - o[2]) / d[2], [Math.SQRT1_2, 0, 0, Math.SQRT1_2]]);
    const [t, q] = hits.filter(([t]) => t > 0 && t <= 20).sort((a, b) => a[0] - b[0])[0] || [];
    if (t == null) return null;
    const p = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
    return { getPose: () => ({ transform: rigid(p, q), emulatedPosition: false }), point: p };
  };

  class Space extends EventTarget { constructor(type) { super(); this.type = type; } getOffsetReferenceSpace() { return this; } }
  class XRRay { constructor(origin = { x: 0, y: 0, z: 0 }, direction = { x: 0, y: 0, z: -1 }) { this.origin = origin; this.direction = direction; } }
  class HitSource { constructor(session, space, ray) { this.session = session; this.space = space; this.ray = ray || new XRRay(); } cancel() { this.cancelled = true; } }
  class TransientSource { constructor(session) { this.session = session; } cancel() { this.cancelled = true; } }
  class Layer {
    constructor() { this.framebuffer = null; this.framebufferWidth = Math.round(innerWidth * devicePixelRatio); this.framebufferHeight = Math.round(innerHeight * devicePixelRatio); this.antialias = true; this.ignoreDepthValues = false; }
    getViewport() { return { x: 0, y: 0, width: this.framebufferWidth, height: this.framebufferHeight }; }
  }
  class Frame {
    constructor(session) { this.session = session; }
    getViewerPose() { const t = rigid(phone.pos, phone.q); return { transform: t, emulatedPosition: false, views: [{ eye: "none", projectionMatrix: projection(), transform: t }] }; }
    getPose(space) { return space?.type === "viewer" ? { transform: rigid(phone.pos, phone.q), emulatedPosition: false } : null; }
    getHitTestResults(src) {
      if (src.cancelled) return [];
      const r = src.ray, o = [r.origin.x, r.origin.y, r.origin.z], d = [r.direction.x, r.direction.y, r.direction.z];
      // the source's ray is in the phone's space
      const l = Math.hypot(...d), wo = qRotate(phone.q, o).map((v, i) => v + phone.pos[i]), wd = qRotate(phone.q, d.map((v) => v / l));
      const h = floorHit({ o: wo, d: wd });
      return h ? [h] : [];
    }
    getLightEstimate(probe) {
      const l = phone.light;
      if (!l?.on || probe !== phone.probe) return null;
      return { sphericalHarmonicsCoefficients: new Float32Array(l.sh), primaryLightDirection: new DOMPointReadOnly(...l.dir, 0), primaryLightIntensity: new DOMPointReadOnly(...l.intensity, 1) };
    }
    getHitTestResultsForTransientInput(src) {
      if (src.cancelled || !phone.touch) return [];
      const h = floorHit(screenRay(...phone.touch.gamepad.axes));
      return [{ inputSource: phone.touch, results: h ? [h] : [] }];
    }
  }
  class Session extends EventTarget {
    constructor(mode, init) {
      super();
      this.mode = mode;
      this.renderState = { baseLayer: null, depthNear: 0.1, depthFar: 1000, inlineVerticalFieldOfView: null };
      this.inputSources = [];
      this.enabledFeatures = ["local", "viewer", "hit-test", ...(init?.domOverlay ? ["dom-overlay"] : [])];
      this.environmentBlendMode = "alpha-blend";
      this.interactionMode = "screen-space";
      this.visibilityState = "visible";
      this.domOverlayState = init?.domOverlay ? { type: "screen" } : null;
      // Chrome shows only the overlay element, full screen over the camera image; here the element that
      // holds it fills the window over a plain grey "room", and the rest of the page is hidden
      this.host = init?.domOverlay?.root?.getRootNode()?.host || init?.domOverlay?.root || null;
      if (this.host) {
        if (!document.getElementById("xr-overlay-css")) {
          const css = document.createElement("style");
          css.id = "xr-overlay-css";
          css.textContent = `html.xr-overlay body * { visibility: hidden !important; }
            html.xr-overlay body [data-xr-overlay] * { visibility: visible !important; }
            html.xr-overlay [data-xr-overlay] { visibility: visible !important; position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 2147483646 !important; background: linear-gradient(#cfc8bc, #a39b8e 48%, #81796c) !important; }`;
          document.head.appendChild(css);
        }
        this.host.setAttribute("data-xr-overlay", "");
        // Chrome's :xr-overlay rule: the overlay element itself fills the screen
        this.root = init.domOverlay.root;
        this.rootStyle = this.root.getAttribute("style");
        this.root.style.cssText += ";position:fixed;inset:0;width:100%;height:100%;";
        document.documentElement.classList.add("xr-overlay");
      }
      if (phone.light) {
        this.enabledFeatures.push("light-estimation");
        this.preferredReflectionFormat = "srgba8";
        this.requestLightProbe = () => Promise.resolve((phone.probe = new EventTarget()));
      }
      this.cbs = new Map(); this.next = 0; this.ended = false;
      const tick = (t) => {
        if (this.ended) return;
        const cbs = this.cbs; this.cbs = new Map();
        // the camera view fills the screen, whatever size the page gave the canvas
        for (const c of this.host?.shadowRoot?.querySelectorAll("canvas") || []) Object.assign(c.style, { position: "fixed", left: "0", top: "0", width: "100vw", height: "100vh" });
        const frame = new Frame(this);
        this.lastFrame = frame;
        phone.frames++;
        for (const cb of cbs.values()) cb(t, frame);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    updateRenderState(s) { Object.assign(this.renderState, s); }
    requestReferenceSpace(type) { return Promise.resolve(new Space(type)); }
    requestAnimationFrame(cb) { const id = ++this.next; this.cbs.set(id, cb); return id; }
    cancelAnimationFrame(id) { this.cbs.delete(id); }
    requestHitTestSource({ space, offsetRay }) { return Promise.resolve(new HitSource(this, space, offsetRay)); }
    requestHitTestSourceForTransientInput() { return Promise.resolve(new TransientSource(this)); }
    end() {
      if (this.ended) return Promise.resolve();
      this.ended = true;
      if (this.host) {
        this.host.removeAttribute("data-xr-overlay");
        document.documentElement.classList.remove("xr-overlay");
        if (this.rootStyle == null) this.root.removeAttribute("style"); else this.root.setAttribute("style", this.rootStyle);
      }
      phone.session = null;
      const e = new Event("end"); e.session = this;
      this.dispatchEvent(e);
      return Promise.resolve();
    }
  }
  const select = (type) => { const s = phone.session; if (!s || !phone.touch) return; const e = new Event(type); e.inputSource = phone.touch; e.frame = s.lastFrame; s.dispatchEvent(e); };

  const xr = Object.assign(new EventTarget(), {
    isSessionSupported: (mode) => Promise.resolve(mode === "immersive-ar"),
    requestSession: (mode, init) => {
      if (mode !== "immersive-ar") return Promise.reject(new DOMException("Not supported", "NotSupportedError"));
      if (phone.session) return Promise.reject(new DOMException("An active XRSession already exists", "InvalidStateError"));
      return Promise.resolve((phone.session = new Session(mode, init)));
    },
  });
  Object.defineProperty(navigator, "xr", { value: xr, configurable: true });

  // the room's reflections, as a cube map texture in the page's own WebGL context
  class Binding {
    constructor(session, gl) { this.gl = gl; this.cube = null; }
    getReflectionCubeMap(probe) {
      const c = phone.light?.reflection;
      if (!c || !phone.light.sent || probe !== phone.probe) return null;
      // a room that changes (a lamp switched on) sends a new map into the same texture, as ARCore does
      if (this.cube && this.colour === String(c)) return this.cube;
      const gl = this.gl, t = this.cube || gl.createTexture(), n = 16, px = new Uint8Array(n * n * 4);
      this.colour = String(c);
      for (let i = 0; i < n * n; i++) px.set([...c, 255], i * 4);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, t);
      for (let f = 0; f < 6; f++) gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + f, 0, gl.RGBA, n, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
      return (this.cube = t);
    }
  }
  Object.assign(window, { XRSession: Session, XRWebGLLayer: Layer, XRWebGLBinding: Binding, XRRay, XRHitTestSource: HitSource });
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) if (C) C.prototype.makeXRCompatible = () => Promise.resolve();

  window.__phone = {
    state: phone,
    // hold the phone at `from` (metres, relative to where it started), its middle pointing at `to`
    aim(from, to) {
      const d = to.map((v, i) => v - from[i]), l = Math.hypot(...d);
      const yaw = Math.atan2(-d[0], -d[2]), pitch = Math.asin(d[1] / l);
      const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2), cx = Math.cos(pitch / 2), sx = Math.sin(pitch / 2);
      phone.pos = from.slice();
      phone.q = [cy * sx, sy * cx, -sy * sx, cy * cx];
    },
    floor: FLOOR,
    // where the middle of the screen meets the floor (or the wall)
    centreHit() { const h = floorHit(screenRay(0, 0)); return h && h.point; },
    // a world point on the screen, -1..1 across and down, or null behind the phone
    project(p) {
      const q = phone.q, v = qRotate([-q[0], -q[1], -q[2], q[3]], p.map((x, i) => x - phone.pos[i]));
      if (v[2] >= 0) return null;
      const t = Math.tan(FOV_Y / 2);
      return [v[0] / -v[2] / (t * aspect()), -(v[1] / -v[2]) / t];
    },
    // the room's reflection cube map arrives
    reflect() { if (phone.light && phone.probe) { phone.light.sent = true; phone.probe.dispatchEvent(new Event("reflectionchange")); } },
    touchStart(ax, ay) {
      phone.touch = { handedness: "none", targetRayMode: "screen", profiles: ["generic-touchscreen"], gamepad: { axes: [ax, ay], buttons: [] }, targetRaySpace: new Space("touch") };
      if (phone.session) phone.session.inputSources = [phone.touch];
      select("selectstart");
    },
    touchMove(ax, ay) { if (phone.touch) phone.touch.gamepad.axes = [ax, ay]; },
    touchEnd() { select("selectend"); select("select"); phone.touch = null; if (phone.session) phone.session.inputSources = []; },
  };
})();
