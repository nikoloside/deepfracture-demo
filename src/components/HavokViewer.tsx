import { useEffect, useRef, useState } from "react";
import { parseOBJ } from "../lib/objParser";
import {
  lookAt,
  multiply,
  perspective,
  scale,
  translation,
  type Mat4,
  type Vec3
} from "../lib/matrix";

const BASE_MODELS = {
  plane: { path: "/models/plane.obj" },
  sphere: { path: "/models/sphere.obj" }
} as const;

export const PRIMARY_MODELS = {
  squirrel: { label: "Squirrel", path: "/models/squirrel.obj", scale: 1.0 },
  lion: { label: "Lion", path: "/models/lion.obj", scale: 1.0 },
  pot: { label: "Pot", path: "/models/pot.obj", scale: 1.0 },
  bunny: { label: "Bunny", path: "/models/bunny.obj", scale: 1.0 },
  base: { label: "Base", path: "/models/base.obj", scale: 1.0 }
} as const;

export type PrimaryModel = keyof typeof PRIMARY_MODELS;

const GRAVITY = -9.8;
const SPHERE_RESTITUTION = 0.85;
const PLANE_RESTITUTION = 0.55;
const MAX_TIME_STEP = 0.05;
const LIGHT_DIRECTION: Vec3 = [0, 0, -1];

interface NormalizationData {
  matrix: Mat4;
  radius: number;
}

interface MeshResource {
  vao: WebGLVertexArrayObject;
  positionBuffer: WebGLBuffer;
  normalBuffer: WebGLBuffer;
  vertexCount: number;
  normalization: NormalizationData;
}

interface StaticInstance {
  resource: MeshResource;
  position: Vec3;
  scale: number;
}

interface SphereInstance extends StaticInstance {
  velocity: Vec3;
  radius: number;
}

interface CameraState {
  radius: number;
  yaw: number;
  pitch: number;
}

interface HavokViewerProps {
  primaryModel: PrimaryModel;
  running: boolean;
}

