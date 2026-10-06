import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

export interface GeneratedSatQuestion {
  section: "math" | "reading_writing";
  domain: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  question_text: string;
  context_passage: string | null;
  question_type: "multiple_choice" | "student_produced";
  options: string[] | null;
  correct_answer: string;
  explanation: string;
}

export interface GenerateSatParams {
  section: "math" | "reading_writing" | string;
  domain?: string;
  topic?: string;
  difficulty?: "easy" | "medium" | "hard" | string;
  count: number;
}

// Topic-to-Domain dictionary for College Board Digital SAT
const TOPIC_TO_DOMAIN_MAP: Record<string, { section: "math" | "reading_writing"; domain: string }> = {
  // Math - Algebra
  "Linear Equations in One Variable": { section: "math", domain: "Algebra" },
  "Linear Equations in Two Variables": { section: "math", domain: "Algebra" },
  "Linear Functions": { section: "math", domain: "Algebra" },
  "Systems of Two Linear Equations": { section: "math", domain: "Algebra" },
  "Systems of Equations in Two Variables": { section: "math", domain: "Algebra" },
  "Linear Inequalities": { section: "math", domain: "Algebra" },

  // Math - Advanced Math
  "Equivalent Expressions": { section: "math", domain: "Advanced Math" },
  "Nonlinear Equations in One Variable (Quadratics)": { section: "math", domain: "Advanced Math" },
  "Quadratic Equations": { section: "math", domain: "Advanced Math" },
  "Quadratic & Exponential": { section: "math", domain: "Advanced Math" },
  "Exponential Functions": { section: "math", domain: "Advanced Math" },
  "Polynomial Expressions": { section: "math", domain: "Advanced Math" },
  "Radical and Rational Equations": { section: "math", domain: "Advanced Math" },
  "Nonlinear Functions": { section: "math", domain: "Advanced Math" },

  // Math - Problem-Solving and Data Analysis
  "Ratios and Proportions": { section: "math", domain: "Problem-Solving and Data Analysis" },
  "Ratios, Rates, and Units": { section: "math", domain: "Problem-Solving and Data Analysis" },
  "Percentages": { section: "math", domain: "Problem-Solving and Data Analysis" },
  "Unit Conversions and Measurement": { section: "math", domain: "Problem-Solving and Data Analysis" },
  "Scatterplots and Modeling": { section: "math", domain: "Problem-Solving and Data Analysis" },
  "One-Variable Data: Distributions": { section: "math", domain: "Problem-Solving and Data Analysis" },
  "Probability": { section: "math", domain: "Problem-Solving and Data Analysis" },
  "Probability and Statistics": { section: "math", domain: "Problem-Solving and Data Analysis" },
  "Statistics and Data Analysis": { section: "math", domain: "Problem-Solving and Data Analysis" },

  // Math - Geometry and Trigonometry
  "Area and Volume": { section: "math", domain: "Geometry and Trigonometry" },
  "Lines, Angles, and Triangles": { section: "math", domain: "Geometry and Trigonometry" },
  "Right Triangles and Trigonometry": { section: "math", domain: "Geometry and Trigonometry" },
  "Circles": { section: "math", domain: "Geometry and Trigonometry" },
  "Trigonometry": { section: "math", domain: "Geometry and Trigonometry" },

  // Reading & Writing - Craft and Structure
  "Words in Context": { section: "reading_writing", domain: "Craft and Structure" },
  "Text Structure and Purpose": { section: "reading_writing", domain: "Craft and Structure" },
  "Cross-Text Connections": { section: "reading_writing", domain: "Craft and Structure" },

  // Reading & Writing - Information and Ideas
  "Central Ideas and Details": { section: "reading_writing", domain: "Information and Ideas" },
  "Command of Evidence": { section: "reading_writing", domain: "Information and Ideas" },
  "Command of Evidence (Textual)": { section: "reading_writing", domain: "Information and Ideas" },
  "Command of Evidence (Quantitative)": { section: "reading_writing", domain: "Information and Ideas" },
  "Inferences": { section: "reading_writing", domain: "Information and Ideas" },

  // Reading & Writing - Standard English Conventions
  "Boundaries": { section: "reading_writing", domain: "Standard English Conventions" },
  "Form, Structure, and Sense": { section: "reading_writing", domain: "Standard English Conventions" },

  // Reading & Writing - Expression of Ideas
  "Rhetorical Synthesis": { section: "reading_writing", domain: "Expression of Ideas" },
  "Transitions": { section: "reading_writing", domain: "Expression of Ideas" }
};

/**
 * Initializes Gemini client
 */
function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[aiService] GEMINI_API_KEY is not defined. AI generation will be skipped.");
    return null;
  }
  return new GoogleGenAI();
}

/**
 * Normalizes options into standard array: ["A) ...", "B) ...", "C) ...", "D) ..."]
 */
function normalizeOptions(rawOptions: any): string[] | null {
  if (!rawOptions) return null;

  if (Array.isArray(rawOptions)) {
    const letters = ["A", "B", "C", "D"];
    return rawOptions.map((opt, i) => {
      const str = String(opt || "").trim();
      const prefixMatch = str.match(/^([A-D])\s*[\)\.\:\-]\s*(.*)$/i);
      if (prefixMatch) {
        return `${prefixMatch[1].toUpperCase()}) ${prefixMatch[2].trim()}`;
      }
      const letter = letters[i] || `Option ${i + 1}`;
      return `${letter}) ${str}`;
    });
  }

  if (typeof rawOptions === "object") {
    const letters = ["A", "B", "C", "D"];
    const result: string[] = [];
    for (const l of letters) {
      if (rawOptions[l] || rawOptions[l.toLowerCase()]) {
        const text = rawOptions[l] || rawOptions[l.toLowerCase()];
        result.push(`${l}) ${String(text).trim()}`);
      }
    }
    if (result.length >= 2) return result;
  }

  return null;
}

