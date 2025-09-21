import { useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { PBRMetallicRoughnessMaterial } from "@babylonjs/core/Materials/PBR/pbrMetallicRoughnessMaterial";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { IPhysicsCollisionEvent } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import HavokPhysics from "@babylonjs/havok";
import type { Nullable } from "@babylonjs/core/types";
import "@babylonjs/core/Physics/joinedPhysicsEngineComponent";

import "@babylonjs/loaders/OBJ/objFileLoader";

const BASE_MODELS = {
  plane: { filename: "plane.obj", scale: 16 },
  sphere: { filename: "sphere.obj", scale: 1.0 }
} as const;

export const PRIMARY_MODELS = {
  squirrel: { label: "Squirrel", filename: "squirrel.obj", scale: 1.0 },
  lion: { label: "Lion", filename: "lion.obj", scale: 1.0 },
  pot: { label: "Pot", filename: "pot.obj", scale: 1.0 },
  bunny: { label: "Bunny", filename: "bunny.obj", scale: 1.0 },
  base: { label: "Base", filename: "base.obj", scale: 1.0 }
} as const;

export type PrimaryModel = keyof typeof PRIMARY_MODELS;

const GRAVITY_VECTOR = new Vector3(0, 0, -9.81);
const SPHERE_RESTITUTION = 0.85;
const PLANE_RESTITUTION = 0.55;

const DEFAULT_LAUNCH_RADIUS = 4.5;
const DEFAULT_LAUNCH_HEIGHT = 10;
const LAUNCH_DISTANCE = Math.sqrt(DEFAULT_LAUNCH_RADIUS ** 2 + DEFAULT_LAUNCH_HEIGHT ** 2);
const MIN_LAUNCH_HEIGHT = 0.5;

interface HavokViewerProps {
  primaryModel: PrimaryModel;
  running: boolean;
  launchAngle: number;
  launchElevation: number;
  launchSpeed: number;
}

export function HavokViewer({
  primaryModel,
  running,
  launchAngle,
  launchElevation,
  launchSpeed
}: HavokViewerProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sphereMeshRef = useRef<Mesh | null>(null);
  const sphereAggregateRef = useRef<PhysicsAggregate | null>(null);

  useEffect(() => {
    let disposed = false;
    let engine: Nullable<Engine> = null;
    let scene: Nullable<Scene> = null;
    const cleanupObservers: Array<() => void> = [];

    async function bootstrap(): Promise<void> {
      try {
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }

        engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
        scene = new Scene(engine);
        scene.clearColor = new Color3(0.04, 0.07, 0.12).toColor4(1);

        const camera = new ArcRotateCamera(
          "orbitCamera",
          2*Math.PI/4,
          3*Math.PI/4+Math.PI/7,
          12,
          Vector3.Zero().add(new Vector3(0, 0, 1.5)),
          scene
        );
        camera.lowerRadiusLimit = 6;
        camera.attachControl(canvas, true);
        camera.wheelPrecision = 40;

        const lightDirection = Vector3.Normalize(Vector3.Zero().subtract(new Vector3(0, 0, 10)));
        const light = new DirectionalLight("dLight", lightDirection, scene);
        light.position = new Vector3(0, 0, 10);
        light.intensity = 1.2;
        light.diffuse = new Color3(0.85, 0.92, 0.97);

        const ambientLight = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
        ambientLight.intensity = 0.4;

        const havok = await HavokPhysics({
          locateFile: (path: string) => (path.endsWith(".wasm") ? "/havok/HavokPhysics.wasm" : path)
        });
        const havokPlugin = new HavokPlugin(true, havok);
        scene.enablePhysics(GRAVITY_VECTOR, havokPlugin);

        const [planeMesh, primaryMesh, sphereMesh] = await Promise.all([
          loadNormalizedMesh(BASE_MODELS.plane.filename, BASE_MODELS.plane.scale, scene),
          loadNormalizedMesh(
            PRIMARY_MODELS[primaryModel].filename,
            PRIMARY_MODELS[primaryModel].scale,
            scene
          ),
          loadNormalizedMesh(BASE_MODELS.sphere.filename, BASE_MODELS.sphere.scale, scene)
        ]);

        planeMesh.id = "plane";
        planeMesh.position = new Vector3(0, 0, 0);
        const planeMaterial = new PBRMetallicRoughnessMaterial("planeMaterial", scene);
        planeMaterial.baseColor = new Color3(0.32, 0.36, 0.45);
        planeMaterial.metallic = 0;
        planeMaterial.roughness = 0.6;
        planeMaterial.backFaceCulling = false;
        planeMesh.material = planeMaterial;
        planeMesh.forceSharedVertices();

        primaryMesh.id = `primary-${primaryModel}`;
        primaryMesh.position = new Vector3(0, 0, 2.5);
        const primaryMaterial = new PBRMetallicRoughnessMaterial(
          `primary-${primaryModel}-material`,
          scene
        );
        primaryMaterial.baseColor = new Color3(0.78, 0.8, 0.86);
        primaryMaterial.metallic = 0.1;
        primaryMaterial.roughness = 0.45;
        primaryMesh.material = primaryMaterial;
        primaryMesh.forceSharedVertices();

        sphereMesh.id = "projectile";
        const sphereMaterial = new PBRMetallicRoughnessMaterial("sphereMaterial", scene);
        sphereMaterial.baseColor = new Color3(0.85, 0.45, 0.52);
        sphereMaterial.metallic = 0.15;
        sphereMaterial.roughness = 0.35;
        sphereMesh.material = sphereMaterial;
        sphereMesh.forceSharedVertices();
        const initialPosition = computeLaunchPosition(launchAngle, launchElevation);
        sphereMesh.position.copyFrom(initialPosition);

        const planeAggregate = new PhysicsAggregate(
          planeMesh,
          PhysicsShapeType.MESH,
          { mass: 0, restitution: PLANE_RESTITUTION },
          scene
        );
        const primaryAggregate = new PhysicsAggregate(
          primaryMesh,
          PhysicsShapeType.MESH,
          { mass: 0, restitution: SPHERE_RESTITUTION },
          scene
        );
        const sphereAggregate = new PhysicsAggregate(
          sphereMesh,
          PhysicsShapeType.SPHERE,
          { mass: running ? 1 : 0, restitution: SPHERE_RESTITUTION },
          scene
        );

        sphereMeshRef.current = sphereMesh;
        sphereAggregateRef.current = sphereAggregate;

        const physicsPlugin = scene.getPhysicsEngine()?.getPhysicsPlugin() as HavokPlugin | undefined;
        const triggered = new Set<string>();

        if (running && physicsPlugin && sphereAggregate.body) {
          physicsPlugin.setCollisionCallbackEnabled(sphereAggregate.body, true);
          const collisionObservable = physicsPlugin.getCollisionObservable(sphereAggregate.body);
          const observer: Observer<IPhysicsCollisionEvent> = collisionObservable.add(
            (event: IPhysicsCollisionEvent) => {
              if (event.collidedAgainst === primaryAggregate.body && !triggered.has("primary")) {
                triggered.add("primary");
                window.setTimeout(() => {
                  window.alert(
                    `Collision detected: sphere hit the ${PRIMARY_MODELS[primaryModel].label.toLowerCase()} mesh.`
                  );
                }, 0);
              }
              if (event.collidedAgainst === planeAggregate.body && !triggered.has("plane")) {
                triggered.add("plane");
                window.setTimeout(() => {
                  window.alert("Collision detected: sphere impacted the plane.");
                }, 0);
              }
            }
          );
          cleanupObservers.push(() => collisionObservable.remove(observer));
        }

        if (running && sphereAggregate.body) {
          const launchDirection = Vector3.Zero().subtract(sphereMesh.position).normalize();
          const initialVelocity = launchDirection.scale(launchSpeed);
          sphereAggregate.body.setLinearVelocity(initialVelocity);
        }

        const resize = () => {
          if (engine && !engine.isDisposed) {
            engine.resize();
          }
        };
        window.addEventListener("resize", resize);
        cleanupObservers.push(() => window.removeEventListener("resize", resize));

        engine.runRenderLoop(() => {
          if (!scene || scene.isDisposed) {
            return;
          }
          scene.render();
        });
      } catch (err) {
        if (disposed) {
          return;
        }
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Unknown error while initialising Havok viewer");
        }
      }
    }

    bootstrap();

    return () => {
      disposed = true;
      cleanupObservers.forEach((teardown) => teardown());
      if (scene && !scene.isDisposed) {
        scene.dispose();
      }
      if (engine && !engine.isDisposed) {
        engine.stopRenderLoop();
        engine.dispose();
      }
      sphereMeshRef.current = null;
      sphereAggregateRef.current = null;
    };
  }, [primaryModel, running]);

  useEffect(() => {
    if (running) {
      return;
    }
    const mesh = sphereMeshRef.current;
    if (!mesh) {
      return;
    }
    const newPosition = computeLaunchPosition(launchAngle, launchElevation);
    mesh.position.copyFrom(newPosition);
    mesh.computeWorldMatrix(true);
  }, [launchAngle, launchElevation, running]);

  useEffect(() => {
    if (running) {
      return;
    }
    const aggregate = sphereAggregateRef.current;
    if (!aggregate || !aggregate.body) {
      return;
    }
    aggregate.body.setLinearVelocity(Vector3.Zero());
  }, [launchSpeed, running]);

  return (
    <div className="havok-viewer">
      <canvas ref={canvasRef} className="havok-viewer__canvas" />
      {error ? <p className="havok-viewer__error">{error}</p> : null}
    </div>
  );
}

