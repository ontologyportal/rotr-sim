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

/** Mainland spans the entire north border, overlapping the sea to hide its edge. */
export function createDistantCoastline() {
  const segments = 320, rows = 32;
  const vertices: number[] = [], colors: number[] = [], indices: number[] = [];
  const rock = new THREE.Color(0x777c70);
  const vegetation = new THREE.Color(0x405a50);
  const ridge = new THREE.Color(0x657775);
  const color = new THREE.Color();
  for (let row = 0; row <= rows; row++) {
    const inland = row / rows;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = (t * 2 - 1) * (OCEAN_HALF_SIZE + 7000);
      const shoreline = -OCEAN_HALF_SIZE + 3200
        + 1000 * Math.sin(t * 19) + 380 * Math.sin(t * 53 + 1);
      const profile = Math.pow(Math.sin(inland * Math.PI * 0.85), 1.3);
      const peaks = 2300 + 850 * Math.sin(t * 15 + inland * 4)
        + 420 * Math.sin(t * 39 - inland * 7) + 180 * Math.sin(t * 97 + inland * 13);
      // Only the seaward row is submerged; inland terrain stays above the water
      // all the way across its northern boundary, forming a continuous mainland.
      const height = row === 0 ? -35 : 90 + profile * peaks;
      vertices.push(x, height, shoreline - inland * 16000);
      color.copy(rock).lerp(vegetation, Math.min(1, inland * 8))
        .lerp(ridge, THREE.MathUtils.smoothstep(height, 1000, 3200));
      colors.push(color.r, color.g, color.b);
      if (row < rows && i < segments) {
        const a = row * (segments + 1) + i, b = a + segments + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const coast = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide,
  }));
  coast.name = "Distant northern coastline";
  return coast;
}
