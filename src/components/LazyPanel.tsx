import { Component, type ReactNode, Suspense } from "react";
import type { UiText } from "../ui";

class ViewBoundary extends Component<{ children: ReactNode; t: UiText }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="course-alert" role="alert">
          <p>{this.props.t.panelLoadFailed}</p>
          <button type="button" onClick={() => window.location.reload()}>
            {this.props.t.reloadPage}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function LazyPanel({ children, t }: { children: ReactNode; t: UiText }) {
  return (
    <ViewBoundary t={t}>
      <Suspense
        fallback={
          <p className="loading" role="status">
            {t.loading}
          </p>
        }
      >
        {children}
      </Suspense>
    </ViewBoundary>
  );
}
