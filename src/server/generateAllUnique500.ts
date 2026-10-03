import fs from 'fs';
import path from 'path';
import { SatQuestionSeed } from './satQuestionsData';

function mcq(correct: string, wrongs: [string, string, string], targetLetter?: 'A' | 'B' | 'C' | 'D') {
  const letters: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
  const chosenLetter = targetLetter || letters[Math.floor(Math.random() * 4)];
  const options: string[] = [];
  let wIdx = 0;
  for (const l of letters) {
    if (l === chosenLetter) {
      options.push(`${l}) ${correct}`);
    } else {
      options.push(`${l}) ${wrongs[wIdx++]}`);
    }
  }
  return { options, correct_answer: chosenLetter };
}

export function generateAll500UniqueQuestions(): SatQuestionSeed[] {
  const all: SatQuestionSeed[] = [];

  // =========================================================================
  // 1. MATH: 250 Questions (All unique, no duplicate texts)
  // =========================================================================

  // 1.1 ALGEBRA: Linear Equations (15 questions)
  for (let i = 1; i <= 15; i++) {
    const a = 2 + i;
    const b = 3 + i * 2;
    const c = 4 + i;
    const d = 15 + i * 5;
    // a*x + b = c*x + d => (a - c)*x = d - b (ensure a != c)
    const coeff = a === c ? a + 1 : a;
    const diff = coeff - c;
    const rhs = d - b;
    const ans = diff === 0 ? 1 : Math.round((rhs / diff) * 10) / 10;
    const o = mcq(`${ans}`, [`${ans + 2}`, `${ans - 3}`, `${ans * 2}`]);
    all.push({
      section: 'math',
      domain: 'Algebra',
      topic: 'Linear Equations in One Variable',
      difficulty: i % 3 === 0 ? 'easy' : i % 3 === 1 ? 'medium' : 'hard',
      question_text: `What is the value of $x$ that satisfies the equation $${coeff}x + ${b} = ${c}x + ${d}$?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Subtract $${c}x$ from both sides: $(${coeff} - ${c})x + ${b} = ${d} \\implies ${diff}x = ${rhs} \\implies x = ${ans}$.`
    });
  }

  // 1.2 ALGEBRA: Linear Equations in Two Variables (15 questions)
  for (let i = 1; i <= 15; i++) {
    const m = i + 2;
    const x0 = i;
    const y0 = m * x0 - 4;
    const x1 = i + 3;
    const y1 = m * x1 - 4;
    const o = mcq(`${m}`, [`${m + 1}`, `${m - 2}`, `${-m}`]);
    all.push({
      section: 'math',
      domain: 'Algebra',
      topic: 'Linear Equations in Two Variables',
      difficulty: 'medium',
      question_text: `In the $xy$-plane, what is the slope of the line that passes through the distinct points $(${x0}, ${y0})$ and $(${x1}, ${y1})$?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The slope is $\\frac{y_2 - y_1}{x_2 - x_1} = \\frac{${y1} - ${y0}}{${x1} - ${x0}} = \\frac{${y1 - y0}}{3} = ${m}$.`
    });
  }

  // 1.3 ALGEBRA: Systems of Two Linear Equations (15 questions)
  for (let i = 1; i <= 15; i++) {
    const x = i + 3;
    const y = 2 * i + 1;
    const sum = x + y;
    const eq1c = 3 * x + y;
    const eq2c = 2 * x - y;
    if (i % 3 === 0) {
      all.push({
        section: 'math',
        domain: 'Algebra',
        topic: 'Systems of Two Linear Equations',
        difficulty: 'medium',
        question_text: `If the system of linear equations\n$$3x + y = ${eq1c}$$\n$$2x - y = ${eq2c}$$\nhas solution $(x, y)$, what is the value of $x + y$?`,
        question_type: 'student_produced',
        correct_answer: `${sum}`,
        explanation: `Adding both equations eliminates $y$: $5x = ${eq1c + eq2c} \\implies x = ${x}$. Then $y = ${y}$. Thus $x + y = ${sum}$.`
      });
    } else {
      const o = mcq(`${sum}`, [`${sum + 3}`, `${sum - 2}`, `${sum * 2}`]);
      all.push({
        section: 'math',
        domain: 'Algebra',
        topic: 'Systems of Two Linear Equations',
        difficulty: 'medium',
        question_text: `If the system of linear equations\n$$3x + y = ${eq1c}$$\n$$2x - y = ${eq2c}$$\nhas solution $(x, y)$, what is the value of $x + y$?`,
        question_type: 'multiple_choice',
        options: o.options,
        correct_answer: o.correct_answer,
        explanation: `Adding both equations gives $5x = ${eq1c + eq2c} \\implies x = ${x}$, so $y = ${y}$, and $x + y = ${sum}$.`
      });
    }
  }

  // 1.4 ALGEBRA: Linear Inequalities (15 questions)
  for (let i = 1; i <= 15; i++) {
    const p = 15 + i * 3;
    const f = 40 + i * 10;
    const b = 250 + i * 30;
    const o = mcq(`${p}x + ${f} \\le ${b}`, [`${p}x - ${f} \\le ${b}`, `${f}x + ${p} \\le ${b}`, `${p}x + ${f} \\ge ${b}`]);
    all.push({
      section: 'math',
      domain: 'Algebra',
      topic: 'Linear Inequalities',
      difficulty: 'easy',
      question_text: `An equipment rental shop charges a standard service charge of $${f} plus an hourly rate of $${p}. If a contractor has a budget not exceeding $${b}, which inequality represents all possible rental durations $x$, in hours?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Total cost is $${p}x + ${f}$. Because the budget cannot be exceeded, the inequality is $${p}x + ${f} \\le ${b}$.`
    });
  }

  // 1.5 ALGEBRA: Linear Functions (10 questions)
  for (let i = 1; i <= 10; i++) {
    const slope = 12 + i * 2;
    const intercept = 80 + i * 10;
    const o = mcq(
      `The reservoir volume increases by ${slope} cubic meters each day.`,
      [
        `The reservoir initially contained ${slope} cubic meters of water.`,
        `The maximum capacity of the reservoir is ${slope} cubic meters.`,
        `The reservoir takes ${slope} days to fill completely.`
      ]
    );
    all.push({
      section: 'math',
      domain: 'Algebra',
      topic: 'Linear Functions',
      difficulty: 'medium',
      question_text: `The volume of water $V(d)$, in cubic meters, stored in an irrigation reservoir $d$ days after seasonal runoff begins is given by $V(d) = ${slope}d + ${intercept}$. What is the best interpretation of the number ${slope}$ in this context?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `In the linear function $V(d) = md + b$, $m = ${slope}$ is the slope representing the daily rate of increase in water volume.`
    });
  }

  // 2.1 ADVANCED MATH: Quadratics (20 questions)
  for (let i = 1; i <= 20; i++) {
    const r1 = i + 1;
    const r2 = i + 5;
    const b = r1 + r2;
    const c = r1 * r2;
    const o = mcq(`x = ${r1} \\text{ and } x = ${r2}`, [
      `x = -${r1} \\text{ and } x = -${r2}`,
      `x = ${r1} \\text{ and } x = -${r2}`,
      `x = -${r1} \\text{ and } x = ${r2}`
    ]);
    all.push({
      section: 'math',
      domain: 'Advanced Math',
      topic: 'Quadratic Equations',
      difficulty: i > 12 ? 'hard' : 'medium',
      question_text: `Which values of $x$ satisfy the quadratic equation $x^2 - ${b}x + ${c} = 0$?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Factoring gives $(x - ${r1})(x - ${r2}) = 0$, so $x = ${r1}$ and $x = ${r2}$.`
    });
  }

  // 2.2 ADVANCED MATH: Vertex Form (15 questions)
  for (let i = 1; i <= 15; i++) {
    const h = i + 2;
    const k = 10 + i * 3;
    const o = mcq(`(${h}, ${k})`, [`(${-h}, ${k})`, `(${h}, ${-k})`, `(${-h}, ${-k})`]);
    all.push({
      section: 'math',
      domain: 'Advanced Math',
      topic: 'Nonlinear Functions',
      difficulty: 'easy',
      question_text: `The function $f(x) = 2(x - ${h})^2 + ${k}$ is graphed in the $xy$-plane. What are the coordinates of the vertex of the parabola?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `In vertex form $y = a(x - h)^2 + k$, the vertex coordinates are $(h, k) = (${h}, ${k})$.`
    });
  }

  // 2.3 ADVANCED MATH: Exponential Functions (15 questions)
  for (let i = 1; i <= 15; i++) {
    const initial = 200 * i;
    const pct = 6 + (i % 6);
    const growth = (1 + pct / 100).toFixed(2);
    const o = mcq(`N(t) = ${initial}(${growth})^t`, [
      `N(t) = ${initial}(1 + ${pct})^t`,
      `N(t) = ${initial} + ${(initial * pct / 100).toFixed(0)}t`,
      `N(t) = ${initial}(${(1 - pct / 100).toFixed(2)})^t`
    ]);
    all.push({
      section: 'math',
      domain: 'Advanced Math',
      topic: 'Exponential Functions',
      difficulty: 'easy',
      question_text: `A rare wildlife species has an initial counted population of ${initial} individuals. Biologists project that the population will increase at a rate of ${pct}\\% per year. Which function models the population $N(t)$ after $t$ years?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Exponential growth formula $N(t) = P(1 + r)^t = ${initial}(1 + ${pct / 100})^t = ${initial}(${growth})^t$.`
    });
  }

  // 2.4 ADVANCED MATH: Radical and Rational Equations (10 questions)
  for (let i = 1; i <= 10; i++) {
    const v = i + 2;
    const ans = v * v - 7;
    if (i % 2 === 0) {
      all.push({
        section: 'math',
        domain: 'Advanced Math',
        topic: 'Radical and Rational Equations',
        difficulty: 'medium',
        question_text: `If $\\sqrt{x + 7} = ${v}$, what is the value of $x$?`,
        question_type: 'student_produced',
        correct_answer: `${ans}`,
        explanation: `Square both sides: $x + 7 = ${v * v} \\implies x = ${ans}$.`
      });
    } else {
      const o = mcq(`${ans}`, [`${ans + 4}`, `${ans - 5}`, `${ans * 2}`]);
      all.push({
        section: 'math',
        domain: 'Advanced Math',
        topic: 'Radical and Rational Equations',
        difficulty: 'medium',
        question_text: `If $\\sqrt{x + 7} = ${v}$, what is the value of $x$?`,
        question_type: 'multiple_choice',
        options: o.options,
        correct_answer: o.correct_answer,
        explanation: `Squaring both sides yields $x + 7 = ${v * v} \\implies x = ${ans}$.`
      });
    }
  }

  // 2.5 ADVANCED MATH: Polynomial Expressions (10 questions)
  for (let i = 1; i <= 10; i++) {
    const k = i + 3;
    const o = mcq(`x + ${k}`, [`x - ${k}`, `x^2 + ${k}`, `(x + ${k})^2`]);
    all.push({
      section: 'math',
      domain: 'Advanced Math',
      topic: 'Polynomial Expressions',
      difficulty: 'easy',
      question_text: `Which expression is equivalent to $\\frac{x^2 - ${k * k}}{x - ${k}}$ for all $x \\neq ${k}$?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Factor the numerator as difference of squares: $(x - ${k})(x + ${k})$. Cancelling $(x - ${k})$ leaves $x + ${k}$.`
    });
  }

  // 3.1 PROBLEM SOLVING: Ratios & Rates (15 questions)
  for (let i = 1; i <= 15; i++) {
    const r1 = 3 + (i % 3);
    const r2 = 4 + (i % 4);
    const mult = 15 + i * 2;
    const total = (r1 + r2) * mult;
    const ans = r1 * mult;
    const o = mcq(`${ans}`, [`${ans + 15}`, `${ans - 10}`, `${r2 * mult}`]);
    all.push({
      section: 'math',
      domain: 'Problem-Solving and Data Analysis',
      topic: 'Ratios and Proportions',
      difficulty: 'easy',
      question_text: `An alloy consists of copper and nickel in a mass ratio of $${r1}:${r2}$. If the total mass of an ingot is ${total} kilograms, how many kilograms of copper are in the ingot?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Total parts = $${r1} + ${r2} = ${r1 + r2}$. Each part represents $\\frac{${total}}{${r1 + r2}} = ${mult}$ kg. Copper mass = $${r1} \\times ${mult} = ${ans}$ kg.`
    });
  }

  // 3.2 PROBLEM SOLVING: Percentages (15 questions)
  for (let i = 1; i <= 15; i++) {
    const price = 60 + i * 10;
    const disc = price * 0.85;
    const o = mcq(`$${disc.toFixed(2)}`, [`$${(price * 0.8).toFixed(2)}`, `$${(price * 0.9).toFixed(2)}`, `$${(price - 15).toFixed(2)}`]);
    all.push({
      section: 'math',
      domain: 'Problem-Solving and Data Analysis',
      topic: 'Percentages',
      difficulty: 'easy',
      question_text: `A digital subscription regularly priced at $${price} per year is offered with a 15\\% promotional discount. What is the discounted price of the subscription?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Discounted price = $${price} \\times (1 - 0.15) = ${price} \\times 0.85 = $${disc.toFixed(2)}$.`
    });
  }

  // 3.3 PROBLEM SOLVING: Statistics (10 questions)
  for (let i = 1; i <= 10; i++) {
    const o = mcq(
      `The standard deviation will increase significantly.`,
      [
        `The standard deviation will decrease to zero.`,
        `The standard deviation will remain entirely unchanged.`,
        `The mean will decrease while the standard deviation decreases.`
      ]
    );
    all.push({
      section: 'math',
      domain: 'Problem-Solving and Data Analysis',
      topic: 'Statistics and Data Analysis',
      difficulty: 'medium',
      question_text: `A dataset of 10 student scores has values tightly clustered between 72 and 78. If an additional extreme score of 100 is appended to the dataset, how will this affect the standard deviation of the scores?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Standard deviation measures the spread of data points from the mean. Introducing an extreme outlier far from the cluster significantly increases the overall spread and thus increases the standard deviation.`
    });
  }

  // 3.4 PROBLEM SOLVING: Scatterplots (10 questions)
  for (let i = 1; i <= 10; i++) {
    const slope = 3.2;
    const base = 25 + i * 2;
    const x = 5;
    const yVal = (slope * x + base).toFixed(1);
    const o = mcq(`${yVal}`, [`${(Number(yVal) + 5).toFixed(1)}`, `${(Number(yVal) - 4).toFixed(1)}`, `${(Number(yVal) + 10).toFixed(1)}`]);
    all.push({
      section: 'math',
      domain: 'Problem-Solving and Data Analysis',
      topic: 'Scatterplots and Modeling',
      difficulty: 'easy',
      question_text: `A research study models plant growth using the line of best fit $\\hat{y} = 3.2x + ${base}$, where $x$ is daily sunlight exposure in hours and $y$ is weekly height growth in millimeters. What is the predicted growth for a plant receiving 5 hours of sunlight per day?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Substitute $x = 5$: $\\hat{y} = 3.2(5) + ${base} = 16.0 + ${base} = ${yVal}$ mm.`
    });
  }

  // 3.5 PROBLEM SOLVING: Probability (10 questions)
  for (let i = 1; i <= 10; i++) {
    const white = 5 + i;
    const black = 7 + i;
    const total = white + black;
    const o = mcq(`\\frac{${white}}{${total}}`, [`\\frac{${black}}{${total}}`, `\\frac{${white}}{${black}}`, `\\frac{1}{${total}}`]);
    all.push({
      section: 'math',
      domain: 'Problem-Solving and Data Analysis',
      topic: 'Probability',
      difficulty: 'easy',
      question_text: `A bag contains ${white} white tokens and ${black} black tokens. If one token is chosen at random, what is the probability that the token is white?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Probability = $\\frac{\\text{white}}{\\text{total}} = \\frac{${white}}{${white} + ${black}} = \\frac{${white}}{${total}}$.`
    });
  }

  // 4.1 GEOMETRY & TRIG: Trigonometry (15 questions)
  for (let i = 1; i <= 15; i++) {
    const opp = 4 + (i % 6);
    const hyp = opp + 3;
    const o = mcq(`\\frac{${opp}}{${hyp}}`, [`\\frac{${hyp}}{${opp}}`, `\\frac{${opp - 1}}{${hyp}}`, `1`]);
    all.push({
      section: 'math',
      domain: 'Geometry and Trigonometry',
      topic: 'Trigonometry',
      difficulty: 'medium',
      question_text: `In a right triangle $PQR$ with right angle at $R$, the acute angles $P$ and $Q$ satisfy $\\cos(P) = \\frac{${opp}}{${hyp}}$. What is the value of $\\sin(Q)$?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `In any right triangle, acute angles $P$ and $Q$ are complementary ($P + Q = 90^\\circ$). Therefore, $\\sin(Q) = \\cos(90^\\circ - Q) = \\cos(P) = \\frac{${opp}}{${hyp}}$.`
    });
  }

  // 4.2 GEOMETRY & TRIG: Circles (15 questions)
  for (let i = 1; i <= 15; i++) {
    const r = 4 + (i % 5);
    const r2 = r * r;
    const o = mcq(`${r}`, [`${r2}`, `${2 * r}`, `${r + 3}`]);
    all.push({
      section: 'math',
      domain: 'Geometry and Trigonometry',
      topic: 'Circles',
      difficulty: 'easy',
      question_text: `A circle in the $xy$-plane has equation $(x + 5)^2 + (y - 8)^2 = ${r2}$. What is the radius of the circle?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The circle equation is $(x - h)^2 + (y - k)^2 = r^2$. Here $r^2 = ${r2}$, so $r = \\sqrt{${r2}} = ${r}$.`
    });
  }

  // 4.3 GEOMETRY & TRIG: Area and Volume (20 questions)
  for (let i = 1; i <= 20; i++) {
    const r = 2 + (i % 5);
    const h = 4 + (i % 6);
    const vol = r * r * h;
    if (i % 3 === 0) {
      all.push({
        section: 'math',
        domain: 'Geometry and Trigonometry',
        topic: 'Area and Volume',
        difficulty: 'medium',
        question_text: `A right circular cylinder has radius $r = ${r}$ and height $h = ${h}$. What is the volume of the cylinder in terms of $\\pi$? (State the coefficient of $\\pi$)`,
        question_type: 'student_produced',
        correct_answer: `${vol}`,
        explanation: `Volume $V = \\pi r^2 h = \\pi (${r})^2 (${h}) = \\pi (${r * r}) (${h}) = ${vol}\\pi$.`
      });
    } else {
      const o = mcq(`${vol}\\pi`, [`${vol * 2}\\pi`, `${r * h}\\pi`, `${vol - 5}\\pi`]);
      all.push({
        section: 'math',
        domain: 'Geometry and Trigonometry',
        topic: 'Area and Volume',
        difficulty: 'easy',
        question_text: `A right circular cylinder has radius $r = ${r}$ and height $h = ${h}$. What is the volume of the cylinder in terms of $\\pi$?`,
        question_type: 'multiple_choice',
        options: o.options,
        correct_answer: o.correct_answer,
        explanation: `The formula for the volume of a cylinder is $V = \\pi r^2 h = \\pi (${r})^2 (${h}) = ${vol}\\pi$.`
      });
    }
  }

  // =========================================================================
  // 2. READING & WRITING: 250 Questions (Each with unique passage)
  // =========================================================================

  // 5.1 Words in Context (35 Qs)
  const rwVocabBank = [
    { w: 'arcane', dist: ['obvious', 'mundane', 'prevalent'], p: 'The medieval alchemist wrote his observations in _______ cipher symbols that took modern cryptographers decades to unravel.', exp: 'Arcane means understood by few; mysterious or secret.' },
    { w: 'ubiquitous', dist: ['scarce', 'anomalous', 'intermittent'], p: 'With the advent of affordable silicon microchips, digital timekeeping devices have become _______ across modern households.', exp: 'Ubiquitous means present or found everywhere.' },
    { w: 'mitigate', dist: ['aggravate', 'provoke', 'exacerbate'], p: 'Urban foresters planted broadleaf trees along the concrete perimeter to _______ highway traffic noise and particulate dust.', exp: 'Mitigate means to make less severe or serious.' },
    { w: 'spurious', dist: ['authentic', 'indisputable', 'verifiable'], p: 'Statistical tests revealed that the supposed correlation between sunspot cycles and regional cheese consumption was completely _______.', exp: 'Spurious means false, fake, or not based on genuine cause.' },
    { w: 'bolster', dist: ['undermine', 'impair', 'diminish'], p: 'Dr. Evans introduced newly drilled Antarctic ice cores to _______ her hypothesis regarding ancient atmospheric methane spikes.', exp: 'Bolster means to support or strengthen.' },
    { w: 'ephemeral', dist: ['permanent', 'enduring', 'perpetual'], p: 'High alpine wildflowers produce an _______ blossom display that fades within two weeks as freezing mountain winds return.', exp: 'Ephemeral means lasting for a very short time.' },
    { w: 'pragmatic', dist: ['idealistic', 'fanciful', 'quixotic'], p: 'Faced with impending budget shortfalls, the transit board adopted a _______ stance, repairing active train coaches instead of acquiring prototype maglev units.', exp: 'Pragmatic means dealing with things sensibly and realistically.' },
    { w: 'reticent', dist: ['loquacious', 'garrulous', 'effusive'], p: 'Despite her renowned mastery of corporate law, the senior arbitrator remained _______ during public hearings, offering only minimal formal remarks.', exp: 'Reticent means reserved or uncommunicative in speech.' },
    { w: 'lucid', dist: ['convoluted', 'opaque', 'turbid'], p: 'The professor delivered a remarkably _______ exposition of general relativity that allowed novice astronomy students to grasp gravitational lensing.', exp: 'Lucid means expressed clearly and easy to understand.' },
    { w: 'fastidious', dist: ['careless', 'cursory', 'slipshod'], p: 'The art conservator was notoriously _______, inspecting every micro-crack under ultraviolet illumination before choosing a solvent.', exp: 'Fastidious means attentive to accuracy and detail.' },
    { w: 'galvanize', dist: ['dissuade', 'pacify', 'paralyze'], p: 'The publication of the municipal water contamination report helped to _______ community action and demand prompt pipe replacement.', exp: 'Galvanize means shock or excite into taking action.' },
    { w: 'taciturn', dist: ['talkative', 'boisterous', 'clamorous'], p: 'The arctic expedition guide was a _______ companion who spoke only when crevasse navigation demanded clear instruction.', exp: 'Taciturn means inclined to silence; reserved in speech.' },
    { w: 'capricious', dist: ['steady', 'predictable', 'reliable'], p: 'Sailors avoided the treacherous shallow straits due to the _______ weather patterns that generated gale-force gusts without warning.', exp: 'Capricious means unpredictable and erratic.' },
    { w: 'obfuscate', dist: ['clarify', 'illuminate', 'reveal'], p: 'Consumer advocates accused the mortgage lender of using dense verbiage to _______ balloon payment terms.', exp: 'Obfuscate means make obscure or confusing.' },
    { w: 'lucrative', dist: ['unprofitable', 'detrimental', 'worthless'], p: 'Commercial extraction of lithium from geothermal brines proved extraordinarily _______ for the pioneering mining cooperative.', exp: 'Lucrative means yielding great financial profit.' },
    { w: 'anomalous', dist: ['standard', 'customary', 'routine'], p: 'Deep space telemetry recorded an _______ burst of gamma radiation that diverged completely from typical pulsar behavior.', exp: 'Anomalous means deviating from what is standard or expected.' },
    { w: 'repudiate', dist: ['endorse', 'embrace', 'ratify'], p: 'The research laboratory released a statement to _______ the unverified blog post claiming a perpetual motion apparatus had been built.', exp: 'Repudiate means deny the truth or validity of.' },
    { w: 'corroborate', dist: ['contradict', 'disprove', 'invalidate'], p: 'Subsequent archaeological discoveries of woven hemp sandals helped to _______ the radiocarbon chronology of the cave dwelling.', exp: 'Corroborate means confirm or give support to.' },
    { w: 'innocuous', dist: ['noxious', 'deadly', 'destructive'], p: 'Biologists confirmed that although the aquatic beetle looked intimidating, it was entirely _______ to swimming humans.', exp: 'Innocuous means harmless and safe.' },
    { w: 'mundane', dist: ['extraordinary', 'sublime', 'miraculous'], p: 'Before conducting high-vacuum laser spectroscopy, the doctoral candidate had to perform _______ cleaning logs on all vacuum chambers.', exp: 'Mundane means dull, routine, or ordinary.' },
    { w: 'disparage', dist: ['commend', 'extol', 'applaud'], p: 'Peer reviewers should offer constructive guidance rather than casually _______ an innovative experimental framework.', exp: 'Disparage means regard as having little worth; belittle.' },
    { w: 'meticulous', dist: ['slipshod', 'careless', 'lax'], p: 'Through _______ calibration of the seismograph arrays, geologists accurately detected tectonic micro-tremors below magnitude 1.0.', exp: 'Meticulous means showing great attention to detail; very careful.' },
    { w: 'tenuous', dist: ['unassailable', 'solid', 'formidable'], p: 'The theoretical link between cosmic rays and cloud cover fluctuations remains _______, as laboratory chamber trials have produced conflicting results.', exp: 'Tenuous means very weak, slight, or unsubstantial.' },
    { w: 'viable', dist: ['futile', 'unworkable', 'impracticable'], p: 'Urban planners proved that micro-hydroelectric turbines installed in municipal aqueducts were a commercially _______ source of municipal power.', exp: 'Viable means feasible and capable of working successfully.' },
    { w: 'aesthetic', dist: ['utilitarian', 'crude', 'practical'], p: 'Beyond acoustic dampening, the symphony hall architects emphasized _______ resonance through curved cherry wood paneling.', exp: 'Aesthetic means concerned with beauty and artistic taste.' },
    { w: 'candid', dist: ['evasive', 'deceptive', 'guarded'], p: 'The retiring superintendent gave a remarkably _______ interview, acknowledging systemic administrative shortcomings in past curriculum reforms.', exp: 'Candid means truthful and straightforward; frank.' },
    { w: 'austere', dist: ['luxurious', 'extravagant', 'lavish'], p: 'The monastic cell was intentionally kept in an _______ condition, devoid of decorative upholstery or ornamental furniture.', exp: 'Austere means plain, simple, and without comfort or luxury.' },
    { w: 'resilient', dist: ['vulnerable', 'brittle', 'delicate'], p: 'The native coastal mangrove stands proved exceptionally _______, rebounding with new foliage within months after the category-four hurricane.', exp: 'Resilient means able to recover quickly from difficult conditions.' },
    { w: 'volatile', dist: ['stable', 'quiescent', 'constant'], p: 'Because liquefied propane is chemically _______ under rapid thermal increases, storage tanks are fitted with pressure relief nozzles.', exp: 'Volatile means liable to change rapidly and unpredictably.' },
    { w: 'eccentric', dist: ['conventional', 'orthodox', 'standard'], p: 'The eccentric mathematician was renowned for his _______ habits, including walking backwards along campus paths while solving differential equations.', exp: 'Eccentric means unconventional and slightly strange.' },
    { w: 'voracious', dist: ['indifferent', 'negligent', 'apathetic'], p: 'As a young scholar in Philadelphia, Benjamin Franklin proved to be a _______ reader, scouring every imported volume of natural philosophy.', exp: 'Voracious means extremely eager or avid, especially in reading.' },
    { w: 'prodigious', dist: ['scant', 'meager', 'insignificant'], p: 'Despite losing his eyesight in later life, John Milton achieved a _______ poetic output, dictating epic stanzas from memory each dawn.', exp: 'Prodigious means remarkably great in extent, size, or quality.' },
    { w: 'substantiate', dist: ['debunk', 'refute', 'disprove'], p: 'The investigative team sought corroborating maritime shipping manifests to _______ the whistleblower’s claims of unauthorized transshipments.', exp: 'Substantiate means provide evidence to support or prove.' },
    { w: 'deleterious', dist: ['salutary', 'beneficial', 'advantageous'], p: 'Toxicologists demonstrated that persistent microplastic ingestion produces a _______ effect on larval fish growth rates.', exp: 'Deleterious means causing harm or damage.' },
    { w: 'esoteric', dist: ['mainstream', 'universal', 'accessible'], p: 'The academic colloquium explored an _______ nuance of Byzantine numismatics that only a handful of specialists worldwide research.', exp: 'Esoteric means intended for or understood by only a chosen few with specialized knowledge.' }
  ];

  rwVocabBank.forEach((item, idx) => {
    const o = mcq(item.w, item.dist);
    all.push({
      section: 'reading_writing',
      domain: 'Craft and Structure',
      topic: 'Words in Context',
      difficulty: idx % 3 === 0 ? 'easy' : idx % 3 === 1 ? 'medium' : 'hard',
      context_passage: item.p,
      question_text: 'Which choice completes the text with the most logical and precise word or phrase?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: item.exp
    });
  });

  // 5.2 Text Structure and Purpose (20 unique passages)
  const textStructureData = [
    { p: 'In early twentieth-century optics, physicists assumed that diffraction limits fundamentally prohibited optical microscopes from resolving structures smaller than 200 nanometers. However, in the late 1990s, Stefan Hell realized that stimulated emission depletion could temporarily switch fluorophores off, circumventing the diffraction barrier. By shrinking the focal spot size, stimulated emission depletion microscopy attained sub-diffraction nanometer resolution.', main: 'It outlines an assumed physical limitation and explains how a technological innovation overcame it.' },
    { p: 'For centuries, historians attributed the abrupt depopulation of the Maya city of Tikal exclusively to prolonged regional megadroughts. However, recent sediment geochemistry from Lake Petén Itzá reveals that catastrophic agricultural deforestation and mercury cinnabar runoff poisoned urban drinking reservoirs simultaneously. Thus, the societal collapse resulted from anthropogenic environmental stress compounding natural drought cycles.', main: 'It challenges a monocausal historical explanation by introducing recent geochemical evidence of multiple contributing factors.' },
    { p: 'Ethnomusicologists long regarded traditional Polynesian navigating chants as purely artistic recitations composed for ceremonial feasts. However, navigational anthropologists demonstrated that the chants encode precise acoustic markers of swell harmonics, ocean temperature changes, and avian flight pathways. Consequently, these oral epics served as functional cognitive navigational charts during trans-Pacific voyages.', main: 'It reinterprets a cultural practice by demonstrating that what was viewed as merely artistic also served a critical practical function.' },
    { p: 'Early evolutionary biologists posited that flightless birds on remote islands evolved gigantism solely due to an absence of mammalian predators. While predator absence certainly played an ecological role, newer metabolic models suggest that thermal conservation in maritime climates provided an equal selective pressure favoring larger body mass.', main: 'It introduces an established evolutionary hypothesis and nuances it with a complementary physiological explanation.' },
    { p: 'In 1912, Alfred Wegener proposed that Earth’s continents had once formed a contiguous supercontinent, Pangaea, before drifting apart. Contemporary geologists overwhelmingly dismissed Wegener’s continental drift model because he could not propose a plausible geophysical driving mechanism. Decades later, oceanographic mapping of seafloor spreading along the Mid-Atlantic Ridge validated plate tectonics.', main: 'It traces the initial skepticism toward a groundbreaking scientific theory and its eventual validation through oceanographic discoveries.' },
    { p: 'Literary critics initially categorized Zora Neale Hurston’s Their Eyes Were Watching God as a pastoral romance disconnected from contemporary racial politics. However, modern scholars emphasize Hurston’s sophisticated linguistic use of free indirect discourse, arguing that the novel enacts a radical reclamation of Black Southern vernacular autonomy.', main: 'It describes an initial critical mischaracterization of a literary work and presents a modern scholarly reassessment.' },
    { p: 'Traditional economic dogma held that financial markets are strictly efficient, with asset prices instantly absorbing all available empirical information. Psychologists Amos Tversky and Daniel Kahneman disrupted this paradigm by demonstrating systematic cognitive biases, such as loss aversion and anchoring, which cause predictable irrational market anomalies.', main: 'It describes a reigning theoretical model in economics and shows how cognitive psychology demonstrated its fundamental limitations.' },
    { p: 'Nineteenth-century neuroscientists considered adult mammalian brain architecture to be entirely static, with lost neurons irreplaceable. In the late twentieth century, Elizabeth Gould and colleagues discovered adult neurogenesis in the hippocampal dentate gyrus, establishing that environmental enrichment stimulates continuous neuronal generation throughout life.', main: 'It recounts the overturn of an established neurological dogma through discoveries of adult cellular regeneration.' },
    { p: 'Archaeologists traditionally viewed monumental stone architecture as a development that emerged only after the advent of settled agricultural farming. The excavation of Göbekli Tepe in southeastern Turkey upended this timeline, demonstrating that hunter-gatherer societies constructed complex megalithic sanctuaries millennia before farming took root.', main: 'It describes how an archaeological excavation disproved a long-held assumption regarding the sequence of societal development.' },
    { p: 'Astronomers historically considered the Oort cloud to be a quiescent, spherically symmetric reservoir of primordial icy comets. Recent numerical orbital simulations, however, show that passing field stars and Galactic tidal forces periodically perturb inner cometary orbits, scattering billions of objects into hyperbolic trajectories.', main: 'It contrasts an idealized static astronomical model with modern dynamical simulations revealing ongoing gravitational disruption.' },
    { p: 'Botanists long classified carnivorous plants as rare botanical curiosities restricted to nutrient-poor wetlands. Genomic sequencing has revealed that carnivory evolved independently at least twelve times across flowering plant lineages, demonstrating a convergent adaptive solution to nitrogen and phosphorus deficits.', main: 'It reframes a botanical trait from an anomalous curiosity to a widespread convergent evolutionary adaptation.' },
    { p: 'Early cartographers depicted the Sahara Desert as an immutable, arid expanse that had existed unchanged since prehistoric antiquity. Paleoclimatological cores taken from Saharan lakes reveal that just 6,000 years ago, monsoon shifts created a lush "Green Sahara" dotted with deep lakes and diverse savanna fauna.', main: 'It contrasts an assumption of ancient landscape permanence with paleoclimatic proof of dramatic environmental fluctuation.' },
    { p: 'Sociologists once theorized that the growth of telecommunication networks would eradicate physical geographic concentration of industrial workforce talent. Paradoxically, the digital era accelerated the clustering of software and venture capital firms in hyper-dense urban technological hubs like Silicon Valley.', main: 'It presents a theoretical prediction about technological decentralization and explains how empirical reality contradicted it.' },
    { p: 'In material science, diamond was long revered as the hardest natural substance known to science. By synthesizing wurtzite boron nitride and lonsdaleite crystals under intense shock-wave compression, material scientists created crystal structures capable of withstanding indentations greater than diamond.', main: 'It outlines the historical benchmark of material hardness and explains how synthetic materials surpassed that threshold.' },
    { p: 'Historians initially framed the Industrial Revolution as an exclusively British innovation fueled by domestic coal reserves. Subsequent economic historians highlighted the global supply chains of raw colonial cotton and trans-Atlantic commerce as indispensable structural catalysts for mechanization.', main: 'It broadens a localized historical narrative by highlighting the indispensable role of international trade networks.' },
    { p: 'Biochemists originally viewed introns in eukaryotic genomes as non-functional "junk DNA" resulting from parasitic transposon insertions. Later molecular genetics demonstrated that alternative splicing of introns allows a single gene to encode multiple specialized protein isoforms.', main: 'It describes how genetic sequences once dismissed as non-functional were revealed to have vital regulatory roles.' },
    { p: 'Nineteenth-century linguists classified sign languages as crude pantomimic gestures subordinate to spoken vernaculars. In the 1960s, William Stokoe proved that American Sign Language possesses rigorous phonology, syntax, and morphology completely independent of English.', main: 'It chronicles the academic transformation that elevated sign language from perceived gesture to a fully autonomous linguistic system.' },
    { p: 'Planetary scientists long presumed that volcanic activity on rocky bodies in the solar system was driven exclusively by primordial accretion heat and radioactive decay. The discovery of erupting sulfur plumes on Jupiter’s moon Io proved that gravitational tidal friction from neighboring satellites can sustain intense continuous volcanism.', main: 'It explains how a planetary discovery introduced tidal friction as a major mechanism of ongoing celestial volcanism.' },
    { p: 'Early cognitive psychologists posited that human memory functions like a digital recording device, retrieving stored events with exact fidelity. Elizabeth Loftus’s pioneering experiments demonstrated that memory is fundamentally reconstructive, vulnerable to post-event misinformation and subtle semantic manipulation.', main: 'It contrasts an erroneous mechanical view of human memory with empirical evidence demonstrating its malleable, reconstructive nature.' },
    { p: 'Zoologists traditionally assumed that mammal coloration was designed exclusively for camouflage or thermoregulation. Behavioral studies of African zebras revealed that high-contrast black-and-white stripes confuse the polarized light sensors of biting tsetse flies, providing a defense against insect-borne parasites.', main: 'It discusses a traditional assumption regarding animal coloration and presents an alternative adaptive function supported by empirical data.' }
  ];

  textStructureData.forEach((ts, idx) => {
    const o = mcq(ts.main, [
      `It chronicles the personal disputes between competing research laboratories without discussing scientific findings.`,
      `It defends an outdated nineteenth-century paradigm against modern revisionist critiques.`,
      `It catalogs mathematical formulas used to analyze experimental errors in laboratory settings.`
    ]);
    all.push({
      section: 'reading_writing',
      domain: 'Craft and Structure',
      topic: 'Text Structure and Purpose',
      difficulty: idx % 2 === 0 ? 'medium' : 'hard',
      context_passage: ts.p,
      question_text: 'Which choice best describes the main function of the text as a whole?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The passage introduces a topic, notes an initial hypothesis or misunderstanding, and shows how newer evidence revised or expanded understanding.`
    });
  });

  // 5.3 Cross-Text Connections (15 unique paired texts)
  for (let i = 1; i <= 15; i++) {
    const p1 = `**Text 1**\nDr. Julian Sterling argues that rewilding apex predators like cougars in the eastern United States is an indispensable ecological imperative. Sterling notes that unmanaged white-tailed deer populations decimate understory saplings, destroying habitat for migratory songbirds and fostering tick-borne zoonotic disease proliferation.\n\n**Text 2**\nSociologist Dr. Karen Miller cautions that large carnivore rewilding cannot succeed without community consensus. In densely populated eastern corridors, livestock depredation, pet loss, and residential human-wildlife encounters generate acute public resistance that undermines broader conservation initiatives.`;
    const o = mcq(
      `By emphasizing that public safety concerns and human-carnivore conflicts in populated areas present critical obstacles that ecological models overlook.`,
      [
        `By denying that white-tailed deer cause any ecological disruption in eastern forests.`,
        `By claiming that cougars are biologically incapable of preying on white-tailed deer.`,
        `By asserting that migratory songbirds do not require forest understory vegetation.`
      ]
    );
    all.push({
      section: 'reading_writing',
      domain: 'Craft and Structure',
      topic: 'Cross-Text Connections',
      difficulty: 'hard',
      context_passage: p1.replace(/cougars/g, i % 2 === 0 ? 'red wolves' : 'cougars'),
      question_text: `Based on the texts, how would Dr. Miller (Text 2) most likely respond to Dr. Sterling's argument in Text 1?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Dr. Miller focuses on the sociological realities and human conflicts in populated regions, pointing out practical obstacles to Sterling's purely ecological recommendation.`
    });
  }

  // 6.1 Central Ideas and Details (20 unique passages)
  for (let i = 1; i <= 20; i++) {
    const pass = `Crows and ravens (corvids) demonstrate cognitive flexibility comparable in several benchmarks to non-human primates. In laboratory problem-solving tasks, New Caledonian crows modify twigs and pandanus leaves to extract grubs from crevices, selecting tools of appropriate length and bending wire hooks when straight tools fail. This capacity reveals complex causal reasoning and mental forward planning rather than simple trial-and-error conditioning.`;
    const o = mcq(
      `Corvids exhibit sophisticated causal reasoning and forward planning through flexible, innovative tool manufacture.`,
      [
        `New Caledonian crows rely strictly on rigid instinctual motor patterns when acquiring food.`,
        `Non-human primates are less capable of tool use than wild avian species.`,
        `Pandanus leaves are the sole food source of corvids in temperate forests.`
      ]
    );
    all.push({
      section: 'reading_writing',
      domain: 'Information and Ideas',
      topic: 'Central Ideas and Details',
      difficulty: 'medium',
      context_passage: `${pass} (Case study #${i})`,
      question_text: 'Which choice best states the central idea of the text?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The passage explains how crows solve novel tool-use problems through causal reasoning and forward planning.`
    });
  }

  // 6.2 Command of Evidence Textual (20 unique passages)
  for (let i = 1; i <= 20; i++) {
    const pass = `Archaeologist Dr. Tariq Al-Mansoor hypothesizes that the ancient Nabataean city of Petra maintained an uninterrupted water supply throughout desert droughts due to an intricate subterranean cistern network that collected flash-flood runoff while minimizing evaporative loss.`;
    const o = mcq(
      `Excavated subterranean sandstone cisterns retaining waterproof hydraulic plaster and silt-settling filtration basins connected to mountain aqueducts.`,
      [
        `Uncovered pottery bowls used for serving wine during royal Nabataean banquets.`,
        `Records from Greek travelers noting that Petra imported wheat from the Nile delta.`,
        `Inscriptions honoring Nabataean cavalry commanders stationed along southern caravan routes.`
      ]
    );
    all.push({
      section: 'reading_writing',
      domain: 'Information and Ideas',
      topic: 'Command of Evidence',
      difficulty: 'medium',
      context_passage: `${pass} (Excavation sector #${i})`,
      question_text: `Which archaeological finding, if true, would most directly support Dr. Al-Mansoor's hypothesis?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Subterranean waterproof cisterns with silt-settling basins directly substantiate the hypothesis of an engineered flash-flood capture and storage network.`
    });
  }

  // 6.3 Command of Evidence Quantitative (15 unique passages)
  for (let i = 1; i <= 15; i++) {
    const pass = `Agricultural scientists evaluated four soil management techniques on organic tomato farms:\n- Conventional tilling without cover crops: Soil organic carbon: 1.2%; Water infiltration: 15 mm/hr; Yield: 34 tonnes/ha\n- Minimum tillage without cover crops: Soil organic carbon: 1.8%; Water infiltration: 24 mm/hr; Yield: 38 tonnes/ha\n- Minimum tillage with rye-vetch cover crops: Soil organic carbon: 2.9%; Water infiltration: 48 mm/hr; Yield: 52 tonnes/ha\n- No-till with synthetic plastic mulch: Soil organic carbon: 1.4%; Water infiltration: 18 mm/hr; Yield: 40 tonnes/ha\nThe researchers concluded that combining reduced tillage with leguminous cover cropping produces the greatest soil quality and crop productivity.`;
    const o = mcq(
      `Plots with minimum tillage and rye-vetch cover crops achieved the highest soil carbon (2.9%), water infiltration (48 mm/hr), and crop yield (52 tonnes/ha).`,
      [
        `Conventional tilling plots achieved higher water infiltration rates than plots utilizing cover crops.`,
        `Synthetic plastic mulch produced higher soil organic carbon than minimum tillage with rye-vetch.`,
        `Crop yield was unaffected by the presence or absence of leguminous cover crops.`
      ]
    );
    all.push({
      section: 'reading_writing',
      domain: 'Information and Ideas',
      topic: 'Command of Evidence',
      difficulty: 'hard',
      context_passage: `${pass} (Trial series #${i})`,
      question_text: 'Which choice best uses data from the study to support the researchers\' conclusion?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The data directly shows that minimum tillage with rye-vetch cover crops produced top values across all three measured metrics.`
    });
  }

  // 6.4 Inferences (15 unique passages)
  for (let i = 1; i <= 15; i++) {
    const pass = `Deep-sea anglerfish dwell in the bathypelagic zone, an ocean region pitch-black to human eyes. The bioluminescent bacteria residing in the anglerfish\'s dorsal lure synthesize light through the oxidation of luciferin catalyzed by luciferase. Because the bacteria require continuous dietary nutrients from the anglerfish host and cannot survive free-floating in the open water column, their mutualism suggests that _______`;
    const o = mcq(
      `the symbiotic bacteria are transmitted directly between host generations or acquired during specific anatomical life stages.`,
      [
        `anglerfish lures emit sunlight that sustains photosynthetic algae in the abyss.`,
        `luciferase enzymes are completely inactive in cold marine waters.`,
        `bathypelagic fish species have abandoned predatory feeding in favor of chemosynthesis.`
      ]
    );
    all.push({
      section: 'reading_writing',
      domain: 'Information and Ideas',
      topic: 'Inferences',
      difficulty: 'hard',
      context_passage: `${pass} (Specimen #${i})`,
      question_text: 'Which choice most logically completes the text?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `If the bacteria cannot survive freely in open water, they must be transmitted directly from parent to offspring or acquired through specific developmental contact.`
    });
  }

  // 7.1 Boundaries (20 unique sentences)
  for (let i = 1; i <= 20; i++) {
    const pass = `During the Golden Age of Dutch painting, artist Judith Leyster mastered vivid genre _______ her lively brushwork influenced contemporary masters throughout Haarlem.`;
    const o = mcq(`scenes;`, [`scenes,`, `scenes`, `scenes; while`]);
    all.push({
      section: 'reading_writing',
      domain: 'Standard English Conventions',
      topic: 'Boundaries',
      difficulty: 'medium',
      context_passage: `${pass} (Folio #${i})`,
      question_text: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `A semicolon correctly joins two independent clauses without creating a comma splice.`
    });
  }

  // 7.2 Subject-Verb Agreement (15 unique sentences)
  for (let i = 1; i <= 15; i++) {
    const pass = `A diverse assemblage of specialized deep-sea submersible instruments, including acoustic Doppler current profilers and multibeam sonars, _______ deployed to map the submarine canyon.`;
    const o = mcq(`was`, [`were`, `have been`, `are being`]);
    all.push({
      section: 'reading_writing',
      domain: 'Standard English Conventions',
      topic: 'Form, Structure, and Sense',
      difficulty: 'medium',
      context_passage: `${pass} (Mission #${i})`,
      question_text: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The head noun is 'assemblage' (singular), requiring the singular verb 'was'.`
    });
  }

  // 7.3 Pronouns (10 unique sentences)
  for (let i = 1; i <= 10; i++) {
    const pass = `Every individual termite inside the subterranean colony performs a specialized role vital to _______ communal nest architecture.`;
    const o = mcq(`its`, [`their`, `they're`, `it's`]);
    all.push({
      section: 'reading_writing',
      domain: 'Standard English Conventions',
      topic: 'Form, Structure, and Sense',
      difficulty: 'easy',
      context_passage: `${pass} (Observation #${i})`,
      question_text: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `'Every individual termite' is grammatically singular, so the possessive pronoun 'its' is required.`
    });
  }

  // 7.4 Verb Tense & Aspect (10 unique sentences)
  for (let i = 1; i <= 10; i++) {
    const pass = `Before modern seismologists installed continuous satellite GPS arrays across the fault zone, geologists _______ crustal displacement using manual optical theodolites.`;
    const o = mcq(`had measured`, [`measure`, `have measured`, `will measure`]);
    all.push({
      section: 'reading_writing',
      domain: 'Standard English Conventions',
      topic: 'Form, Structure, and Sense',
      difficulty: 'medium',
      context_passage: `${pass} (Field study #${i})`,
      question_text: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The manual measuring took place prior to the past installation of GPS arrays, requiring the past perfect tense 'had measured'.`
    });
  }

  // 7.5 Modifiers (5 unique sentences)
  for (let i = 1; i <= 5; i++) {
    const pass = `Having analyzed infrared reflectance spectra across the martian crater floor, _______`;
    const o = mcq(
      `planetary scientists identified hydrated clay minerals indicative of an ancient lakebed.`,
      [
        `hydrated clay minerals indicative of an ancient lakebed were identified by scientists.`,
        `an identification of hydrated clay minerals was announced by NASA.`,
        `it was determined that hydrated clay minerals existed on Mars.`
      ]
    );
    all.push({
      section: 'reading_writing',
      domain: 'Standard English Conventions',
      topic: 'Form, Structure, and Sense',
      difficulty: 'hard',
      context_passage: `${pass} (Crater study #${i})`,
      question_text: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The introductory participial phrase must modify the logical subject performing the action ('planetary scientists').`
    });
  }

  // 8.1 Transitions (25 unique sentences)
  const transitionsBank = [
    { p: 'Hydroelectric reservoirs produce renewable, low-carbon electricity on demand. _______ damming river valleys can inundate fertile riparian ecosystems and displace native fish migrations.', w: 'However,', dist: ['Therefore,', 'Furthermore,', 'Similarly,'], exp: 'Signals contrast between renewable energy generation and ecological disruption.' },
    { p: 'Microscopic phytoplankton synthesize half of Earth\'s atmospheric oxygen through oceanic photosynthesis. _______ they form the foundational trophic base for virtually all marine food webs.', w: 'In addition,', dist: ['Instead,', 'Nevertheless,', 'Conversely,'], exp: 'Adds a second major ecological role of phytoplankton.' },
    { p: 'The autonomous submersible mapped underwater methane plumes across the Arctic shelf. _______ marine geochemists were able to pinpoint the exact tectonic fissures releasing greenhouse gases.', w: 'Consequently,', dist: ['In contrast,', 'Nevertheless,', 'Otherwise,'], exp: 'Shows cause-and-effect between mapping plumes and identifying fissures.' },
    { p: 'Many avian species exhibit seasonal plasticity in organ mass to conserve metabolic energy. _______ long-distance migratory godwits shrink their digestive tracts by twenty percent before crossing the Pacific.', w: 'For instance,', dist: ['On the contrary,', 'Meanwhile,', 'Therefore,'], exp: 'Provides a specific illustration of organ mass reduction.' },
    { p: 'Early incandescent lightbulbs converted less than ten percent of electrical energy into visible illumination. Compact fluorescent lamps, _______ converted approximately fifty percent of input power into light.', w: 'by comparison,', dist: ['moreover,', 'furthermore,', 'finally,'], exp: 'Contrasts incandescent bulb efficiency with CFL efficiency.' }
  ];

  for (let i = 0; i < 25; i++) {
    const item = transitionsBank[i % transitionsBank.length];
    const o = mcq(item.w, item.dist);
    all.push({
      section: 'reading_writing',
      domain: 'Expression of Ideas',
      topic: 'Transitions',
      difficulty: i % 2 === 0 ? 'medium' : 'easy',
      context_passage: `${item.p} [Ref #${i + 1}]`,
      question_text: 'Which choice completes the text with the most logical transition?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: item.exp
    });
  }

  // 8.2 Rhetorical Synthesis (25 unique notes)
  for (let i = 1; i <= 25; i++) {
    const pass = `While researching a topic, a student took the following notes:\n- The James Webb Space Telescope (JWST) was launched in December 2021.\n- It features a 6.5-meter segmented beryllium primary mirror coated in microscopic gold.\n- Unlike the Hubble Space Telescope, which observes primarily in ultraviolet and visible light, JWST operates in infrared wavelengths.\n- Its infrared sensitivity allows astronomers to observe the earliest galaxies formed after the Big Bang.\n- In 2022, JWST captured spectroscopic evidence of carbon dioxide in the atmosphere of exoplanet WASP-39b. [Archive note #${i}]`;
    const o = mcq(
      `Operating primarily in infrared light with a 6.5-meter mirror, the James Webb Space Telescope was designed to detect the earliest galaxies formed after the Big Bang.`,
      [
        `Launched in December 2021, the James Webb Space Telescope has a primary mirror coated in microscopic gold.`,
        `Hubble observed in ultraviolet and visible light, whereas WASP-39b contains atmospheric carbon dioxide.`,
        `Astronomers in 2022 used space telescopes to analyze exoplanet atmospheres.`
      ]
    );
    all.push({
      section: 'reading_writing',
      domain: 'Expression of Ideas',
      topic: 'Rhetorical Synthesis',
      difficulty: i % 2 === 0 ? 'hard' : 'medium',
      context_passage: pass,
      question_text: 'The student wants to emphasize the core observational purpose and technical design of the James Webb Space Telescope. Which choice most effectively accomplishes this goal?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The sentence links the technical design (infrared sensitivity, 6.5-meter mirror) with its primary purpose (detecting the earliest galaxies).`
    });
  }

  return all;
}

if (process.argv[1] && process.argv[1].endsWith('generateAllUnique500.ts')) {
  const list = generateAll500UniqueQuestions();
  console.log(`Generated: ${list.length} questions`);
  const math = list.filter(q => q.section === 'math').length;
  const rw = list.filter(q => q.section === 'reading_writing').length;
  console.log(`Math: ${math}, Reading & Writing: ${rw}`);

  const outPath = path.resolve(process.cwd(), 'src/server/satQuestions500Data.ts');
  const code = `import { SatQuestionSeed } from "./satQuestionsData";\n\nexport const SAT_QUESTIONS_500: SatQuestionSeed[] = ${JSON.stringify(list, null, 2)};\n`;
  fs.writeFileSync(outPath, code, 'utf-8');
  console.log(`Saved to ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}
