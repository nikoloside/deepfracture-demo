export interface ParsedOBJ {
  positions: Float32Array;
  normals: Float32Array;
}

interface FaceIndex {
  vertexIndex: number;
  normalIndex?: number;
}

/**
 * Minimal Wavefront OBJ parser that supports vertices, normals, and triangular/quadrilateral faces.
 * Faces with more than three vertices are fan-triangulated.
 */
export function parseOBJ(source: string): ParsedOBJ {
  const vertexPositions: number[][] = [];
  const vertexNormals: number[][] = [];
  const positionBuffer: number[] = [];
  const normalBuffer: number[] = [];

  const lines = source.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const segments = line.split(/\s+/);
    const identifier = segments[0];

    if (identifier === "v") {
      const [, x, y, z] = segments;
      vertexPositions.push([parseFloat(x), parseFloat(y), parseFloat(z)]);
    } else if (identifier === "vn") {
      const [, x, y, z] = segments;
      vertexNormals.push([parseFloat(x), parseFloat(y), parseFloat(z)]);
    } else if (identifier === "f") {
      const faceVertices = segments.slice(1).map(parseFaceToken);
      if (faceVertices.length < 3) {
        continue;
      }

      for (let i = 1; i < faceVertices.length - 1; i++) {
        const tri = [faceVertices[0], faceVertices[i], faceVertices[i + 1]];
        tri.forEach((faceIdx) => {
          const position = vertexPositions[faceIdx.vertexIndex];
          if (!position) {
            throw new Error(`Vertex index ${faceIdx.vertexIndex} missing in OBJ data`);
          }
          positionBuffer.push(position[0], position[1], position[2]);

          if (
            typeof faceIdx.normalIndex === "number" &&
            vertexNormals[faceIdx.normalIndex]
          ) {
            const normal = vertexNormals[faceIdx.normalIndex];
            normalBuffer.push(normal[0], normal[1], normal[2]);
          } else {
            normalBuffer.push(0, 0, 0);
          }
        });
      }
    }
  }

  if (!normalBuffer.some((value) => value !== 0)) {
    const computedNormals = computeFaceNormals(positionBuffer);
    normalBuffer.splice(0, normalBuffer.length, ...computedNormals);
  }

  return {
    positions: new Float32Array(positionBuffer),
    normals: new Float32Array(normalBuffer)
  };
}

function parseFaceToken(token: string): FaceIndex {
  const [v, , n] = token.split("/");
  const vertexIndex = parseInt(v, 10) - 1;
  const normalIndex = n ? parseInt(n, 10) - 1 : undefined;
  return { vertexIndex, normalIndex };
}

function computeFaceNormals(positionBuffer: number[]): number[] {
  const normals = new Array(positionBuffer.length).fill(0);

  for (let i = 0; i < positionBuffer.length; i += 9) {
    const ax = positionBuffer[i];
    const ay = positionBuffer[i + 1];
    const az = positionBuffer[i + 2];

    const bx = positionBuffer[i + 3];
    const by = positionBuffer[i + 4];
    const bz = positionBuffer[i + 5];

    const cx = positionBuffer[i + 6];
    const cy = positionBuffer[i + 7];
    const cz = positionBuffer[i + 8];

    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;

    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;

    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;

    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length;
    ny /= length;
    nz /= length;

    normals[i] = nx;
    normals[i + 1] = ny;
    normals[i + 2] = nz;
    normals[i + 3] = nx;
    normals[i + 4] = ny;
    normals[i + 5] = nz;
    normals[i + 6] = nx;
    normals[i + 7] = ny;
    normals[i + 8] = nz;
  }

  return normals;
}
