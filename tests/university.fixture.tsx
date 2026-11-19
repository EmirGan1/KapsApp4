import { createRoot } from "react-dom/client";
import UniversityVault from "../src/components/UniversityVault";
import "../src/index.css";
document.documentElement.classList.add("dark");
document.body.style.background = "#0b1018";
document.body.style.padding = "20px";
localStorage.setItem(
  "lan_token",
  new URLSearchParams(location.search).get("outsider") ? "other" : "owner",
);
createRoot(document.getElementById("root")!).render(<UniversityVault />);
