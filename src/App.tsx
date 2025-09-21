import { useState } from "react";
import logo from "./assets/react.svg";
import "./App.css";
import { HavokViewer, PRIMARY_MODELS, type PrimaryModel } from "./components/HavokViewer";

const DEFAULT_LAUNCH_ELEVATION = 66;

export default function App(): JSX.Element {
  const [primaryModel, setPrimaryModel] = useState<PrimaryModel>("squirrel");
  const [isRunning, setIsRunning] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [launchAngle, setLaunchAngle] = useState(0);
  const [launchElevation, setLaunchElevation] = useState(DEFAULT_LAUNCH_ELEVATION);
  const [launchSpeed, setLaunchSpeed] = useState(6.5);

  const modelOptions = Object.keys(PRIMARY_MODELS) as PrimaryModel[];

  const resetViewer = (nextModel: PrimaryModel) => {
    setIsRunning(false);
    setSessionKey((prev) => prev + 1);
    setPrimaryModel(nextModel);
  };

  const handleStart = () => {
    setIsRunning(true);
    setSessionKey((prev) => prev + 1);
  };

  return (
    <main className="app">
      <header className="app__header">
        <img src={logo} className="app__logo" alt="React logo" />
        <h1 className="app__title">DeepFracture Insight Demo</h1>
      </header>

      <section className="panel">
        <h2 className="panel__title">Havok Engine Preview</h2>
        <p className="panel__note">
          Current mesh: {PRIMARY_MODELS[primaryModel].label}. Drag to orbit the camera; press start to fire the sphere from (0, 0, 10) and watch Havok mesh collisions play out.
        </p>
        <ul className="panel__list">
          {modelOptions.map((option) => (
            <li key={option}>
              <button
                type="button"
                className={
                  option === primaryModel
                    ? "panel__button panel__button--active"
                    : "panel__button"
                }
                onClick={() => resetViewer(option)}
              >
                <span className="panel__label">{PRIMARY_MODELS[option].label}</span>
                <span className="panel__meta">{option}.obj</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="panel__controls">
          <label className="panel__control">
            <span className="panel__control-label">Launch angle</span>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={launchAngle}
              onChange={(event) => setLaunchAngle(Number(event.target.value))}
              className="panel__slider"
            />
            <span className="panel__control-value">{launchAngle.toFixed(0)}°</span>
          </label>
          <label className="panel__control">
            <span className="panel__control-label">Launch elevation</span>
            <input
              type="range"
              min="0"
              max="90"
              step="1"
              value={launchElevation}
              onChange={(event) => setLaunchElevation(Number(event.target.value))}
              className="panel__slider"
            />
            <span className="panel__control-value">{launchElevation.toFixed(0)}°</span>
          </label>
          <label className="panel__control">
            <span className="panel__control-label">Launch speed</span>
            <input
              type="range"
              min="2"
              max="12"
              step="0.1"
              value={launchSpeed}
              onChange={(event) => setLaunchSpeed(Number(event.target.value))}
              className="panel__slider"
            />
            <span className="panel__control-value">{launchSpeed.toFixed(1)} u/s</span>
          </label>
        </div>
        <button
          type="button"
          className={isRunning ? "panel__button panel__button--disabled" : "panel__button"}
          onClick={handleStart}
          disabled={isRunning}
        >
          {isRunning ? "Simulation Running" : "Start Simulation"}
        </button>
        <HavokViewer
          key={`${primaryModel}-${sessionKey}`}
          primaryModel={primaryModel}
          running={isRunning}
          launchAngle={launchAngle}
          launchElevation={launchElevation}
          launchSpeed={launchSpeed}
        />
      </section>
    </main>
  );
}