/**
 * Generates brand-new, unique College Board Digital SAT questions using Google Gemini API
 */
export async function generateSatQuestions(params: GenerateSatParams): Promise<GeneratedSatQuestion[]> {
  const count = Math.min(15, Math.max(1, params.count || 1));
  const section = params.section === "reading_writing" ? "reading_writing" : "math";

  // Resolve topic & domain
  let topic = params.topic && params.topic !== "all" ? params.topic : "";
  let domain = params.domain && params.domain !== "all" ? params.domain : "";

  if (topic && TOPIC_TO_DOMAIN_MAP[topic]) {
    domain = domain || TOPIC_TO_DOMAIN_MAP[topic].domain;
  } else if (!domain) {
    domain = section === "math" ? "Algebra" : "Craft and Structure";
  }

  if (!topic) {
    topic = section === "math" ? "Linear Equations in One Variable" : "Words in Context";
  }

  const difficulty = params.difficulty && ["easy", "medium", "hard"].includes(params.difficulty)
    ? params.difficulty as "easy" | "medium" | "hard"
    : "medium";

  const ai = getAiClient();
  if (!ai) return [];

  const systemInstruction =
    "Sen College Board Digital SAT soru hazırlama uzmanısın. Belirtilen section, topic ve difficulty kriterlerine uygun, tamamen özgün, telifsiz ve yüksek kaliteli sorular üret. Çıktı SADECE ve SADECE JSON formatında bir array olmalıdır; markdown codefence (```json) veya giriş metni içermemelidir.";

  const prompt = `Lütfen aşağıdaki özelliklere sahip ${count} adet benzersiz Digital SAT sorusu üret:
- Section: ${section === "math" ? "Math" : "Reading and Writing"}
- Domain: ${domain}
- Topic: ${topic}
- Target Difficulty: ${difficulty}

Her soru nesnesi şu alanları içermelidir:
{
  "section": "${section}",
  "domain": "${domain}",
  "topic": "${topic}",
  "difficulty": "${difficulty}",
  "question_text": "Soru metni (Math sorularında LaTeX formülleri $ $ formatında yazılmalıdır)",
  "context_passage": ${section === "reading_writing" ? '"Kısa metin/paragraf"' : "null"},
  "question_type": "multiple_choice",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "correct_answer": "A",
  "explanation": "Detaylı adım adım çözüm ve neden bu şıkkın doğru olduğunu anlatan açıklama."
}

Kurallar:
1. Kesinlikle daha önce var olan bir sorunun birebir kopyası olmamalıdır; sayılar, hikaye ve bağlam tamamen özgün olmalıdır.
2. Çıktı geçerli bir JSON array olmalıdır: [ { ... }, { ... } ].
3. Multiple choice sorularında her zaman 4 şık (A, B, C, D) bulunmalıdır ve correct_answer 'A', 'B', 'C' veya 'D' olmalıdır.
4. Markdown codefence (\`\`\`json) KULLANMAYIN, doğrudan ham JSON array döndürün.`;

  const candidateModels = ["gemini-3.8-flash", "gemini-3.1-flash-lite"];

  for (const modelName of candidateModels) {
    try {
      console.log(`[aiService] Requesting Gemini (${modelName}) to generate ${count} SAT questions (${section} / ${topic} / ${difficulty})...`);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.7
        }
      });

      const rawText = response.text?.trim() || "";
      if (!rawText) {
        console.warn(`[aiService] Empty response from Gemini (${modelName}). Trying next model...`);
        continue;
      }

      // Clean any leading/trailing markdown if present
      const cleanedText = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      let parsed: any;
      try {
        parsed = JSON.parse(cleanedText);
      } catch (parseErr) {
        console.error(`[aiService] JSON parse error on Gemini (${modelName}) output:`, parseErr);
        continue;
      }

      const rawArray: any[] = Array.isArray(parsed) ? parsed : parsed.questions || [parsed];
      const validatedQuestions: GeneratedSatQuestion[] = [];

      for (const item of rawArray) {
        if (!item || !item.question_text) continue;

        const qType = item.question_type === "student_produced" ? "student_produced" : "multiple_choice";
        const normalizedOpts = qType === "multiple_choice" ? normalizeOptions(item.options) : null;

        let corAns = String(item.correct_answer || "").trim();
        if (qType === "multiple_choice") {
          corAns = corAns.replace(/[\)\.\s].*$/, "").toUpperCase();
          if (!["A", "B", "C", "D"].includes(corAns)) {
            corAns = "A";
          }
        }

        validatedQuestions.push({
          section: item.section === "reading_writing" ? "reading_writing" : "math",
          domain: String(item.domain || domain).trim(),
          topic: String(item.topic || topic).trim(),
          difficulty: (["easy", "medium", "hard"].includes(item.difficulty) ? item.difficulty : difficulty) as any,
          question_text: String(item.question_text).trim(),
          context_passage: item.context_passage ? String(item.context_passage).trim() : null,
          question_type: qType,
          options: normalizedOpts,
          correct_answer: corAns,
          explanation: String(item.explanation || "Çözüm açıklaması hazırlanmaktadır.").trim()
        });
      }

      if (validatedQuestions.length > 0) {
        console.log(`[aiService] Successfully generated and validated ${validatedQuestions.length} questions from Gemini (${modelName}).`);
        return validatedQuestions;
      }
    } catch (err: any) {
      console.warn(`[aiService] Model ${modelName} failed (${err?.message || err}). Trying fallback model...`);
    }
  }

  console.error("[aiService] All candidate Gemini models exhausted for question generation.");
  return [];
}
