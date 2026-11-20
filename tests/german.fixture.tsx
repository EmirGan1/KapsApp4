import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import KapsGerman from "../src/components/german/KapsGerman";
import "../src/index.css";
localStorage.setItem("lan_token", "german-test");
document.body.style.margin = "0";
document.getElementById("root")!.style.cssText = "height:100dvh;display:flex";
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <KapsGerman />
  </BrowserRouter>,
);
