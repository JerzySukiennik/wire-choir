// Wire Choir avatar head: Jurek's GLB avatar driven by the same articulation params via ARKit morphs.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { OPEN, LIPD, LIPR, TX, VOICE, FRIC } from '../voice/engine.js';

const SRC = new URL('../../assets/jurek-head.glb', import.meta.url).href;
let gltfPromise = null;
let availPromise = null;

export function avatarAvailable() {
  if (!availPromise) availPromise = fetch(SRC, { method: 'HEAD' }).then((r) => r.ok).catch(() => false);
  return availPromise;
}

function loadGltf() {
  if (!gltfPromise) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    gltfPromise = loader.loadAsync(SRC);
  }
  return gltfPromise;
}

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const cl = (x) => Math.min(1, Math.max(0, x));

export class AvatarHead {
  constructor(opts) {
    this.group = new THREE.Group();
    this.inner = new THREE.Group();
    this.group.add(this.inner);
    this.color = new THREE.Color(opts.color || '#4fd2ff');
    this.wordColor = opts.wordColor || '#7dffb6';
    this.meshes = [];
    this.w = {};
    this.ready = false;
    this.blink = 0; this.nextBlink = 2 + Math.random() * 3; this.tilt = 0; this.jaw = 0;
    const hemi = new THREE.HemisphereLight(0xdfe8f2, 0x0a0b10, 0.75);
    const key = new THREE.DirectionalLight(0xfff1e2, 2.4);
    key.position.set(2.2, 2.6, 4);
    const fill = new THREE.DirectionalLight(0x9fb8ff, 0.5);
    fill.position.set(-3, 0.5, 2);
    const rimC = this.color.clone().lerp(new THREE.Color('#ffffff'), 0.6);
    const rim = new THREE.DirectionalLight(rimC, 2.6);
    rim.position.set(-2.5, 2, -4);
    const rim2 = new THREE.DirectionalLight(rimC, 1.4);
    rim2.position.set(3, 1, -3);
    this.group.add(hemi, key, fill, rim, rim2);
    loadGltf().then((gltf) => {
      const root = skeletonClone(gltf.scene);
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      const s = 2.9 / size.y;
      root.scale.setScalar(s);
      root.position.set(-c.x * s, 1.32 - box.max.y * s, -c.z * s + 0.05);
      root.traverse((o) => {
        if (o.isMesh && o.morphTargetDictionary && o.morphTargetInfluences) this.meshes.push(o);
        if (o.isMesh) o.frustumCulled = false;
      });
      this.inner.add(root);
      this.ready = true;
    }).catch(() => { this.failed = true; });
  }

  set(name, v) { this.w[name] = v; }

  update(params, level, t, dt, f0Rel) {
    if (!this.ready) return;
    const open = cl(params[OPEN]), lipD = Math.max(0, params[LIPD]), lipR = cl(params[LIPR]);
    const voice = params[VOICE], fric = params[FRIC];
    const lv = Math.min(1, level * 5);
    const jaw = cl(open * 0.72 + 0.04);
    this.jaw += (jaw - this.jaw) * Math.min(1, dt * 30);
    const j = this.jaw;
    const close = lipD < 0.35 ? cl(1 - lipD / 0.35) : 0;
    const spread = (1 - lipR) * sm(1.5, 2.2, lipD) * sm(0.5, 0.68, params[TX]);
    const fr = Math.max(-1, Math.min(1, f0Rel || 0));
    this.nextBlink -= dt;
    if (this.nextBlink < 0) { this.blink = 1; this.nextBlink = 2.5 + Math.random() * 4.5; }
    this.blink = Math.max(0, this.blink - dt * 7);
    const b = Math.sin(this.blink * Math.PI);
    const brow = voice > 0.05 ? cl(fr * 0.9 + lv * 0.15) : 0;
    const W = {
      jawOpen: j, corr_jawOpenArc: 4 * j * (1 - j),
      mouthClose: cl(j * close * 1.1),
      mouthFunnel: lipR * 0.6 * sm(0.3, 1.0, lipD),
      mouthPucker: lipR * 0.7 * (1 - sm(0.5, 1.4, lipD)),
      mouthStretchLeft: spread * 0.45, mouthStretchRight: spread * 0.45,
      mouthSmileLeft: spread * 0.18, mouthSmileRight: spread * 0.18,
      mouthLowerDownLeft: open * 0.35, mouthLowerDownRight: open * 0.35,
      mouthUpperUpLeft: open * 0.15, mouthUpperUpRight: open * 0.15,
      viseme_FF: fric > 0.1 && lipD < 0.3 && close < 0.9 ? 0.55 : 0,
      browInnerUp: brow, browOuterUpLeft: brow * 0.6, browOuterUpRight: brow * 0.6,
      eyeBlinkLeft: b, eyeBlinkRight: b, corr_eyeBlinkArcLeft: 4 * b * (1 - b), corr_eyeBlinkArcRight: 4 * b * (1 - b),
      eyeSquintLeft: lv * 0.18, eyeSquintRight: lv * 0.18,
    };
    for (const m of this.meshes) {
      const d = m.morphTargetDictionary, inf = m.morphTargetInfluences;
      for (const k in W) {
        const i = d[k];
        if (i === undefined) continue;
        inf[i] += (W[k] - inf[i]) * Math.min(1, dt * 26);
      }
    }
    this.tilt += ((voice > 0.05 ? fr * 0.06 : 0) - this.tilt) * Math.min(1, dt * 2);
    this.inner.rotation.x = -this.tilt;
  }

  setDepth() {}

  mouthPoint(out) {
    out.set(0, -0.62 - this.jaw * 0.08, 1.02);
    return this.inner.localToWorld(out);
  }

  dispose() {}
}
