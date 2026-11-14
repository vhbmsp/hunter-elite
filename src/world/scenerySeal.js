import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Quaternius nature trunks/logs ship as open shells (missing end caps). Materials
 * named Tree/Wood get sealed so solid cover stays opaque from every angle.
 */
export function shouldSealSceneryMaterial(material) {
  const name = material?.name || '';
  return /^(Tree|Wood)$/i.test(name);
}

/** Copy meshopt interleaved attributes into plain BufferAttributes. */
function toPlainGeometry(geometry) {
  const attrs = {};
  for (const name of Object.keys(geometry.attributes)) {
    const attr = geometry.attributes[name];
    const arr = new Float32Array(attr.count * attr.itemSize);
    for (let i = 0; i < attr.count; i++) {
      arr[i * attr.itemSize] = attr.getX(i);
      if (attr.itemSize > 1) arr[i * attr.itemSize + 1] = attr.getY(i);
      if (attr.itemSize > 2) arr[i * attr.itemSize + 2] = attr.getZ(i);
      if (attr.itemSize > 3) arr[i * attr.itemSize + 3] = attr.getW(i);
    }
    attrs[name] = new THREE.BufferAttribute(arr, attr.itemSize);
  }
  const out = new THREE.BufferGeometry();
  for (const [key, value] of Object.entries(attrs)) out.setAttribute(key, value);
  if (geometry.index) {
    out.setIndex(Array.from({ length: geometry.index.count }, (_, i) => geometry.index.getX(i)));
  }
  return out;
}

function edgeKey(a, b) {
  return a < b ? `${a},${b}` : `${b},${a}`;
}

/** Drop zero-area / collapsed triangles so they don't fake boundary edges. */
function stripDegenerateTriangles(geometry) {
  const index = geometry.index;
  if (!index) return geometry;
  const clean = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    if (a === b || b === c || c === a) continue;
    clean.push(a, b, c);
  }
  if (clean.length === index.count) return geometry;
  const next = geometry.clone();
  next.setIndex(clean);
  return next;
}

/** Closed boundary loops from edges that appear in exactly one triangle. */
function boundaryLoops(geometry) {
  const index = geometry.index;
  if (!index) return [];

  const edgeCount = new Map();
  const addEdge = (a, b) => {
    if (a === b) return;
    const key = edgeKey(a, b);
    edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
  };
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    addEdge(a, b);
    addEdge(b, c);
    addEdge(c, a);
  }

  const adj = new Map();
  for (const [key, count] of edgeCount) {
    if (count !== 1) continue;
    const [a, b] = key.split(',').map(Number);
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b);
    adj.get(b).push(a);
  }

  const loops = [];
  const visitedEdge = new Set();
  for (const [key, count] of edgeCount) {
    if (count !== 1 || visitedEdge.has(key)) continue;
    const [startA, startB] = key.split(',').map(Number);
    const loop = [startA];
    const trail = [key];
    let prev = startA;
    let cur = startB;

    while (cur !== startA) {
      loop.push(cur);
      const nexts = adj.get(cur) || [];
      let advanced = false;
      for (const nxt of nexts) {
        if (nxt === prev) continue;
        const nextKey = edgeKey(cur, nxt);
        if (trail.includes(nextKey) || visitedEdge.has(nextKey)) continue;
        trail.push(nextKey);
        prev = cur;
        cur = nxt;
        advanced = true;
        break;
      }
      if (!advanced || loop.length > 5000) break;
    }

    // Only consume edges when the walk closes; failed walks must not orphan slits.
    if (loop.length >= 3 && cur === startA) {
      for (const e of trail) visitedEdge.add(e);
      loops.push(loop);
    }
  }

  return loops;
}

function countBoundaryEdges(geometry) {
  const index = geometry.index;
  if (!index) return 0;
  const edgeCount = new Map();
  const addEdge = (a, b) => {
    if (a === b) return;
    const key = edgeKey(a, b);
    edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
  };
  for (let i = 0; i < index.count; i += 3) {
    addEdge(index.getX(i), index.getX(i + 1));
    addEdge(index.getX(i + 1), index.getX(i + 2));
    addEdge(index.getX(i + 2), index.getX(i));
  }
  let count = 0;
  for (const n of edgeCount.values()) if (n === 1) count += 1;
  return count;
}