export function HavokViewer({ primaryModel, running }: HavokViewerProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposeScene: (() => void) | undefined;
    let animationId = 0;
    let canceled = false;

    async function bootstrap(): Promise<void> {
      try {
        const primaryMeta = PRIMARY_MODELS[primaryModel];
        const [planeSource, primarySource, sphereSource] = await Promise.all([
          fetchText(BASE_MODELS.plane.path),
          fetchText(primaryMeta.path),
          fetchText(BASE_MODELS.sphere.path)
        ]);

        if (canceled || !canvasRef.current) {
          return;
        }

        const planeParsed = parseOBJ(planeSource);
        const primaryParsed = parseOBJ(primarySource);
        const sphereParsed = parseOBJ(sphereSource);

        const canvas = canvasRef.current;
        const gl = canvas.getContext("webgl2");
        if (!gl) {
          throw new Error("WebGL2 not available in this browser");
        }

        const program = createProgram(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);
        const positionLoc = gl.getAttribLocation(program, "position");
        const normalLoc = gl.getAttribLocation(program, "normal");
        const mvpLoc = gl.getUniformLocation(program, "uModelViewProjection");
        const modelLoc = gl.getUniformLocation(program, "uModel");
        const lightLoc = gl.getUniformLocation(program, "uLightDirection");

        if (!mvpLoc || !modelLoc || !lightLoc) {
          throw new Error("Failed to locate essential shader uniforms");
        }

        const planeResource = createMeshResource(gl, planeParsed, positionLoc, normalLoc);
        const primaryResource = createMeshResource(gl, primaryParsed, positionLoc, normalLoc);
        const sphereResource = createMeshResource(gl, sphereParsed, positionLoc, normalLoc);

        const plane: StaticInstance = {
          resource: planeResource,
          position: [0, 0, 0] as Vec3,
          scale: 6
        };

        const primary: StaticInstance = {
          resource: primaryResource,
          position: [0, 0, 3] as Vec3,
          scale: primaryMeta.scale
        };

        const sphere: SphereInstance = {
          resource: sphereResource,
          position: [0, 0, 10] as Vec3,
          scale: 0.8,
          velocity: [0, 0, -4] as Vec3,
          radius: sphereResource.normalization.radius * 0.8
        };

        const primaryRadius = primary.resource.normalization.radius * primary.scale;
        const viewTarget: Vec3 = [0, 0, 0] as Vec3;
        const planeNormal: Vec3 = [0, 0, 1] as Vec3;

        const camera: CameraState = {
          radius: 18,
          yaw: 0,
          pitch: -Math.PI / 4
        };

        const alerted = new Set<string>();
        let lastTime = performance.now();
        let dragging = false;
        let lastX = 0;
        let lastY = 0;

        const ensureCanvasSize = () => {
          const pixelRatio = window.devicePixelRatio || 1;
          const displayWidth = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
          const displayHeight = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));
          if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
          }
          gl.viewport(0, 0, canvas.width, canvas.height);
        };

        const triggerAlert = (key: string, message: string) => {
          if (alerted.has(key)) {
            return;
          }
          alerted.add(key);
          setTimeout(() => {
            window.alert(message);
          }, 0);
        };

        const drawScene = () => {
          ensureCanvasSize();
          gl.clearColor(0.04, 0.07, 0.12, 1);
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
          gl.enable(gl.DEPTH_TEST);
          gl.useProgram(program);
          gl.uniform3f(lightLoc, LIGHT_DIRECTION[0], LIGHT_DIRECTION[1], LIGHT_DIRECTION[2]);

          const aspect = canvas.width / canvas.height || 1;
          const projection = perspective((45 * Math.PI) / 180, aspect, 0.1, 100);
          const view = lookAt(computeEye(camera), viewTarget, [0, 1, 0]);
          const viewProjection = multiply(projection, view);

          drawInstance(gl, plane, viewProjection, mvpLoc, modelLoc);
          drawInstance(gl, primary, viewProjection, mvpLoc, modelLoc);
          drawInstance(gl, sphere, viewProjection, mvpLoc, modelLoc);

          gl.bindVertexArray(null);
        };

        const step = (time: number) => {
          if (canceled) {
            return;
          }

          const deltaSeconds = Math.min(
            Math.max((time - lastTime) / 1000, 0),
            MAX_TIME_STEP
          );
          lastTime = time;

          sphere.velocity[2] += GRAVITY * deltaSeconds;

          sphere.position[0] += sphere.velocity[0] * deltaSeconds;
          sphere.position[1] += sphere.velocity[1] * deltaSeconds;
          sphere.position[2] += sphere.velocity[2] * deltaSeconds;

          const diffX = sphere.position[0] - primary.position[0];
          const diffY = sphere.position[1] - primary.position[1];
          const diffZ = sphere.position[2] - primary.position[2];
          const distance = Math.hypot(diffX, diffY, diffZ);
          const minDistance = sphere.radius + primaryRadius;

          if (distance <= minDistance) {
            const normal = distance > 0
              ? ([diffX / distance, diffY / distance, diffZ / distance] as Vec3)
              : ([0, 0, 1] as Vec3);

            const correction = minDistance - distance + 1e-4;
            sphere.position[0] += normal[0] * correction;
            sphere.position[1] += normal[1] * correction;
            sphere.position[2] += normal[2] * correction;

            const relativeVelocity =
              sphere.velocity[0] * normal[0] +
              sphere.velocity[1] * normal[1] +
              sphere.velocity[2] * normal[2];

            if (relativeVelocity < 0) {
              sphere.velocity[0] -= (1 + SPHERE_RESTITUTION) * relativeVelocity * normal[0];
              sphere.velocity[1] -= (1 + SPHERE_RESTITUTION) * relativeVelocity * normal[1];
              sphere.velocity[2] -= (1 + SPHERE_RESTITUTION) * relativeVelocity * normal[2];
            }

            triggerAlert(
              "primary",
              `Collision detected: sphere hit the ${primaryMeta.label.toLowerCase()} mesh.`
            );
          }

          if (sphere.position[2] - sphere.radius <= plane.position[2]) {
            sphere.position[2] = plane.position[2] + sphere.radius + 1e-4;
            const velocityAlongNormal =
              sphere.velocity[0] * planeNormal[0] +
              sphere.velocity[1] * planeNormal[1] +
              sphere.velocity[2] * planeNormal[2];
            if (velocityAlongNormal < 0) {
              sphere.velocity[0] -= (1 + PLANE_RESTITUTION) * velocityAlongNormal * planeNormal[0];
              sphere.velocity[1] -= (1 + PLANE_RESTITUTION) * velocityAlongNormal * planeNormal[1];
              sphere.velocity[2] -= (1 + PLANE_RESTITUTION) * velocityAlongNormal * planeNormal[2];
            }
            triggerAlert("plane", "Collision detected: sphere impacted the plane.");
          }

          drawScene();
          animationId = requestAnimationFrame(step);
        };

        const handlePointerDown = (event: PointerEvent) => {
          dragging = true;
          lastX = event.clientX;
          lastY = event.clientY;
          canvas.setPointerCapture(event.pointerId);
          canvas.classList.add("havok-viewer__canvas--dragging");
        };

        const handlePointerMove = (event: PointerEvent) => {
          if (!dragging) {
            return;
          }
          const deltaX = event.clientX - lastX;
          const deltaY = event.clientY - lastY;
          lastX = event.clientX;
          lastY = event.clientY;
          camera.yaw -= deltaX * 0.003;
          camera.pitch -= deltaY * 0.003;
          const clamp = Math.PI / 2 - 0.05;
          camera.pitch = Math.max(-clamp, Math.min(clamp, camera.pitch));
          drawScene();
        };

        const handlePointerUp = (event: PointerEvent) => {
          dragging = false;
          canvas.releasePointerCapture(event.pointerId);
          canvas.classList.remove("havok-viewer__canvas--dragging");
        };

        const handlePointerLeave = () => {
          dragging = false;
          canvas.classList.remove("havok-viewer__canvas--dragging");
        };

        const handleResize = () => {
          if (!running) {
            drawScene();
          } else {
            ensureCanvasSize();
          }
        };

        canvas.addEventListener("pointerdown", handlePointerDown);
        canvas.addEventListener("pointermove", handlePointerMove);
        canvas.addEventListener("pointerup", handlePointerUp);
        canvas.addEventListener("pointerleave", handlePointerLeave);
        window.addEventListener("resize", handleResize);

        drawScene();

        if (running) {
          lastTime = performance.now();
          animationId = requestAnimationFrame(step);
        }

        disposeScene = () => {
          cancelAnimationFrame(animationId);
          window.removeEventListener("resize", handleResize);
          canvas.removeEventListener("pointerdown", handlePointerDown);
          canvas.removeEventListener("pointermove", handlePointerMove);
          canvas.removeEventListener("pointerup", handlePointerUp);
          canvas.removeEventListener("pointerleave", handlePointerLeave);
          destroyMeshResource(gl, planeResource);
          destroyMeshResource(gl, primaryResource);
          destroyMeshResource(gl, sphereResource);
          gl.deleteProgram(program);
        };
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Unknown error while initialising Havok viewer");
        }
      }
    }

    bootstrap();

    return () => {
      canceled = true;
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      disposeScene?.();
    };
  }, [primaryModel, running]);

  return (
    <div className="havok-viewer">
      <canvas ref={canvasRef} className="havok-viewer__canvas" />
      {error ? <p className="havok-viewer__error">{error}</p> : null}
    </div>
  );
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return response.text();
}

