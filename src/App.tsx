import { useMemo, useState } from "react";
import logo from "./assets/react.svg";
import "./App.css";
import { HavokViewer, PRIMARY_MODELS, type PrimaryModel } from "./components/HavokViewer";

const fractures = [
  { id: "cm-01", label: "Cortical microfracture", confidence: 0.87 },
  { id: "tb-03", label: "Trabecular break", confidence: 0.73 },
  { id: "sm-02", label: "Stress microline", confidence: 0.64 }
];

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function App(): JSX.Element {
  const [selectedId, setSelectedId] = useState(fractures[0].id);
  const [primaryModel, setPrimaryModel] = useState<PrimaryModel>("squirrel");
  const [isRunning, setIsRunning] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [launchAngle, setLaunchAngle] = useState(0);
  const [launchSpeed, setLaunchSpeed] = useState(6.5);

  const modelOptions = Object.keys(PRIMARY_MODELS) as PrimaryModel[];

  const selection = useMemo(
    () => fractures.find((item) => item.id === selectedId) ?? fractures[0],
    [selectedId]
  );

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
        <h2 className="panel__title">Detection Summary</h2>
        <ul className="panel__list">
          {fractures.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                className={
                  candidate.id === selectedId
                    ? "panel__button panel__button--active"
                    : "panel__button"
                }
                onClick={() => setSelectedId(candidate.id)}
              >
                <span className="panel__label">{candidate.label}</span>
                <span className="panel__meta">{formatPercent(candidate.confidence)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2 className="panel__title">Details</h2>
        <dl className="panel__details">
          <div>
            <dt>Identifier</dt>
            <dd>{selection.id}</dd>
          </div>
          <div>
            <dt>Label</dt>
            <dd>{selection.label}</dd>
          </div>
          <div>
            <dt>Confidence</dt>
            <dd>{formatPercent(selection.confidence)}</dd>
          </div>
        </dl>
        <p className="panel__note">
          Replace this mock data with live inference outputs once the model service is attached.
        </p>
      </section>

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
          launchSpeed={launchSpeed}
        />
      </section>
    </main>
  );
}
