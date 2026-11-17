// The studio light turns with the camera, as a product on a turntable under fixed studio lights: when the
// shopper turns the model, the long highlights slide across the doors, the side that faces the key light
// brightens, and a soft key-light shadow swings round on the floor (on the wall behind a wall unit).
// At the opening view nothing changes from before: the light there is the one every product was matched to
// (env/studio.hdr, PLAYBOOK section 8), and the key light adds no light of its own, only its shadow.
// Phone AR and the room photo tool keep their own light (the room's), so all of this is off while AR runs.
// It reaches into model-viewer 4.0.0's scene through its symbols; if a later version moves them, the page
// keeps the fixed light it had before instead of breaking.
const THREE_AT = "https://cdn.jsdelivr.net/npm/three@0.169.0/src";
const KEY_AZ = -40, KEY_EL = 50;          // the key light: front left of the camera, 50 degrees up
const FLOOR_SHADOW = 0.3, WALL_SHADOW = 0.18;
// a studio is darker behind the product: the light dims a little as the view goes round to the back, so a
// pale rear panel (matched to the old, dimmer back light) doesn't wash out
const BACK_DIM = 0.22;

const symbol = (el, name) => { for (let o = el; o; o = Object.getPrototypeOf(o)) { const s = Object.getOwnPropertySymbols(o).find((x) => x.description === name); if (s) return s; } };

export async function studioLight(mv, { wall = false } = {}) {
  const sScene = symbol(mv, "scene"), sRenderer = symbol(mv, "renderer");
  const scene = sScene && mv[sScene], three = sRenderer && mv[sRenderer]?.threeRenderer;
  if (!scene?.environmentRotation || !scene.target || !scene.boundingBox || !three?.shadowMap) return null;
  // the plane and the mesh come from model-viewer's own contact-shadow floor; the light and the shadow-only
  // material aren't in its bundle, so they load from the same three.js release (about 31 KB gzipped)
  const floor = scene.shadow?.floor;
  if (!floor) return null;
  const Mesh = floor.constructor, PlaneGeometry = floor.geometry.constructor;
  let DirectionalLight, ShadowMaterial;
  try {
    [{ DirectionalLight }, { ShadowMaterial }] = await Promise.all([
      import(`${THREE_AT}/lights/DirectionalLight.js/+esm`),
      import(`${THREE_AT}/materials/ShadowMaterial.js/+esm`),
    ]);
  } catch { return null; }

  // the shadow is a second drawing of the model each frame; a phone with 2 GB of memory or less keeps only the turning light
  const shadow = !(navigator.deviceMemory && navigator.deviceMemory <= 2);
  three.shadowMap.enabled = shadow;
  three.shadowMap.type = 3; // VSMShadowMap: a soft, blurred edge like a big softbox's
  const box = scene.boundingBox, size = box.getSize(new (box.min.constructor)()), c = box.getCenter(new (box.min.constructor)());
  const R = Math.max(size.x, size.y, size.z);

  const light = new DirectionalLight(0xffffff, 0);
  light.castShadow = shadow;
  const sh = light.shadow;
  sh.mapSize.set(1024, 1024); sh.radius = 14; sh.blurSamples = 20; sh.bias = -0.0004;
  Object.assign(sh.camera, { left: -1.6 * R, right: 1.6 * R, top: 1.6 * R, bottom: -1.6 * R, near: 0.05, far: 6 * R });
  sh.camera.updateProjectionMatrix();

  // the shadow fades out well inside the floor's edge, so no edge of it (or of the shadow map) ever shows
  const half = 1.4 * R;
  const shadowOnly = new ShadowMaterial({ opacity: wall ? WALL_SHADOW : FLOOR_SHADOW, depthWrite: false });
  shadowOnly.onBeforeCompile = (s) => {
    s.uniforms.fadeHalf = { value: half };
    s.vertexShader = s.vertexShader.replace("void main() {", "varying vec2 vFade;\nvoid main() {\n\tvFade = position.xy;");
    s.fragmentShader = s.fragmentShader.replace("void main() {", "uniform float fadeHalf;\nvarying vec2 vFade;\nvoid main() {")
      .replace("#include <tonemapping_fragment>", "gl_FragColor.a *= 1.0 - smoothstep(0.35 * fadeHalf, fadeHalf, length(vFade));\n\t#include <tonemapping_fragment>");
  };
  const catcher = new Mesh(new PlaneGeometry(2 * half, 2 * half), shadowOnly);
  catcher.receiveShadow = true;
  catcher.userData.noHit = true;
  catcher.visible = shadow;
  if (wall) catcher.position.set(c.x, c.y, box.min.z - 0.001);
  else { catcher.rotation.x = -Math.PI / 2; catcher.position.set(c.x, box.min.y + 0.0005, c.z); }
  scene.target.add(light, light.target, catcher);
  const castAll = () => scene.target.traverse((o) => { if (o.isMesh && o !== catcher && !o.userData.noHit) { o.castShadow = true; o.receiveShadow = false; } });
  castAll();

  let home = mv.getCameraOrbit().theta, on = true;
  const place = () => {
    const turn = on ? mv.getCameraOrbit().theta - home : 0;
    scene.environmentRotation.y = turn;
    scene.environmentIntensity = 1 - BACK_DIM * (1 - Math.cos(turn)) / 2;
    // a wall unit's key light stays in front of the wall, however far round the view goes
    const az = (KEY_AZ * Math.PI) / 180 + turn, a = wall ? Math.max(-1.4, Math.min(1.4, az)) : az;
    const el = (KEY_EL * Math.PI) / 180, d = 3 * R;
    light.position.set(c.x + d * Math.cos(el) * Math.sin(a), (wall ? c.y : box.min.y) + d * Math.sin(el), c.z + d * Math.cos(el) * Math.cos(a));
    light.target.position.set(c.x, wall ? c.y : box.min.y, c.z);
    scene.queueRender();
  };
  const setOn = (v) => { on = v; light.castShadow = v && shadow; catcher.visible = v && shadow; place(); };
  mv.addEventListener("camera-change", place);
  // AR on Android lights the model with the real room
  mv.addEventListener("ar-status", (e) => setOn(e.detail.status === "not-presenting" || e.detail.status === "failed"));
  // a colour change can bring new meshes
  mv.addEventListener("variant-applied", castAll);
  place();
  return { setOn, rehome: () => { home = mv.getCameraOrbit().theta; place(); } };
}