async function loadNormalizedMesh(
  filename: string,
  scaleMultiplier: number,
  scene: Scene
): Promise<Mesh> {
  const result = await SceneLoader.ImportMeshAsync("", "/models/", filename, scene);
  const mesh = mergeMeshes(result.meshes);
  normalizeMesh(mesh);
  mesh.scaling = mesh.scaling.multiplyByFloats(scaleMultiplier, scaleMultiplier, scaleMultiplier);
  mesh.computeWorldMatrix(true);
  return mesh;
}

function mergeMeshes(meshes: AbstractMesh[]): Mesh {
  const candidates = meshes.filter((mesh) => mesh instanceof Mesh && mesh.getTotalVertices() > 0) as Mesh[];
  if (candidates.length === 0) {
    throw new Error("No mesh geometry found in imported OBJ");
  }
  if (candidates.length === 1) {
    const mesh = candidates[0];
    mesh.alwaysSelectAsActiveMesh = true;
    return mesh;
  }
  const merged = Mesh.MergeMeshes(candidates, true, true, undefined, false, true);
  if (!merged) {
    throw new Error("Unable to merge mesh geometry");
  }
  merged.alwaysSelectAsActiveMesh = true;
  return merged;
}

function normalizeMesh(mesh: Mesh): void {
  mesh.computeWorldMatrix(true);
  const bounding = mesh.getBoundingInfo();
  const center = bounding.boundingBox.center.clone();
  mesh.bakeTransformIntoVertices(Matrix.Translation(-center.x, -center.y, -center.z));
  mesh.computeWorldMatrix(true);
  const normalizedBounding = mesh.getBoundingInfo();
  const extend = normalizedBounding.boundingBox.extendSize;
  const maxExtent = Math.max(extend.x, extend.y, extend.z) || 1;
  const uniformScale = 1 / maxExtent;
  mesh.scaling = new Vector3(uniformScale, uniformScale, uniformScale);
  mesh.computeWorldMatrix(true);
}

function computeLaunchPosition(angle: number, elevation: number): Vector3 {
  const angleRad = (angle * Math.PI) / 180;
  const elevationRad = (elevation * Math.PI) / 180;
  const horizontalRadius = Math.cos(elevationRad) * LAUNCH_DISTANCE;
  const height = Math.max(Math.sin(elevationRad) * LAUNCH_DISTANCE, MIN_LAUNCH_HEIGHT);
  return new Vector3(
    Math.cos(angleRad) * horizontalRadius,
    Math.sin(angleRad) * horizontalRadius,
    height
  );
}
