import React from "react";
/** A failed optional 3D chunk must not unmount KapsApp chats or other games. */
export default class StrikeBoundary extends React.Component<
  { children: React.ReactNode; onBack: () => void },
  { failed: boolean; message?: string }
> {
  state: { failed: boolean; message?: string } = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error:Error){
    console.error("KapsStrike failed to load:",error);
    this.setState({message:error.message});
  }
  render() {
    return this.state.failed ? (
      <section role="alert" className="p-8 text-white">
        <h2 className="text-xl font-bold mb-3">KapsStrike açılamadı</h2>
        <p className="mb-4">
          Oyun yüklenirken bir hata oluştu. Yeniden dene; sürerse aşağıdaki hata metnini destek ekibine ilet.
        </p>
        {this.state.message && <pre className="mb-4 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-3 text-xs text-amber-200">{this.state.message}</pre>}
        <button className="mr-2 px-4 py-3 bg-emerald-700 rounded-lg" onClick={()=>this.setState({failed:false,message:undefined})}>Yeniden dene</button>
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
