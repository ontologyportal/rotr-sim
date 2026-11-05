import * as THREE from "three";

const OCEAN_HALF_SIZE = 25000;

/** Retain the detailed central sea, extending its border beyond the encounter. */
export function createOceanGeometry() {
  const geometry = new THREE.PlaneGeometry(14000, 14000, 384, 384);
  const positions = geometry.getAttribute("position");
  const extend = (value: number) => Math.sign(value) * (
    Math.abs(value) <= 6000 ? Math.abs(value) : 6000 + (Math.abs(value) - 6000) * (OCEAN_HALF_SIZE - 6000) / 1000
  );
  for (let i = 0; i < positions.count; i++) {
    positions.setXY(i, extend(positions.getX(i)), extend(positions.getY(i)));
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// Stable, smoothly interpolated noise gives the terrain irregular valleys rather
// than repeating waves. It also keeps buildings aligned with the same ground.
function terrainNoise(x: number, z: number) {
  const hash = (a: number, b: number) => {
    const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(hash(ix, iz), hash(ix + 1, iz), u),
    THREE.MathUtils.lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), u), v,
  );
}

function shorelineAt(x: number) {
  // A broad headland brings the waterfront into view while bays recede on
  // either side. The mainland still covers the complete northern water edge.
  const headland = 17800 * Math.exp(-Math.pow((x + 5000) / 10500, 2));
  return -OCEAN_HALF_SIZE + 3200 + headland
    + (terrainNoise(x / 1800, 7) - 0.5) * 850;
}

function landHeight(x: number, inland: number) {
  if (inland === 0) return -25;
  const coastalPlain = 12 + inland * 0.025;
  const foothills = THREE.MathUtils.smoothstep(inland, 650, 6500);
  const broad = terrainNoise(x / 2600, inland / 1900);
  const detail = terrainNoise(x / 650, inland / 750);
  return coastalPlain + foothills * (220 + broad * 1250 + detail * 260);
}

/** Trondheim-inspired faceted fjord hills, low waterfront blocks and quays. */
export function createDistantCoastline() {
  const coast = new THREE.Group();
  coast.name = "Northern fjord coastline";
  const segments = 420, rows = 64;
  const vertices: number[] = [], colors: number[] = [], indices: number[] = [];
  const rock = new THREE.Color(0xb5b5c1);
  const vegetation = new THREE.Color(0x839184);
  const ridge = new THREE.Color(0xc3c4ce);
  const color = new THREE.Color();
  for (let row = 0; row <= rows; row++) {
    const inland = Math.pow(row / rows, 1.7) * 24000;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = (t * 2 - 1) * (OCEAN_HALF_SIZE + 7000);
      const height = landHeight(x, inland);
      vertices.push(x, height, shorelineAt(x) - inland);
      color.copy(vegetation).lerp(rock, THREE.MathUtils.smoothstep(height, 120, 650))
        .lerp(ridge, THREE.MathUtils.smoothstep(height, 750, 1700));
      color.multiplyScalar(0.9 + terrainNoise(x / 400, inland / 450) * 0.16);
      colors.push(color.r, color.g, color.b);
      if (row < rows && i < segments) {
        const a = row * (segments + 1) + i, b = a + segments + 1;
        if ((row + i) % 2) indices.push(a, a + 1, b + 1, a, b + 1, b);
        else indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const terrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1, metalness: 0, flatShading: true, side: THREE.DoubleSide,
  }));
  terrain.name = "Faceted fjord hills";
  coast.add(terrain);

  // Share geometry and materials across the town to keep the waterfront cheap
  // to render, including in the ocean's reflection pass.
  const settlements = [-22500, -15500, -9700, -6500, -3200, 900, 8500, 17500];
  const count = settlements.length * 12 * 10;
  const box = new THREE.BoxGeometry(1, 1, 1);
  const buildings = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.95,
  }), count);
  const roofs = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({
    color: 0x48505a, roughness: 1,
  }), count);
  const quays = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({
    color: 0x85868a, roughness: 1,
  }), settlements.length * 3);
  buildings.name = "Waterfront town blocks";
  roofs.name = "Slate waterfront roofs";
  quays.name = "Harbor quays and piers";
  const transform = new THREE.Object3D();
  const palette = [0xd5d1c7, 0xbcbfc2, 0xe0ddd4, 0xa8b0b4, 0xb7a092, 0xc4b99d];
  const place = (mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number, w: number, h: number, d: number) => {
    transform.position.set(x, y, z);
    transform.scale.set(w, h, d);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
  };
  let index = 0;
  settlements.forEach((center, settlement) => {
    for (let row = 0; row < 10; row++) for (let column = 0; column < 12; column++) {
      const x = center + (column - 5.5) * 100;
      const inland = 140 + row * 100;
      const z = shorelineAt(x) - inland;
      const ground = landHeight(x, inland);
      const seed = terrainNoise(column * 3.7 + settlement * 19, row * 5.1);
      const height = 16 + seed * 42;
      const width = 36 + seed * 34, depth = 32 + (1 - seed) * 30;
      // Bury the foundations slightly to accommodate the triangulated ground.
      place(buildings, index, x, ground + height / 2 - 5, z, width, height + 10, depth);
      buildings.setColorAt(index, color.setHex(palette[Math.floor(seed * palette.length)]));
      place(roofs, index, x, ground + height + 1.5, z, width + 3, 3, depth + 3);
      index++;
    }
    const shore = shorelineAt(center);
    place(quays, settlement * 3, center, 4, shore - 25, 1250, 12, 80);
    for (let pier = 0; pier < 2; pier++) {
      const x = center + (pier ? 370 : -370);
      place(quays, settlement * 3 + pier + 1, x, 4, shorelineAt(x) + 90, 42, 12, 260);
    }
  });
  [buildings, roofs, quays].forEach(mesh => {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    coast.add(mesh);
  });
  if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
  return coast;
}
