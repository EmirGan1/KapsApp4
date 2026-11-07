import { Atom, BookOpen, Calculator, Dna, FlaskConical, Globe, Landmark, Languages } from "lucide-react";

const themes = {
  Physics: { Icon: Atom, notes: ["F = ma", "E = hf", "v = fλ", "p = mv"], color: "text-violet-500" },
  Mathematics: { Icon: Calculator, notes: ["∫ f(x) dx", "a² + b² = c²", "dy/dx", "e^(iπ) + 1 = 0"], color: "text-indigo-500" },
  Chemistry: { Icon: FlaskConical, notes: ["PV = nRT", "pH = −log₁₀[H⁺]", "ΔG = ΔH − TΔS"], color: "text-cyan-600" },
  Biology: { Icon: Dna, notes: ["DNA → RNA", "ATP ⇌ ADP", "A · T / G · C"], color: "text-emerald-600" },
  "Digital Society": { Icon: Globe, notes: ["0100 1010", "{ data }", "input → output"], color: "text-teal-600" },
  Turkish: { Icon: BookOpen, notes: ["“Anlatıcı”", "İmge", "Motif", "Bakış açısı"], color: "text-rose-500" },
  English: { Icon: Languages, notes: ["“Voice”", "Tone", "Metaphor", "Context"], color: "text-amber-600" },
  TITC: { Icon: Landmark, notes: ["1919", "1923", "1938", "Kronoloji"], color: "text-orange-600" },
};

export function SubjectDecor({ subject }: { subject: string }) {
  const key = Object.keys(themes).find(item => item.toLowerCase() === subject.toLowerCase()) as keyof typeof themes | undefined;
  if (!key) return null;
  const { Icon, notes, color } = themes[key];
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-16 hidden 2xl:block select-none ${color}`}>
      {(["left-0", "right-0"] as const).map((side, index) => (
        <div key={side} className={`absolute ${side} max-w-56 overflow-hidden text-center`} style={{ width: "max(0px, calc((100% - 72rem) / 2))" }}>
          <div className={`mx-2 space-y-12 rounded-full bg-current/5 py-8 ${index ? "mt-24" : ""}`}>
            <Icon className="mx-auto h-9 w-9 opacity-25" />
            {notes.filter((_, i) => i % 2 === index).map(note => (
              <p key={note} className="px-1 font-mono text-xs leading-relaxed opacity-45 min-[1750px]:text-sm">{note}</p>
            ))}
            <Icon className="mx-auto h-6 w-6 opacity-15" />
          </div>
        </div>
      ))}
    </div>
  );
}