const VERTEX_SHADER_SOURCE = `#version 300 es
in vec3 position;
in vec3 normal;
uniform mat4 uModelViewProjection;
uniform mat4 uModel;
uniform vec3 uLightDirection;
out vec3 vLighting;
void main() {
  vec3 transformedNormal = normalize((uModel * vec4(normal, 0.0)).xyz);
  float diffuse = max(dot(transformedNormal, normalize(-uLightDirection)), 0.0);
  vLighting = vec3(0.1) + vec3(0.9) * diffuse;
  gl_Position = uModelViewProjection * vec4(position, 1.0);
}`;

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;
in vec3 vLighting;
out vec4 outColor;
void main() {
  outColor = vec4(vLighting, 1.0);
}`;

function createMeshResource(
  gl: WebGL2RenderingContext,
  parsed: ReturnType<typeof parseOBJ>,
  positionLoc: number,
  normalLoc: number
): MeshResource {
  const normalization = createNormalization(parsed.positions);

  const positionBuffer = gl.createBuffer();
  const normalBuffer = gl.createBuffer();
  const vao = gl.createVertexArray();

  if (!positionBuffer || !normalBuffer || !vao) {
    throw new Error("Failed to allocate mesh buffers");
  }

  gl.bindVertexArray(vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, parsed.positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, parsed.normals, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(normalLoc);
  gl.vertexAttribPointer(normalLoc, 3, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return {
    vao,
    positionBuffer,
    normalBuffer,
    vertexCount: parsed.positions.length / 3,
    normalization
  };
}

function destroyMeshResource(gl: WebGL2RenderingContext, mesh: MeshResource): void {
  gl.deleteBuffer(mesh.positionBuffer);
  gl.deleteBuffer(mesh.normalBuffer);
  gl.deleteVertexArray(mesh.vao);
}

function createProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create shader program");
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? "";
    gl.deleteProgram(program);
    throw new Error(`Program failed to link: ${info}`);
  }
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  return program;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? "";
    gl.deleteShader(shader);
    throw new Error(`Shader failed to compile: ${info}`);
  }
  return shader;
}

function createNormalization(positions: Float32Array): NormalizationData {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const extentX = maxX - minX;
  const extentY = maxY - minY;
  const extentZ = maxZ - minZ;
  const maxExtent = Math.max(extentX, extentY, extentZ) || 1;
  const uniformScale = 2 / maxExtent;

  let maxRadius = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const nx = (positions[i] - centerX) * uniformScale;
    const ny = (positions[i + 1] - centerY) * uniformScale;
    const nz = (positions[i + 2] - centerZ) * uniformScale;
    const radius = Math.hypot(nx, ny, nz);
    if (radius > maxRadius) {
      maxRadius = radius;
    }
  }

  const translate = translation(-centerX, -centerY, -centerZ);
  const uniform = scale(uniformScale, uniformScale, uniformScale);
  const matrix = multiply(uniform, translate);

  return {
    matrix,
    radius: maxRadius || 1
  };
}

function drawInstance(
  gl: WebGL2RenderingContext,
  instance: StaticInstance,
  viewProjection: Mat4,
  mvpLoc: WebGLUniformLocation,
  modelLoc: WebGLUniformLocation
): void {
  const scaleMatrix = scale(instance.scale, instance.scale, instance.scale);
  const translateMatrix = translation(
    instance.position[0],
    instance.position[1],
    instance.position[2]
  );
  const model = multiply(
    translateMatrix,
    multiply(scaleMatrix, instance.resource.normalization.matrix)
  );
  const mvp = multiply(viewProjection, model);

  gl.bindVertexArray(instance.resource.vao);
  gl.uniformMatrix4fv(mvpLoc, false, mvp);
  gl.uniformMatrix4fv(modelLoc, false, model);
  gl.drawArrays(gl.TRIANGLES, 0, instance.resource.vertexCount);
}

function computeEye(camera: CameraState): Vec3 {
  const horizontalRadius = camera.radius * Math.cos(camera.pitch);
  const eyeX = horizontalRadius * Math.sin(camera.yaw);
  const eyeZ = horizontalRadius * Math.cos(camera.yaw);
  const eyeY = camera.radius * Math.sin(camera.pitch);
  return [eyeX, eyeY, eyeZ];
}