function fanCapLoops(geometry, loops) {
  if (!loops.length) return geometry;

  const pos = geometry.attributes.position;
  const positions = Array.from(pos.array);
  const indices = Array.from(geometry.index.array);
  const hasUv = Boolean(geometry.attributes.uv);
  const uvs = hasUv ? Array.from(geometry.attributes.uv.array) : null;

  for (const loop of loops) {
    // Three-vert holes: fill with the triangle itself (also closes zero-area slits).
    if (loop.length === 3) {
      indices.push(loop[0], loop[1], loop[2]);
      continue;
    }

    const centroid = new THREE.Vector3();
    for (const i of loop) {
      centroid.add(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
    }
    centroid.multiplyScalar(1 / loop.length);

    const loopNormal = new THREE.Vector3();
    for (let i = 0; i < loop.length; i++) {
      const a = new THREE.Vector3().fromBufferAttribute(pos, loop[i]);
      const b = new THREE.Vector3().fromBufferAttribute(pos, loop[(i + 1) % loop.length]);
      loopNormal.add(
        new THREE.Vector3().subVectors(a, centroid).cross(new THREE.Vector3().subVectors(b, centroid)),
      );
    }
    // Near-collinear slits still get a fan so their edges stop counting as open.
    if (loopNormal.lengthSq() > 1e-20) loopNormal.normalize();
    else loopNormal.set(0, 1, 0);

    const centerIndex = positions.length / 3;
    positions.push(centroid.x, centroid.y, centroid.z);
    if (uvs) {
      let u = 0;
      let v = 0;
      for (const i of loop) {
        u += uvs[i * 2];
        v += uvs[i * 2 + 1];
      }
      uvs.push(u / loop.length, v / loop.length);
    }

    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      if (a === b) continue;
      const ab = new THREE.Vector3(
        pos.getX(b) - pos.getX(a),
        pos.getY(b) - pos.getY(a),
        pos.getZ(b) - pos.getZ(a),
      );
      const ac = new THREE.Vector3(
        centroid.x - pos.getX(a),
        centroid.y - pos.getY(a),
        centroid.z - pos.getZ(a),
      );
      const triNormal = new THREE.Vector3().crossVectors(ab, ac);
      if (triNormal.dot(loopNormal) >= 0) indices.push(a, b, centerIndex);
      else indices.push(a, centerIndex, b);
    }
  }

  const next = new THREE.BufferGeometry();
  next.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (uvs) next.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  next.setIndex(indices);
  return next;
}

/**
 * Merge nearby verts and fan-cap every open boundary loop so trunks/logs are
 * closed solids (no hollow cut ends or see-through tubes).
 */
export function sealOpenShell(geometry) {
  let geo = toPlainGeometry(geometry);
  // Weld with normals/uvs kept so thin trunk features are not collapsed into
  // open chains. Meshopt position-duplicates with matching attrs still merge.
  // Do not re-weld after capping — that creates degenerate boundary slits.
  geo = mergeVertices(geo, 1e-4);
  geo = stripDegenerateTriangles(geo);

  for (let pass = 0; pass < 3; pass++) {
    const loops = boundaryLoops(geo);
    if (!loops.length) break;
    geo = fanCapLoops(geo, loops);
    geo = stripDegenerateTriangles(geo);
  }

  geo.deleteAttribute('normal');
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** Seal Tree/Wood shells; leave other materials untouched. */
export function prepareSceneryGeometry(geometry, material) {
  if (!shouldSealSceneryMaterial(material)) return geometry;
  return sealOpenShell(geometry);
}

/** Debug / tests: how many open edges remain after sealing. */
export function getBoundaryEdgeCount(geometry) {
  return countBoundaryEdges(stripDegenerateTriangles(geometry));
}
