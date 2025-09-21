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
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
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
  plane: { filename: "plane.obj", scale: 12 },
  sphere: { filename: "sphere.obj", scale: 1.6 }
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
const INITIAL_SPHERE_VELOCITY = new Vector3(0, 0, -6.5);
const SPHERE_RESTITUTION = 0.85;
const PLANE_RESTITUTION = 0.55;

interface HavokViewerProps {
  primaryModel: PrimaryModel;
  running: boolean;
}

export function HavokViewer({ primaryModel, running }: HavokViewerProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          3*Math.PI/4,
          20,
          Vector3.Zero(),
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
        const planeMaterial = new StandardMaterial("planeMaterial", scene);
        planeMaterial.diffuseColor = new Color3(0.3, 0.35, 0.45);
        planeMaterial.specularColor = Color3.Black();
        planeMaterial.backFaceCulling = false;
        planeMesh.material = planeMaterial;

        primaryMesh.id = `primary-${primaryModel}`;
        primaryMesh.position = new Vector3(0, 0, 3);

        sphereMesh.id = "projectile";
        sphereMesh.position = new Vector3(0, 0, 10);
        const sphereMaterial = new StandardMaterial("sphereMaterial", scene);
        sphereMaterial.diffuseColor = new Color3(0.85, 0.4, 0.45);
        sphereMaterial.specularColor = new Color3(0.3, 0.3, 0.3);
        sphereMesh.material = sphereMaterial;

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
          sphereAggregate.body.setLinearVelocity(INITIAL_SPHERE_VELOCITY.clone());
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
    };
  }, [primaryModel, running]);

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
