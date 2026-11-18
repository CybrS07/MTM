import { Component, type ReactNode } from "react";

/** Shows the error on screen instead of leaving a blank white page when a component crashes. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error(error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="login">
        <section className="panel" role="alert" style={{ maxWidth: 560, width: "100%" }}>
          <h1>Something went wrong</h1>
          <p className="muted">The page hit an error while drawing. Details:</p>
          <pre>{this.state.error.message}</pre>
          <div className="row"><button className="btn primary" onClick={() => location.reload()}>Reload</button></div>
        </section>
      </main>
    );
  }
}
