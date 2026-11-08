// Wire Choir hand-scripted wireframe head: shell with a real mouth split, skull, spine, larynx, GPU-skinned jaw and live articulators.
import * as THREE from 'three';
import { tractShape, OPEN, LIPD, LIPR, VEL, VOICE, ASP } from '../voice/engine.js';

const PIVOT = new THREE.Vector3(0, -0.08, -0.12);
const JAW_MAX = 0.24;
const STOMION = -0.575;

function curve(pts) {
  const ys = pts.map((p) => p[0]), vs = pts.map((p) => p[1]);
  const n = pts.length;
  const m = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    m[i] = (vs[b] - vs[a]) / (ys[b] - ys[a]);
  }
  return (y) => {
    if (y >= ys[0]) return vs[0];
    if (y <= ys[n - 1]) return vs[n - 1];
    let i = 0;
    while (i < n - 2 && y < ys[i + 1]) i++;
    const h = ys[i + 1] - ys[i], t = (y - ys[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * vs[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * vs[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

const FRONT = curve([[1.22, 0.0], [1.12, 0.42], [0.92, 0.74], [0.62, 0.9], [0.4, 0.95], [0.28, 0.88], [0.12, 0.98], [-0.1, 1.17], [-0.18, 1.1], [-0.26, 0.96], [-0.4, 0.99], [-0.5, 1.02], [-0.575, 0.98], [-0.64, 1.0], [-0.74, 0.92], [-0.8, 0.88], [-0.94, 0.93], [-1.06, 0.84], [-1.14, 0.58], [-1.2, 0.34], [-1.45, 0.36], [-1.6, 0.33], [-2.25, 0.34]]);
const BASE = curve([[1.22, 0.0], [1.12, 0.42], [0.92, 0.74], [0.62, 0.86], [0.4, 0.88], [0.2, 0.85], [-0.1, 0.84], [-0.4, 0.84], [-0.6, 0.82], [-0.8, 0.76], [-0.96, 0.72], [-1.06, 0.66], [-1.14, 0.5], [-1.2, 0.32], [-1.45, 0.34], [-1.6, 0.32], [-2.25, 0.33]]);
const BACK = curve([[1.22, 0.0], [1.12, -0.38], [0.92, -0.72], [0.55, -0.97], [0.15, -1.02], [-0.25, -0.88], [-0.55, -0.62], [-0.85, -0.47], [-1.3, -0.44], [-2.25, -0.47]]);
const WIDTH = curve([[1.22, 0.04], [1.12, 0.42], [0.92, 0.63], [0.55, 0.75], [0.15, 0.77], [-0.2, 0.73], [-0.5, 0.65], [-0.8, 0.53], [-1.0, 0.43], [-1.15, 0.38], [-1.4, 0.41], [-2.25, 0.5]]);
const FEATW = curve([[1.2, 0.5], [0.45, 0.42], [0.3, 0.2], [0.1, 0.13], [-0.15, 0.17], [-0.28, 0.22], [-0.45, 0.3], [-0.7, 0.3], [-0.9, 0.36], [-1.1, 0.4], [-1.4, 0.3]]);

function smooth(e0, e1, x) { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }

export function shellPoint(y, phi, out) {
  const s = Math.sin(phi), c = Math.cos(phi);
  const W = WIDTH(y), F = BASE(y), B = -BACK(y);
  const nf = 2.6, nb = 2.1;
  const x = W * Math.sign(s) * Math.pow(Math.abs(s), 2 / (c >= 0 ? nf : nb));
  let z = (c >= 0 ? F : B) * Math.sign(c) * Math.pow(Math.abs(c), 2 / (c >= 0 ? nf : nb));
  if (c > 0) {
    const fw = FEATW(y);
    z += (FRONT(y) - F) * Math.exp(-(x * x) / (fw * fw)) * c;
    for (const ex of [-0.29, 0.29]) z -= 0.07 * Math.exp(-((x - ex) ** 2) / 0.02 - ((y - 0.2) ** 2) / 0.012) * c;
  }
  out.set(x, y, z);
  return out;
}

const _zf = new THREE.Vector3();
export function zFace(x, y) {
  const W = WIDTH(y);
  const r = Math.min(0.999, Math.abs(x) / W);
  const sv = Math.pow(r, 2.6 / 2);
  return shellPoint(y, Math.sign(x) * Math.asin(sv), _zf).z;
}

function frontal(p) { return (1 - smooth(0.2, 0.42, Math.abs(p.x))) * smooth(0.45, 0.75, p.z); }
function jawWeight(p) {
  const cheek = smooth(-0.5, -0.72, p.y) * smooth(-0.3, 0.5, p.z) * (1 - smooth(-1.08, -1.32, p.y)) * 0.92;
  const lower = p.y < STOMION ? frontal(p) * (1 - smooth(-1.1, -1.3, p.y)) : 0;
  return Math.max(cheek, lower);
}
function lipBand(p) { return frontal(p) * smooth(-0.71, -0.66, p.y) * (1 - smooth(-0.5, -0.46, p.y)) * (1 - smooth(0.24, 0.3, Math.abs(p.x))); }

const VERT = `
attribute vec3 color;
attribute float jw;
attribute vec3 aux;
uniform float uJaw;
uniform float uMouth;
uniform float uLarynx;
uniform float uBrow;
uniform vec3 uPivot;
uniform float uGain;
varying vec3 vColor;
void main() {
  vec3 p = position;
  p.y += uLarynx * aux.y + uBrow * aux.z;
  p -= uPivot;
  float a = uJaw * jw;
  float c = cos(a), s = sin(a);
  p = vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c) + uPivot;
  vColor = color * uGain * (1.0 - aux.x * smoothstep(0.004, 0.035, uMouth));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const FRAG = `
varying vec3 vColor;
void main() { gl_FragColor = vec4(pow(max(vColor, vec3(0.0)), vec3(0.4545)), 1.0); }`;

function lineMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uJaw: { value: 0 }, uMouth: { value: 0 }, uLarynx: { value: 0 }, uBrow: { value: 0 }, uPivot: { value: PIVOT.clone() }, uGain: { value: 1 } },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

const ZERO = [0, 0, 0];
class Builder {
  constructor() { this.pos = []; this.col = []; this.jw = []; this.aux = []; }
  seg(a, b, c, ja, jb, xa, xb) {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    this.col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    this.jw.push(ja || 0, jb ?? ja ?? 0);
    const A = xa || ZERO, B = xb || xa || ZERO;
    this.aux.push(A[0], A[1], A[2], B[0], B[1], B[2]);
  }
  poly(pts, c, closed, jw, aux) {
    const J = (p) => (typeof jw === 'function' ? jw(p) : jw || 0);
    const X = (p) => (typeof aux === 'function' ? aux(p) : aux || ZERO);
    const n = pts.length;
    for (let i = 0; i < n - 1 + (closed ? 1 : 0); i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      this.seg(a, b, c, J(a), J(b), X(a), X(b));
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('jw', new THREE.Float32BufferAttribute(this.jw, 1));
    g.setAttribute('aux', new THREE.Float32BufferAttribute(this.aux, 3));
    return g;
  }
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);
function col(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return c; }

const WALL = [[-1.32, 0.05], [-1.15, -0.06], [-0.85, -0.12], [-0.5, -0.11], [-0.33, -0.04], [-0.27, 0.1], [-0.27, 0.3], [-0.3, 0.52], [-0.37, 0.7], [-0.46, 0.81], [-0.56, 0.93]];
const WALL_U = [0, 0.1, 0.3, 0.46, 0.53, 0.6, 0.7, 0.8, 0.88, 0.94, 1.0];
function wallAt(u, out, nrm) {
  u = Math.min(1, Math.max(0, u));
  let i = 0;
  while (i < WALL_U.length - 2 && u > WALL_U[i + 1]) i++;
  const t = (u - WALL_U[i]) / (WALL_U[i + 1] - WALL_U[i]);
  const p0 = WALL[Math.max(0, i - 1)], p1 = WALL[i], p2 = WALL[i + 1], p3 = WALL[Math.min(WALL.length - 1, i + 2)];
  const cr = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  out.set(0, cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1]));
  if (nrm) {
    const ty = p2[0] - p1[0], tz = p2[1] - p1[1];
    const L = Math.hypot(ty, tz) || 1;
    nrm.set(0, -tz / L, ty / L);
  }
  return out;
}

const LARYNX = [0, 1, 0], BROW = [0, 0, 1];

export class WireHead {
  constructor(opts) {
    this.group = new THREE.Group();
    this.inner = new THREE.Group();
    this.group.add(this.inner);
    this.color = new THREE.Color(opts.color || '#4fd2ff');
    this.wordColor = opts.wordColor || '#7dffb6';
    this.mat = lineMaterial();
    this.dynMat = lineMaterial();
    this.staticLines = new THREE.LineSegments(this.buildStatic(), this.mat);
    this.staticLines.frustumCulled = false;
    this.inner.add(this.staticLines);
    this.maxDyn = 7000;
    const g = new THREE.BufferGeometry();
    this.dPos = new Float32Array(this.maxDyn * 6);
    this.dCol = new Float32Array(this.maxDyn * 6);
    g.setAttribute('position', new THREE.BufferAttribute(this.dPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.dCol, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('jw', new THREE.BufferAttribute(new Float32Array(this.maxDyn * 2), 1));
    g.setAttribute('aux', new THREE.BufferAttribute(new Float32Array(this.maxDyn * 6), 3));
    this.dynGeo = g;
    this.dynLines = new THREE.LineSegments(g, this.dynMat);
    this.dynLines.frustumCulled = false;
    this.inner.add(this.dynLines);
    this.diam = new Float32Array(48);
    this.jaw = 0; this.mouth = 0; this.larynx = 0; this.brow = 0; this.tilt = 0;
    this.blink = 0;
    this.nextBlink = 2 + Math.random() * 4;
    this.n = 0;
    this.tongue = [];
    for (let i = 0; i < 9; i++) this.tongue.push(new Float32Array(32 * 3));
    this.tc = new THREE.Color();
  }

  buildStatic() {
    const b = new Builder();
    const C = this.color;
    const shell = col(C, 0.2), shellHi = col(C, 1.0), skull = col(C, 0.1);
    const bone = col('#efe6d2', 0.45), boneHi = col('#efe6d2', 0.7), jawC = col('#ff9a3c', 1.0);
    const shellAux = (p) => [lipBand(p), 0, 0];
    const p = V(0, 0, 0);
    for (let y = 1.18; y > -2.2; y -= 0.042) {
      const pts = [];
      for (let k = 0; k <= 110; k++) pts.push(shellPoint(y, (k / 110) * Math.PI * 2, V(0, 0, 0)));
      b.poly(pts, y < -1.6 ? col(C, 0.2 * Math.max(0, 1 - (-1.6 - y) / 0.6)) : shell, false, jawWeight, shellAux);
    }
    const meridian = (phi, c) => {
      const pts = [];
      for (let y = 1.22; y > -1.75; y -= 0.03) pts.push(shellPoint(y, phi, V(0, 0, 0)));
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], q = pts[i + 1];
        const cross = (a.y >= STOMION) !== (q.y >= STOMION) ? frontal(a) : 0;
        b.seg(a, q, c, jawWeight(a), jawWeight(q), [Math.max(lipBand(a), cross), 0, 0], [Math.max(lipBand(q), cross), 0, 0]);
      }
    };
    for (let k = 0; k < 36; k++) meridian((k / 36) * Math.PI * 2, k === 0 ? shellHi : col(C, 0.12));
    for (const side of [-1, 1]) meridian(side * Math.PI / 2, col(C, 0.35));
    const prof = [];
    for (let y = 1.22; y > -2.0; y -= 0.02) prof.push(V(0, y, FRONT(y) + 0.004));
    for (let i = 0; i < prof.length - 1; i++) {
      const a = prof[i], q = prof[i + 1];
      const cut = (a.y >= STOMION) !== (q.y >= STOMION) ? 1 : 0;
      b.seg(a, q, shellHi, jawWeight(a), jawWeight(q), [Math.max(cut, lipBand(a)), 0, 0], [Math.max(cut, lipBand(q)), 0, 0]);
    }
    const back = [];
    for (let y = -2.0; y < 1.22; y += 0.02) back.push(V(0, y, BACK(y)));
    b.poly(back, shellHi, false, 0);
    for (const ex of [-0.29, 0.29]) {
      const eye = [], iris = [], brow = [], brow2 = [];
      for (let k = 0; k <= 28; k++) {
        const t = (k / 28) * Math.PI * 2;
        const x = ex + Math.cos(t) * 0.13, y = 0.21 + Math.sin(t) * 0.05 * (1 - 0.3 * Math.cos(t) * Math.sign(ex));
        shellPoint(y, Math.asin(Math.max(-1, Math.min(1, x / WIDTH(y)))), p);
        eye.push(V(x, y, p.z - 0.01));
        iris.push(V(ex + Math.cos(t) * 0.045, 0.21 + Math.sin(t) * 0.045, p.z - 0.02));
      }
      for (let k = 0; k <= 16; k++) {
        const x = ex - 0.16 + (k / 16) * 0.32, y = 0.36 + 0.05 * Math.sin((k / 16) * Math.PI) - (Math.sign(ex) * (x - ex)) * 0.06;
        shellPoint(y, Math.asin(Math.max(-1, Math.min(1, x / WIDTH(y)))), p);
        brow.push(V(x, y, p.z + 0.01));
        brow2.push(V(x, y + 0.025, p.z + 0.006));
      }
      b.poly(eye, col(C, 0.75), false, 0);
      b.poly(iris, col(C, 0.5), false, 0);
      b.poly(brow, col(C, 0.7), false, 0, BROW);
      b.poly(brow2, col(C, 0.35), false, 0, BROW);
      const ear = [], ear2 = [];
      const W0 = WIDTH(0.05);
      for (let k = 0; k <= 30; k++) {
        const t = -0.4 + (k / 30) * Math.PI * 1.55;
        ear.push(V(Math.sign(ex) * (W0 + 0.05 + 0.03 * Math.sin(t)), 0.08 + Math.sin(t) * 0.26, -0.12 - Math.cos(t) * 0.14));
        ear2.push(V(Math.sign(ex) * (W0 + 0.04), 0.08 + Math.sin(t) * 0.15, -0.1 - Math.cos(t) * 0.07));
      }
      b.poly(ear, col(C, 0.55), false, 0);
      b.poly(ear2, col(C, 0.3), false, 0);
      const nos = [];
      for (let k = 0; k <= 12; k++) { const t = (k / 12) * Math.PI * 2; nos.push(V(Math.sign(ex) * 0.07 + Math.cos(t) * 0.035, -0.2 + Math.sin(t) * 0.018, 1.03)); }
      b.poly(nos, col(C, 0.45), false, 0);
    }
    for (let k = 0; k < 3; k++) {
      const sc = 0.88 - k * 0.07, pts = [];
      for (let t = 0; t <= 1.0001; t += 0.02) {
        const a = -0.2 + t * Math.PI * 1.1;
        pts.push(V(0, 0.18 + Math.sin(a) * 0.95 * sc, -0.06 + Math.cos(a) * 0.92 * sc));
      }
      b.poly(pts, skull, false, 0);
    }
    for (const yy of [0.6, 0.35]) {
      const pts = [];
      for (let k = 0; k <= 60; k++) { shellPoint(yy, (k / 60) * Math.PI * 2, p); pts.push(V(p.x * 0.86, yy, p.z * 0.86 - 0.02)); }
      b.poly(pts, skull, false, 0);
    }
    const q = V(0, 0, 0);
    const palate = [];
    for (let u = 0.56; u <= 0.885; u += 0.01) { wallAt(u, q); palate.push(q.clone()); }
    for (const dx of [-0.12, 0.12]) b.poly(palate.map((v) => V(dx * (0.5 + (v.z / 0.8) * 0.5), v.y - 0.01, v.z)), col('#ff8ad0', 0.3), false, 0);
    b.poly(palate, col('#ff8ad0', 0.75), false, 0);
    const nasalRoof = [];
    for (let k = 0; k <= 20; k++) { const t = k / 20; nasalRoof.push(V(0, 0.02 + Math.sin(t * Math.PI) * 0.1, -0.08 + t * 0.95)); }
    b.poly(nasalRoof, col(C, 0.35), false, 0);
    b.poly([V(0, -0.24, 0.12), V(0, -0.2, 0.5), V(0, -0.17, 0.88), V(0, -0.2, 1.0)], col(C, 0.3), false, 0);
    const phar = [];
    for (let u = 0; u <= 0.53; u += 0.01) { wallAt(u, q); phar.push(V(0, q.y, q.z - 0.012)); }
    b.poly(phar, col('#ff8ad0', 0.55), false, 0);
    const verts = [[-0.27, -0.4], [-0.47, -0.42], [-0.69, -0.43], [-0.9, -0.43], [-1.11, -0.42], [-1.32, -0.42], [-1.54, -0.44], [-1.77, -0.47], [-2.0, -0.5]];
    verts.forEach(([y, z], i) => {
      const h = i === 0 ? 0.06 : 0.075, rx = i === 0 ? 0.16 : 0.1, rz = 0.085;
      for (const yy of [y + h, y - h]) {
        const ring = [];
        for (let k = 0; k <= 18; k++) { const t = (k / 18) * Math.PI * 2; ring.push(V(Math.cos(t) * rx, yy, z + Math.sin(t) * rz)); }
        b.poly(ring, i === 1 ? boneHi : bone, false, 0);
      }
      for (const t of [0.5, 1.5, 2.6, 3.7, 4.8, 5.8]) b.seg(V(Math.cos(t) * rx, y + h, z + Math.sin(t) * rz), V(Math.cos(t) * rx, y - h, z + Math.sin(t) * rz), bone, 0);
      b.poly([V(-0.05, y + 0.03, z - rz), V(0, y - 0.04, z - rz - 0.14 - (i > 4 ? 0.05 : 0)), V(0.05, y + 0.03, z - rz)], col('#efe6d2', 0.2), false, 0);
      b.poly([V(-rx, y, z), V(-rx - 0.06, y - 0.01, z - 0.02)], col('#efe6d2', 0.15), false, 0);
      b.poly([V(rx, y, z), V(rx + 0.06, y - 0.01, z - 0.02)], col('#efe6d2', 0.15), false, 0);
    });
    for (let y = -1.52; y > -2.22; y -= 0.065) {
      const ring = [];
      for (let k = 0; k <= 16; k++) { const t = -2.6 + (k / 16) * 5.2; ring.push(V(Math.sin(t) * 0.085, y, 0.14 + Math.cos(t) * 0.075)); }
      b.poly(ring, bone, false, 0, [0, Math.max(0.15, 1 - (-1.52 - y) / 0.7), 0]);
    }
    b.poly([V(-0.16, -1.2, 0.12), V(0, -1.33, 0.32), V(0.16, -1.2, 0.12)], boneHi, false, 0, LARYNX);
    b.poly([V(-0.16, -1.2, 0.12), V(-0.15, -1.45, 0.1), V(0, -1.45, 0.27), V(0.15, -1.45, 0.1), V(0.16, -1.2, 0.12)], bone, false, 0, LARYNX);
    b.poly([V(0, -1.33, 0.32), V(0, -1.45, 0.27)], bone, false, 0, LARYNX);
    const hy = [];
    for (let k = 0; k <= 16; k++) { const t = -1.2 + (k / 16) * 2.4; hy.push(V(Math.sin(t) * 0.2, -1.1, 0.12 + Math.cos(t) * 0.2)); }
    b.poly(hy, bone, false, 0, [0, 0.6, 0]);
    const cric = [];
    for (let k = 0; k <= 18; k++) { const t = (k / 18) * Math.PI * 2; cric.push(V(Math.sin(t) * 0.1, -1.5, 0.15 + Math.cos(t) * 0.09)); }
    b.poly(cric, bone, false, 0, LARYNX);
    const arch = (t, r) => V(r * 0.4 * Math.sin(t), 0, 0.12 + r * 0.66 * Math.cos(t));
    const lowB = [], alvB = [], mid = [];
    for (let k = 0; k <= 40; k++) {
      const t = -Math.PI / 2 + (k / 40) * Math.PI;
      const a = arch(t, 1.12), m = Math.abs(Math.sin(t));
      lowB.push(V(a.x, -1.01 + m * 0.13, a.z));
      alvB.push(V(a.x * 0.93, -0.68 + m * 0.03, a.z * 0.98 + 0.01));
      mid.push(V(a.x * 0.97, -0.85 + m * 0.07, a.z + 0.01));
    }
    b.poly(lowB, jawC, false, 1);
    b.poly(alvB, col('#ff9a3c', 0.6), false, 1);
    b.poly(mid, col('#ff9a3c', 0.3), false, 1);
    for (let k = 0; k <= 40; k += 4) b.seg(lowB[k], alvB[k], col('#ff9a3c', 0.35), 1);
    for (const sd of [-1, 1]) {
      const ang = lowB[sd < 0 ? 0 : 40], top = alvB[sd < 0 ? 0 : 40];
      const condyle = V(sd * 0.47, -0.1, -0.15), coronoid = V(sd * 0.42, -0.27, 0.08);
      b.poly([ang, V(sd * 0.5, -0.6, -0.2), condyle], jawC, false, 1);
      b.poly([top, V(sd * 0.44, -0.45, 0.05), coronoid], col('#ff9a3c', 0.6), false, 1);
      b.poly([condyle, V(sd * 0.45, -0.2, -0.05), coronoid], col('#ff9a3c', 0.45), false, 1);
    }
    const toothF = col('#efe6d2', 0.42), toothB = col('#efe6d2', 0.18);
    const teeth = (yTop, yBot, jw, r) => {
      const N = 14;
      for (let k = 0; k < N; k++) {
        const t0 = -Math.PI / 2 + 0.32 + ((k + 0.08) / N) * (Math.PI - 0.64);
        const t1 = -Math.PI / 2 + 0.32 + ((k + 0.92) / N) * (Math.PI - 0.64);
        const molar = Math.abs(k - (N - 1) / 2) > 3.5;
        const d = molar ? 0.055 : 0.03;
        const a0 = arch(t0, r), a1 = arch(t1, r);
        const n0 = V(Math.sin(t0) * 0.4, 0, Math.cos(t0) * 0.66).normalize().multiplyScalar(d);
        const n1 = V(Math.sin(t1) * 0.4, 0, Math.cos(t1) * 0.66).normalize().multiplyScalar(d);
        const yt = molar ? (yTop + yBot) / 2 + (yTop - yBot) * 0.3 : yTop;
        const yb = molar ? (yTop + yBot) / 2 - (yTop - yBot) * 0.3 : yBot;
        const c = [V(a0.x, yt, a0.z), V(a1.x, yt, a1.z), V(a1.x, yb, a1.z), V(a0.x, yb, a0.z)];
        const cb = c.map((v, i) => v.clone().sub(i === 1 || i === 2 ? n1 : n0));
        b.poly(c, toothF, true, jw);
        b.poly([cb[0], cb[1]], toothB, false, jw);
        b.seg(c[0], cb[0], toothB, jw); b.seg(c[1], cb[1], toothB, jw);
      }
    };
    teeth(-0.46, -0.565, 0, 1.0);
    teeth(-0.585, -0.67, 1, 0.95);
    return b.geometry();
  }

  update(params, level, t, dt, f0Rel) {
    const k30 = Math.min(1, dt * 30), k8 = Math.min(1, dt * 8);
    const open = Math.min(1, Math.max(0, params[OPEN]));
    this.jaw += (open * JAW_MAX - this.jaw) * k30;
    const lipD = Math.max(0, params[LIPD]), lipR = Math.min(1, Math.max(0, params[LIPR]));
    const jawDrop = 1.17 * Math.sin(open * JAW_MAX);
    const h = Math.min(0.34, (0.035 * lipD + 0.9 * jawDrop) * smooth(0.04, 0.32, lipD));
    this.mouth += (h - this.mouth) * Math.min(1, dt * 40);
    const voice = params[VOICE];
    const lv = Math.min(1, level * 5);
    const fr = Math.max(-1, Math.min(1, f0Rel || 0));
    this.larynx += ((voice > 0.05 ? fr * 0.07 : -0.01) - this.larynx) * k8;
    this.brow += ((voice > 0.05 ? Math.max(0, fr) * 0.05 + lv * 0.01 : 0) - this.brow) * Math.min(1, dt * 5);
    this.tilt += ((voice > 0.05 ? fr * 0.05 : 0) - this.tilt) * Math.min(1, dt * 2);
    this.inner.rotation.x = -this.tilt;
    for (const m of [this.mat, this.dynMat]) {
      m.uniforms.uMouth.value = this.mouth;
      m.uniforms.uLarynx.value = this.larynx;
      m.uniforms.uBrow.value = this.brow;
    }
    this.mat.uniforms.uJaw.value = this.jaw;
    this.mat.uniforms.uGain.value = 1.0 + lv * 0.15;
    this.nextBlink -= dt;
    if (this.nextBlink < 0) { this.blink = 1; this.nextBlink = 2.5 + Math.random() * 5; }
    this.blink = Math.max(0, this.blink - dt * 7);
    this.n = 0;
    this._tongue(params, lv);
    this._lips(lipR, lv);
    this._velum(params[VEL]);
    this._folds(voice, params[ASP], lv, t);
    this._rings(lv);
    this._lids();
    this.dynGeo.setDrawRange(0, this.n * 2);
    this.dynGeo.attributes.position.needsUpdate = true;
    this.dynGeo.attributes.color.needsUpdate = true;
  }

  _seg(ax, ay, az, bx, by, bz, r, g, b) {
    if (this.n >= this.maxDyn) return;
    const o = this.n * 6, P = this.dPos, Cc = this.dCol;
    P[o] = ax; P[o + 1] = ay; P[o + 2] = az; P[o + 3] = bx; P[o + 4] = by; P[o + 5] = bz;
    Cc[o] = Cc[o + 3] = r; Cc[o + 1] = Cc[o + 4] = g; Cc[o + 2] = Cc[o + 5] = b;
    this.n++;
  }

  _tongue(params, lv) {
    const N = 40;
    tractShape(params, N, this.diam);
    const w = V(0, 0, 0), nr = V(0, 0, 0);
    const lines = this.tongue.length, L = 32;
    const u0 = 0.13, u1 = 0.885;
    for (let k = 0; k < L; k++) {
      const u = u0 + (k / (L - 1)) * (u1 - u0);
      wallAt(u, w, nr);
      const di = Math.min(N - 1, Math.max(0, Math.round(u * N - 0.5)));
      const d = this.diam[di] / 10 + 0.012;
      const tip = k >= L - 4 ? (k - (L - 4)) / 3 : 0;
      const halfW = 0.21 * Math.sin(Math.min(1, (k + 1) / (L * 0.22)) * Math.PI / 2) * (1 - tip * 0.6);
      for (let li = 0; li < lines; li++) {
        const s = (li / (lines - 1)) * 2 - 1;
        const drop = s * s * 0.06 + tip * tip * 0.06;
        const a = this.tongue[li];
        a[k * 3] = s * halfW;
        a[k * 3 + 1] = w.y + nr.y * (d + drop);
        a[k * 3 + 2] = w.z + nr.z * (d + drop);
      }
    }
    const glow = 0.85 + lv * 0.3;
    const tc = this.tc;
    for (let li = 0; li < lines; li++) {
      tc.setHSL((0.3 + (li / (lines - 1)) * 0.55) % 1, 1, 0.55).multiplyScalar(glow);
      const a = this.tongue[li];
      for (let k = 0; k < L - 1; k++) this._seg(a[k * 3], a[k * 3 + 1], a[k * 3 + 2], a[k * 3 + 3], a[k * 3 + 4], a[k * 3 + 5], tc.r, tc.g, tc.b);
    }
    for (let k = 1; k < L; k += 2) {
      for (let li = 0; li < lines - 1; li++) {
        const a = this.tongue[li], c2 = this.tongue[li + 1];
        this._seg(a[k * 3], a[k * 3 + 1], a[k * 3 + 2], c2[k * 3], c2[k * 3 + 1], c2[k * 3 + 2], 0.2 * glow, 0.45 * glow, 0.4 * glow);
      }
    }
    const jc = Math.cos(this.jaw), js = Math.sin(this.jaw);
    const mid = this.tongue[(lines - 1) >> 1];
    for (let k = 4; k < L - 3; k += 3) {
      const fy = -0.86, fz = 0.12 + (k / L) * 0.6;
      const py = fy - PIVOT.y, pz = fz - PIVOT.z;
      const ry = py * jc - pz * js + PIVOT.y, rz = py * js + pz * jc + PIVOT.z;
      this._seg(mid[k * 3], mid[k * 3 + 1], mid[k * 3 + 2], 0, ry, rz, 0.12 * glow, 0.4 * glow, 0.3 * glow);
    }
  }

  _lips(lipR, lv) {
    const h = this.mouth;
    const spread = (1 - lipR) * Math.min(1, Math.max(0, (h - 0.12) / 0.15));
    const W = 0.235 * (1 - 0.4 * lipR) * (1 + 0.1 * spread);
    const pz = 0.07 * lipR;
    const jc = Math.cos(this.jaw), js = Math.sin(this.jaw);
    const jawDrop = 1.17 * Math.sin(this.jaw);
    const tmp = [0, 0];
    const rot = (y, z) => { const py = y - PIVOT.y, qz = z - PIVOT.z; tmp[0] = py * jc - qz * js + PIVOT.y; tmp[1] = py * js + qz * jc + PIVOT.z; return tmp; };
    const M = 26;
    const pts = [[], [], [], [], [], []];
    for (let k = 0; k <= M; k++) {
      const s = (k / M) * 2 - 1;
      const x = s * W;
      const e = Math.max(0, 1 - s * s);
      const env = Math.pow(e, 0.55 - 0.25 * lipR);
      const zx = zFace(x, STOMION) + 0.012 + pz * e;
      const ui = STOMION + h * 0.3 * env;
      const um = ui + 0.035 * Math.sqrt(e);
      const uo = STOMION + 0.07 * Math.pow(e, 0.45) + h * 0.22 * env - 0.014 * Math.exp(-((s / 0.13) ** 2)) + 0.01;
      const liy = STOMION - (h * 0.7 - jawDrop) * env;
      pts[0].push([x, uo, zx - 0.012]);
      pts[1].push([x, um, zx + 0.002]);
      pts[2].push([x, ui, zx + 0.004]);
      rot(liy, zx + 0.005); pts[3].push([x, tmp[0], tmp[1]]);
      rot(liy - 0.04 * Math.sqrt(e), zx); pts[4].push([x, tmp[0], tmp[1]]);
      rot(liy - 0.085 * Math.pow(e, 0.45) - 0.012, zx - 0.02); pts[5].push([x, tmp[0], tmp[1]]);
    }
    const g = 0.95 + lv * 0.2;
    const shades = [0.55, 0, 1.0, 1.0, 0, 0.55];
    for (let r = 0; r < 6; r++) {
      if (!shades[r]) continue;
      const a = pts[r], sh = shades[r] * g;
      for (let k = 0; k < M; k++) this._seg(a[k][0], a[k][1], a[k][2], a[k + 1][0], a[k + 1][1], a[k + 1][2], 1.0 * sh, 0.32 * sh, 0.85 * sh);
    }
    for (let k = 2; k < M - 1; k += 3) {
      for (const [r0, r1] of [[0, 2], [3, 5]]) {
        const a = pts[r0][k], c = pts[r1][k];
        this._seg(a[0], a[1], a[2], c[0], c[1], c[2], 0.22 * g, 0.07 * g, 0.19 * g);
      }
    }
  }

  _velum(vel) {
    const vb = V(0, 0, 0);
    wallAt(0.6, vb);
    const vAng = 0.35 + vel * 0.6;
    for (const off of [0, 0.025]) {
      let py = vb.y - off, pz = vb.z;
      for (let k = 1; k <= 8; k++) {
        const t = k / 8, len = 0.24 * t;
        const y = vb.y - off - Math.sin(vAng + t * 0.5) * len, z = vb.z - Math.cos(vAng + t * 0.5) * len * 0.9;
        this._seg(0, py, pz, 0, y, z, 0.7, 0.32, 0.56);
        py = y; pz = z;
      }
    }
  }

  _folds(voice, asp, lv, t) {
    const fy = -1.33 + this.larynx;
    const vib = voice > 0.05 ? 0.008 + Math.abs(Math.sin(t * 140)) * 0.012 * lv : 0.045 + asp * 0.03;
    const fc = 0.5 + lv * 0.8;
    for (const sd of [-1, 1]) {
      this._seg(0, fy, 0.27, sd * vib, fy, 0.09, fc, fc * 0.85, fc * 0.55);
      this._seg(sd * vib, fy, 0.09, sd * 0.09, fy - 0.01, 0.1, fc * 0.4, fc * 0.34, fc * 0.2);
    }
  }

  _rings(lv) {
    const c = 0.05 + lv * 0.35;
    if (c < 0.06) return;
    const w = V(0, 0, 0), nr = V(0, 0, 0);
    const N = 40;
    for (let r = 0; r < 12; r++) {
      const u = 0.05 + (r / 11) * 0.86;
      wallAt(u, w, nr);
      const di = Math.min(N - 1, Math.max(0, Math.round(u * N - 0.5)));
      const rad = this.diam[di] / 20;
      const cy = w.y + nr.y * rad, cz = w.z + nr.z * rad;
      let px = 0, py = 0, pz = 0;
      for (let k = 0; k <= 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        const ca = Math.cos(a) * rad, sa = Math.sin(a) * Math.max(rad, 0.004) * 1.25;
        const y = cy + nr.y * ca, z = cz + nr.z * ca;
        if (k) this._seg(px, py, pz, sa, y, z, 0.3 * c, 1.0 * c, 0.7 * c);
        px = sa; py = y; pz = z;
      }
    }
  }

  _lids() {
    if (this.blink <= 0) return;
    const bk = Math.sin(this.blink * Math.PI);
    const C = this.color;
    for (const ex of [-0.29, 0.29]) {
      let p0 = null;
      for (let k = 0; k <= 12; k++) {
        const x = ex - 0.13 + (k / 12) * 0.26, y = 0.26 - bk * 0.09 * Math.sin((k / 12) * Math.PI);
        const z = 0.86 - Math.abs(x) * 0.25;
        if (p0) this._seg(p0[0], p0[1], p0[2], x, y, z, C.r * 0.8, C.g * 0.8, C.b * 0.8);
        p0 = [x, y, z];
      }
    }
  }

  mouthPoint(out) {
    out.set(0, STOMION, 1.06);
    return this.inner.localToWorld(out);
  }

  dispose() {
    this.staticLines.geometry.dispose();
    this.dynGeo.dispose();
    this.mat.dispose(); this.dynMat.dispose();
  }
}
