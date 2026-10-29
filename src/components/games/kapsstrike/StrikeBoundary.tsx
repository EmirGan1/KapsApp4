import React from "react";
/** A failed optional 3D chunk must not unmount KapsApp chats or other games. */
export default class StrikeBoundary extends React.Component<
  { children: React.ReactNode; onBack: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section role="alert" className="p-8 text-white">
        <h2 className="text-xl font-bold mb-3">KapsStrike açılamadı</h2>
        <p className="mb-4">
          Bağlantını ve tarayıcının grafik desteğini kontrol edip tekrar
          deneyebilirsin.
        </p>
        <button
          className="px-4 py-3 bg-slate-700 rounded-lg"
          onClick={this.props.onBack}
        >
          Oyun merkezine dön
        </button>
      </section>
    ) : (
      this.props.children
    );
  }
}
