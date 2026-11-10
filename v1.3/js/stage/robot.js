// Wire Choir robot head: hand-built metal head with visor eyes, hinged jaw, LED equalizer mouth and neon panel lines.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { OPEN, LIPD, LIPR, VOICE } from '../voice/engine.js';

const JAW_PIVOT = new THREE.Vector3(0, -0.19, -0.5);

export class RobotHead {
  constructor(opts) {
    this.group = new THREE.Group();
    this.inner = new THREE.Group();
    this.group.add(this.inner);
    this.inner.scale.setScalar(0.86);
    this.inner.position.y = -0.05;
    this.color = new THREE.Color(opts.color || '#4fd2ff');
    this.wordColor = opts.wordColor || '#7dffb6';
    this.jaw = 0; this.tilt = 0; this.level = 0;
    this.disposables = [];
    const env = opts.env || null;
    const metal = this.track(new THREE.MeshStandardMaterial({ color: 0x1b1f26, metalness: 0.9, roughness: 0.3, envMap: env, envMapIntensity: 1.2 }));
    const dark = this.track(new THREE.MeshStandardMaterial({ color: 0x0b0d11, metalness: 0.6, roughness: 0.55, envMap: env, envMapIntensity: 0.6 }));
    this.glow = this.track(new THREE.MeshBasicMaterial({ color: this.color.clone() }));
    this.eyeMat = this.track(new THREE.MeshBasicMaterial({ color: this.color.clone() }));
    this.ledMat = this.track(new THREE.MeshBasicMaterial({ color: new THREE.Color(this.wordColor) }));
    const edge = this.track(new THREE.LineBasicMaterial({ color: this.color.clone().multiplyScalar(0.55), transparent: true, opacity: 0.9 }));
    const box = (w, h, d, r, mat, x, y, z, parent = this.inner) => {
      const g = this.track(new RoundedBoxGeometry(w, h, d, 3, r));
      const m = new THREE.Mesh(g, mat);
      m.position.set(x, y, z);
      parent.add(m);
      const e = new THREE.LineSegments(this.track(new THREE.EdgesGeometry(g, 30)), edge);
      e.position.copy(m.position);
      parent.add(e);
      return m;
    };
    box(1.46, 1.32, 1.56, 0.3, metal, 0, 0.47, -0.04);
    const band = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.86, 0.86, 0.34, 64, 1, true, -1.15, 2.3)), dark);
    band.scale.set(0.86, 1, 0.97);
    band.position.set(0, 0.42, 0.0);
    this.inner.add(band);
    const strip = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.87, 0.87, 0.05, 64, 1, true, -1.1, 2.2)), this.glow);
    strip.scale.set(0.86, 1, 0.97);
    strip.position.set(0, 0.33, 0.0);
    this.inner.add(strip);
    this.scan = strip;
    this.eyes = [];
    for (const a of [-0.32, 0.32]) {
      const e = new THREE.Mesh(this.track(new THREE.CircleGeometry(0.095, 32)), this.eyeMat);
      const x = Math.sin(a) * 0.86 * 0.86, z = Math.cos(a) * 0.86 * 0.97 + 0.005;
      e.position.set(x, 0.45, z);
      e.rotation.y = a;
      this.inner.add(e);
      const ring = new THREE.Mesh(this.track(new THREE.RingGeometry(0.12, 0.135, 40)), this.glow);
      ring.position.set(x, 0.45, z + 0.001);
      ring.rotation.y = a;
      this.inner.add(ring);
      this.eyes.push(e);
    }
    for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) {
      const v = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.01, 0.03, 0.36)), this.glow);
      v.position.set(sx * 0.735, 0.82 - i * 0.07, -0.42);
      this.inner.add(v);
    }
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.24, 0.24, 0.16, 40)), metal);
      ear.rotation.z = Math.PI / 2;
      ear.position.set(sx * 0.78, 0.3, -0.05);
      this.inner.add(ear);
      const ring = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.17, 0.014, 8, 48)), this.glow);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(sx * 0.87, 0.3, -0.05);
      this.inner.add(ring);
    }
    const ant = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 8)), metal);
    ant.position.set(0.32, 1.32, -0.25);
    this.inner.add(ant);
    this.tip = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.05, 16, 12)), this.ledMat.clone());
    this.track(this.tip.material);
    this.tip.position.set(0.32, 1.55, -0.25);
    this.inner.add(this.tip);
    const cavity = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.9, 0.24, 0.78)), this.track(new THREE.MeshBasicMaterial({ color: 0x020304 })));
    cavity.position.set(0, -0.24, 0.24);
    this.inner.add(cavity);
    this.leds = [];
    for (let i = 0; i < 11; i++) {
      const led = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.055, 1, 0.02)), this.ledMat);
      led.position.set(-0.4 + i * 0.08, -0.24, 0.64);
      led.scale.y = 0.02;
      this.inner.add(led);
      this.leds.push(led);
    }
    this.jawG = new THREE.Group();
    this.jawG.position.copy(JAW_PIVOT);
    this.inner.add(this.jawG);
    const j = new THREE.Group();
    j.position.set(-JAW_PIVOT.x, -JAW_PIVOT.y, -JAW_PIVOT.z);
    this.jawG.add(j);
    box(1.24, 0.4, 1.3, 0.15, metal, 0, -0.4, 0.08, j);
    box(0.9, 0.05, 0.05, 0.02, dark, 0, -0.24, 0.73, j);
    for (let i = 0; i < 5; i++) {
      const slot = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.62, 0.012, 0.01)), this.glow);
      slot.position.set(0, -0.36 - i * 0.04, 0.735);
      j.add(slot);
    }
    for (const sx of [-1, 1]) {
      const hinge = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 24)), dark);
      hinge.rotation.z = Math.PI / 2;
      hinge.position.set(sx * 0.62, -0.22, -0.48);
      this.inner.add(hinge);
    }
    for (let i = 0; i < 4; i++) {
      const r = 0.34 - i * 0.02;
      const n = new THREE.Mesh(this.track(new THREE.CylinderGeometry(r, r + 0.02, 0.2, 40)), i % 2 ? dark : metal);
      n.position.set(0, -0.72 - i * 0.22, -0.1);
      this.inner.add(n);
      const ring = new THREE.Mesh(this.track(new THREE.TorusGeometry(r + 0.012, 0.008, 6, 48)), this.glow);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, -0.62 - i * 0.22, -0.1);
      this.inner.add(ring);
    }
    const hemi = new THREE.HemisphereLight(0x9fb4c8, 0x020306, 0.7);
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2.5, 3, 4);
    const rim = new THREE.DirectionalLight(this.color, 3.2);
    rim.position.set(-3, 1.5, -3.5);
    this.group.add(hemi, key, rim);
  }

  track(o) { this.disposables.push(o); return o; }

  update(params, level, t, dt, f0Rel) {
    const open = Math.min(1, Math.max(0, params[OPEN]));
    const lipD = Math.max(0, params[LIPD]);
    const target = Math.max(open * 0.36, Math.min(0.4, lipD * 0.1)) * (lipD < 0.15 ? 0.15 : 1);
    this.jaw += (target - this.jaw) * Math.min(1, dt * 28);
    this.jawG.rotation.x = this.jaw;
    const lv = Math.min(1, level * 5);
    this.level += (lv - this.level) * Math.min(1, dt * 20);
    const voice = params[VOICE];
    const round = params[LIPR];
    this.leds.forEach((led, i) => {
      const c = (i - 5) / 5;
      const shape = round > 0.5 ? Math.exp(-c * c * 6) : 1 - c * c * 0.45;
      const flick = 0.75 + 0.25 * Math.sin(t * 23 + i * 1.7);
      led.scale.y = 0.02 + this.level * 0.24 * shape * flick * (voice > 0.03 ? 1 : 0.3);
    });
    const e = 0.35 + this.level * 1.6;
    this.eyeMat.color.copy(this.color).multiplyScalar(e);
    this.scan.material.color.copy(this.color).multiplyScalar(0.55 + 0.45 * Math.abs(Math.sin(t * 2.1)) + this.level * 0.8);
    this.tip.material.color.set(this.wordColor).multiplyScalar(0.25 + (Math.sin(t * 3) > 0.6 ? 1 : 0.1));
    const fr = Math.max(-1, Math.min(1, f0Rel || 0));
    this.tilt += ((voice > 0.05 ? fr * 0.06 : 0) - this.tilt) * Math.min(1, dt * 2);
    this.inner.rotation.x = -this.tilt;
    this.inner.rotation.z = Math.sin(t * 0.8) * 0.01;
  }

  setDepth() {}

  mouthPoint(out) {
    out.set(0, -0.12 - this.jaw * 0.3, 0.86);
    return this.inner.localToWorld(out);
  }

  dispose() { for (const d of this.disposables) d.dispose && d.dispose(); }
}
