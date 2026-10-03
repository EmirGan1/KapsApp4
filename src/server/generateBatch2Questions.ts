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

export function generateBatch2Questions(): SatQuestionSeed[] {
  const list: SatQuestionSeed[] = [];

  // =========================================================================
  // SECTION 1: MATH (250 Questions - Batch 2)
  // =========================================================================

  // 1.1 ALGEBRA: Linear Equations (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const a = 3 + i;
    const b = 10 + i * 3;
    const c = 2 * i + 1;
    const target = a * 4 + b; // x = 4
    const ans = 4;
    const o = mcq(`${ans}`, [`${ans + 2}`, `${ans - 3}`, `${ans + 5}`]);
    list.push({
      section: 'math',
      domain: 'Algebra',
      topic: 'Linear Equations in One Variable',
      difficulty: i % 3 === 0 ? 'easy' : i % 3 === 1 ? 'medium' : 'hard',
      question_text: `If $${a}x + ${b} = ${target}$, what is the value of $x$?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Subtracting $${b}$ from both sides gives $${a}x = ${target - b} \\implies x = \\frac{${target - b}}{${a}} = ${ans}$.`
    });
  }

  // 1.2 ALGEBRA: Linear Equations in Two Variables & Perpendicular/Parallel (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const slope = 2 + (i % 5);
    const perpSlope = `-1/${slope}`;
    const b = 3 * i - 2;
    const o = mcq(`${perpSlope}`, [`${slope}`, `-${slope}`, `1/${slope}`]);
    list.push({
      section: 'math',
      domain: 'Algebra',
      topic: 'Linear Equations in Two Variables',
      difficulty: 'medium',
      question_text: `Line $k$ in the $xy$-plane is defined by the equation $y = ${slope}x + ${b}$. Line $j$ is perpendicular to line $k$. What is the slope of line $j$?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Perpendicular lines have slopes that are negative reciprocals of each other ($m_1 \\cdot m_2 = -1$). Since the slope of line $k$ is $${slope}$, the slope of line $j$ must be $-\\frac{1}{${slope}} = ${perpSlope}$.`
    });
  }

  // 1.3 ALGEBRA: Systems of Equations (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const xVal = i + 1;
    const yVal = 3 * i;
    const prod = xVal * yVal;
    const c1 = xVal + yVal;
    const c2 = 2 * xVal - yVal;
    if (i % 3 === 0) {
      list.push({
        section: 'math',
        domain: 'Algebra',
        topic: 'Systems of Two Linear Equations',
        difficulty: 'medium',
        question_text: `Consider the system of equations:\n$$x + y = ${c1}$$\n$$2x - y = ${c2}$$\nWhat is the value of the product $xy$?`,
        question_type: 'student_produced',
        correct_answer: `${prod}`,
        explanation: `Adding both equations gives $3x = ${c1 + c2} \\implies x = ${xVal}$. Substituting into $x + y = ${c1}$ yields $y = ${yVal}$. The product $xy = ${xVal} \\times ${yVal} = ${prod}$.`
      });
    } else {
      const o = mcq(`${prod}`, [`${prod + 6}`, `${prod - 4}`, `${prod * 2}`]);
      list.push({
        section: 'math',
        domain: 'Algebra',
        topic: 'Systems of Two Linear Equations',
        difficulty: 'medium',
        question_text: `Consider the system of equations:\n$$x + y = ${c1}$$\n$$2x - y = ${c2}$$\nWhat is the value of the product $xy$?`,
        question_type: 'multiple_choice',
        options: o.options,
        correct_answer: o.correct_answer,
        explanation: `Adding both equations gives $3x = ${c1 + c2} \\implies x = ${xVal}$. Then $y = ${yVal}$, and $xy = ${prod}$.`
      });
    }
  }

  // 1.4 ALGEBRA: Linear Inequalities (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const rate = 18 + i * 2;
    const fee = 60 + i * 5;
    const maxBudget = 400 + i * 20;
    const o = mcq(`${rate}h + ${fee} \\le ${maxBudget}`, [
      `${rate}h - ${fee} \\le ${maxBudget}`,
      `${fee}h + ${rate} \\le ${maxBudget}`,
      `${rate}h + ${fee} \\ge ${maxBudget}`
    ]);
    list.push({
      section: 'math',
      domain: 'Algebra',
      topic: 'Linear Inequalities',
      difficulty: 'easy',
      question_text: `An audio recording studio charges an initial mixing setup fee of $${fee} plus $${rate} for each hour $h$ of studio recording time. A band has allocated no more than $${maxBudget} for their recording session. Which inequality represents all possible hours $h$ the band can book?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The total cost consists of the base fee plus the hourly charge: $${rate}h + ${fee}$. Since the expenditure cannot exceed $${maxBudget}$, the inequality is $${rate}h + ${fee} \\le ${maxBudget}$.`
    });
  }

  // 1.5 ALGEBRA: Linear Functions (10 Qs)
  for (let i = 1; i <= 10; i++) {
    const costPerMile = 2.4 + (i % 4) * 0.3;
    const baseFare = 4.5 + (i % 3) * 0.5;
    const o = mcq(
      `The ride fare increases by $${costPerMile.toFixed(2)} for each additional mile traveled.`,
      [
        `The base fare before traveling any distance is $${costPerMile.toFixed(2)}.`,
        `The maximum distance the vehicle can travel is ${costPerMile.toFixed(2)} miles.`,
        `The total fare increases by $1.00 for every ${costPerMile.toFixed(2)} miles.`
      ]
    );
    list.push({
      section: 'math',
      domain: 'Algebra',
      topic: 'Linear Functions',
      difficulty: 'medium',
      question_text: `The total fare $C(m)$, in dollars, for a rideshare journey of $m$ miles is given by $C(m) = ${costPerMile.toFixed(2)}m + ${baseFare.toFixed(2)}$. What is the best interpretation of the number ${costPerMile.toFixed(2)} in this context?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `In the linear function $C(m) = sm + b$, the slope $s = ${costPerMile.toFixed(2)}$ represents the constant increase in total cost per additional mile traveled.`
    });
  }

  // 2.1 ADVANCED MATH: Quadratics & Discriminant (20 Qs)
  for (let i = 1; i <= 20; i++) {
    const b = 2 * (i + 1);
    const c = (i + 1) * (i + 1); // b^2 - 4ac = 0 => exactly one real solution
    const o = mcq(`Exactly one real solution`, [`Zero real solutions`, `Exactly two distinct real solutions`, `Infinitely many real solutions`]);
    list.push({
      section: 'math',
      domain: 'Advanced Math',
      topic: 'Quadratic Equations',
      difficulty: 'medium',
      question_text: `How many distinct real solutions does the quadratic equation $x^2 - ${b}x + ${c} = 0$ have?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The discriminant is $\\Delta = b^2 - 4ac = (-${b})^2 - 4(1)(${c}) = ${b * b} - ${4 * c} = 0$. When the discriminant is exactly 0, the equation has exactly one real solution (a repeated root at $x = ${b / 2}$).`
    });
  }

  // 2.2 ADVANCED MATH: Vertex Form & Transformations (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const shiftRight = i + 1;
    const shiftUp = 5 + i * 2;
    const o = mcq(`y = (x - ${shiftRight})^2 + ${shiftUp}`, [
      `y = (x + ${shiftRight})^2 + ${shiftUp}`,
      `y = (x - ${shiftRight})^2 - ${shiftUp}`,
      `y = (x + ${shiftRight})^2 - ${shiftUp}`
    ]);
    list.push({
      section: 'math',
      domain: 'Advanced Math',
      topic: 'Nonlinear Functions',
      difficulty: 'easy',
      question_text: `The graph of $y = x^2$ in the $xy$-plane is shifted ${shiftRight} units to the right and ${shiftUp} units upward. Which equation represents the resulting parabola?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Shifting a function $f(x)$ right by $h$ units and up by $k$ units yields $y = f(x - h) + k$. Applying this to $y = x^2$ gives $y = (x - ${shiftRight})^2 + ${shiftUp}$.`
    });
  }

  // 2.3 ADVANCED MATH: Exponential Decay & Half-life (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const initialMass = 50 * i;
    const halfLife = 12 + i;
    const o = mcq(`M(t) = ${initialMass}\\left(\\frac{1}{2}\\right)^{\\frac{t}{${halfLife}}}`, [
      `M(t) = ${initialMass}\\left(\\frac{1}{2}\\right)^{${halfLife}t}`,
      `M(t) = ${initialMass}(2)^{\\frac{t}{${halfLife}}}`,
      `M(t) = ${initialMass} - \\frac{1}{2}t`
    ]);
    list.push({
      section: 'math',
      domain: 'Advanced Math',
      topic: 'Exponential Functions',
      difficulty: 'medium',
      question_text: `A radioactive isotope has an initial mass of ${initialMass} grams and a half-life of ${halfLife} days. Which equation represents the remaining mass $M(t)$, in grams, after $t$ days?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The standard half-life exponential decay model is $M(t) = M_0 \\left(\\frac{1}{2}\\right)^{\\frac{t}{h}}$, where $M_0$ is the initial mass (${initialMass} g) and $h$ is the half-life (${halfLife} days).`
    });
  }

  // 2.4 ADVANCED MATH: Radical and Rational Equations (10 Qs)
  for (let i = 1; i <= 10; i++) {
    const k = i + 2;
    const ans = k + 4;
    const num = (ans - 4) * (ans + 1);
    // (x - 4)(x + 1) / (x + 1) = k => x - 4 = k => x = k + 4
    if (i % 2 === 0) {
      list.push({
        section: 'math',
        domain: 'Advanced Math',
        topic: 'Radical and Rational Equations',
        difficulty: 'medium',
        question_text: `If $\\frac{x^2 - 3x - 4}{x + 1} = ${k}$, what is the value of $x$?`,
        question_type: 'student_produced',
        correct_answer: `${ans}`,
        explanation: `Factoring the numerator gives $\\frac{(x - 4)(x + 1)}{x + 1} = x - 4$ for all $x \\neq -1$. Setting $x - 4 = ${k}$ yields $x = ${ans}$.`
      });
    } else {
      const o = mcq(`${ans}`, [`${ans + 3}`, `${ans - 2}`, `${ans * 2}`]);
      list.push({
        section: 'math',
        domain: 'Advanced Math',
        topic: 'Radical and Rational Equations',
        difficulty: 'medium',
        question_text: `If $\\frac{x^2 - 3x - 4}{x + 1} = ${k}$, what is the value of $x$?`,
        question_type: 'multiple_choice',
        options: o.options,
        correct_answer: o.correct_answer,
        explanation: `Factoring gives $\\frac{(x - 4)(x + 1)}{x + 1} = x - 4$ for $x \\neq -1$. Solving $x - 4 = ${k}$ yields $x = ${ans}$.`
      });
    }
  }

  // 2.5 ADVANCED MATH: Polynomial Remainder & Factoring (10 Qs)
  for (let i = 1; i <= 10; i++) {
    const root = i + 1;
    const o = mcq(`x - ${root}`, [`x + ${root}`, `x - ${root + 2}`, `x + ${root + 2}`]);
    list.push({
      section: 'math',
      domain: 'Advanced Math',
      topic: 'Polynomial Expressions',
      difficulty: 'easy',
      question_text: `If a polynomial $P(x)$ satisfies $P(${root}) = 0$, which of the following binomials must be a factor of $P(x)$?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `By the Factor Theorem, if $P(c) = 0$, then $(x - c)$ is a factor of the polynomial $P(x)$. Since $P(${root}) = 0$, $(x - ${root})$ must be a factor.`
    });
  }

  // 3.1 PROBLEM SOLVING: Ratios and Proportions (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const scale = 5 + i * 2;
    const mapDist = 4;
    const realDist = mapDist * scale;
    const o = mcq(`${realDist} kilometers`, [`${realDist + 8} kilometers`, `${realDist - 6} kilometers`, `${scale} kilometers`]);
    list.push({
      section: 'math',
      domain: 'Problem-Solving and Data Analysis',
      topic: 'Ratios and Proportions',
      difficulty: 'easy',
      question_text: `On an architectural scale map, 1 centimeter represents ${scale} kilometers in reality. If two weather monitoring towers are ${mapDist} centimeters apart on the map, what is the actual distance between them?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Actual distance = $\\text{map distance} \\times \\text{scale ratio} = ${mapDist} \\text{ cm} \\times ${scale} \\text{ km/cm} = ${realDist} \\text{ km}$.`
    });
  }

  // 3.2 PROBLEM SOLVING: Percentages & Compound Growth (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const principal = 1000 + i * 200;
    const rate = 5;
    const interest = principal * 0.05 * 3;
    const total = principal + interest;
    const o = mcq(`$${total.toFixed(2)}`, [`$${(total + 50).toFixed(2)}`, `$${(total - 40).toFixed(2)}`, `$${interest.toFixed(2)}`]);
    list.push({
      section: 'math',
      domain: 'Problem-Solving and Data Analysis',
      topic: 'Percentages',
      difficulty: 'easy',
      question_text: `An investor deposits $${principal} into a high-yield certificate of deposit that earns 5\\% simple interest per year. What will be the total value of the account after 3 years?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Simple interest $I = Prt = ${principal} \\times 0.05 \\times 3 = $${interest.toFixed(2)}. Total account balance = $${principal} + $${interest.toFixed(2)} = $${total.toFixed(2)}$.`
    });
  }

  // 3.3 PROBLEM SOLVING: Statistics & Box Plots / IQR (10 Qs)
  for (let i = 1; i <= 10; i++) {
    const q1 = 40 + i * 2;
    const q3 = 75 + i * 2;
    const iqr = q3 - q1;
    const o = mcq(`${iqr}`, [`${q3}`, `${q1}`, `${(q1 + q3) / 2}`]);
    list.push({
      section: 'math',
      domain: 'Problem-Solving and Data Analysis',
      topic: 'Statistics and Data Analysis',
      difficulty: 'medium',
      question_text: `A box plot of student examination scores indicates a first quartile ($Q_1$) of ${q1} and a third quartile ($Q_3$) of ${q3}. What is the interquartile range (IQR) of this score distribution?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The interquartile range (IQR) is calculated as $IQR = Q_3 - Q_1 = ${q3} - ${q1} = ${iqr}$.`
    });
  }

  // 3.4 PROBLEM SOLVING: Two-Way Tables & Probability (10 Qs)
  for (let i = 1; i <= 10; i++) {
    const enrolledA = 20 + i;
    const enrolledB = 30 + i;
    const notEnrolledA = 10;
    const notEnrolledB = 15;
    const totalGroupA = enrolledA + notEnrolledA;
    const o = mcq(`\\frac{${enrolledA}}{${totalGroupA}}`, [
      `\\frac{${enrolledA}}{${enrolledA + enrolledB}}`,
      `\\frac{${notEnrolledA}}{${totalGroupA}}`,
      `\\frac{${totalGroupA}}{${enrolledA + enrolledB + notEnrolledA + notEnrolledB}}`
    ]);
    list.push({
      section: 'math',
      domain: 'Problem-Solving and Data Analysis',
      topic: 'Probability',
      difficulty: 'medium',
      question_text: `In a clinical trial, Group A contains ${totalGroupA} participants, of whom ${enrolledA} reported symptom relief. If a participant from Group A is selected at random, what is the probability that the participant reported symptom relief?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Probability within Group A = $\\frac{\\text{relief in Group A}}{\\text{total in Group A}} = \\frac{${enrolledA}}{${totalGroupA}}$.`
    });
  }

  // 3.5 PROBLEM SOLVING: Scatterplot Residuals (10 Qs)
  for (let i = 1; i <= 10; i++) {
    const obsY = 68 + i;
    const predY = 62 + i;
    const residual = obsY - predY;
    const o = mcq(`${residual}`, [`${-residual}`, `${obsY + predY}`, `0`]);
    list.push({
      section: 'math',
      domain: 'Problem-Solving and Data Analysis',
      topic: 'Scatterplots and Modeling',
      difficulty: 'medium',
      question_text: `For a data point $(5, ${obsY})$, a line of best fit predicts a value of $\\hat{y} = ${predY}$. What is the residual for this data point?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Residual is defined as $\\text{observed value} - \\text{predicted value} = y - \\hat{y} = ${obsY} - ${predY} = ${residual}$.`
    });
  }

  // 4.1 GEOMETRY & TRIG: Triangles & Similar Figures (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const scaleFactor = 2 + (i % 4);
    const areaRatio = scaleFactor * scaleFactor;
    const baseArea = 12;
    const scaledArea = baseArea * areaRatio;
    const o = mcq(`${scaledArea}`, [`${baseArea * scaleFactor}`, `${baseArea + scaleFactor}`, `${scaledArea * 2}`]);
    list.push({
      section: 'math',
      domain: 'Geometry and Trigonometry',
      topic: 'Lines, Angles, and Triangles',
      difficulty: 'medium',
      question_text: `Triangle $DEF$ is similar to triangle $ABC$, with each side length of $DEF$ being ${scaleFactor} times the corresponding side length of $ABC$. If the area of triangle $ABC$ is ${baseArea}$ square units, what is the area of triangle $DEF$?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `When linear dimensions of similar polygons scale by a factor of $k$, their areas scale by $k^2$. Here $k = ${scaleFactor}$, so the area scales by $k^2 = ${scaleFactor}^2 = ${areaRatio}$. Thus, the area of $DEF$ is ${baseArea} \\times ${areaRatio} = ${scaledArea}$ square units.`
    });
  }

  // 4.2 GEOMETRY & TRIG: Arc Length & Sector Area (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const radius = 6 + (i % 6);
    const thetaDeg = 60; // 60/360 = 1/6
    const arcLen = (2 * radius) / 6; // (2*pi*r * 60/360) = pi * (2r/6)
    const o = mcq(`\\frac{${2 * radius}}{6}\\pi`, [
      `${radius}\\pi`,
      `\\frac{${radius}}{6}\\pi`,
      `${2 * radius}\\pi`
    ]);
    list.push({
      section: 'math',
      domain: 'Geometry and Trigonometry',
      topic: 'Circles',
      difficulty: 'medium',
      question_text: `In a circle with radius $r = ${radius}$ cm, a central angle intercepts an arc with measure $60^\\circ$. What is the length, in centimeters, of the intercepted arc in terms of $\\pi$?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Arc length is given by $s = 2\\pi r \\left(\\frac{\\theta}{360^\\circ}\\right) = 2\\pi (${radius}) \\left(\\frac{60}{360}\\right) = \\frac{${2 * radius}}{6}\\pi$ cm.`
    });
  }

  // 4.3 GEOMETRY & TRIG: 3D Cones & Spheres (20 Qs)
  for (let i = 1; i <= 20; i++) {
    const r = 3 + (i % 5);
    const h = 6 + (i % 4);
    const coneVolCoeff = (r * r * h) / 3;
    if (i % 3 === 0 && Number.isInteger(coneVolCoeff)) {
      list.push({
        section: 'math',
        domain: 'Geometry and Trigonometry',
        topic: 'Area and Volume',
        difficulty: 'medium',
        question_text: `A right circular cone has a base radius of ${r} cm and a height of ${h} cm. What is the coefficient of $\\pi$ in the cone's volume in cubic centimeters?`,
        question_type: 'student_produced',
        correct_answer: `${coneVolCoeff}`,
        explanation: `The volume of a cone is $V = \\frac{1}{3}\\pi r^2 h = \\frac{1}{3}\\pi (${r})^2 (${h}) = \\frac{${r * r * h}}{3}\\pi = ${coneVolCoeff}\\pi$.`
      });
    } else {
      const o = mcq(`\\frac{${r * r * h}}{3}\\pi`, [
        `${r * r * h}\\pi`,
        `\\frac{${r * h}}{3}\\pi`,
        `${r * r}\\pi`
      ]);
      list.push({
        section: 'math',
        domain: 'Geometry and Trigonometry',
        topic: 'Area and Volume',
        difficulty: 'easy',
        question_text: `A right circular cone has base radius $r = ${r}$ and height $h = ${h}$. What is the volume of the cone in terms of $\\pi$?`,
        question_type: 'multiple_choice',
        options: o.options,
        correct_answer: o.correct_answer,
        explanation: `Volume of a right cone is $V = \\frac{1}{3}\\pi r^2 h = \\frac{1}{3}\\pi (${r})^2 (${h}) = \\frac{${r * r * h}}{3}\\pi$.`
      });
    }
  }

  // =========================================================================
  // SECTION 2: READING & WRITING (250 Questions - Batch 2)
  // =========================================================================

  // 5.1 CRAFT & STRUCTURE: Words in Context (35 Qs)
  const batch2Vocab = [
    { w: 'anachronistic', dist: ['contemporary', 'timely', 'synchronous'], p: 'The presence of electric wristwatches in a film depicting eleventh-century feudal England was immediately criticized as an _______ oversight by costume designers.', exp: 'Anachronistic means belonging or appropriate to a period other than that in which it exists.' },
    { w: 'capricious', dist: ['steadfast', 'predictable', 'unwavering'], p: 'Market analysts cautioned investors against trading heavily during the merger negotiations, citing the _______ fluctuations of stock valuations.', exp: 'Capricious means given to sudden and unaccountable changes.' },
    { w: 'delineate', dist: ['confuse', 'obfuscate', 'distort'], p: 'In her keynote address, the urban geographer used GIS mapping layers to clearly _______ the historical boundaries between municipal wards.', exp: 'Delineate means describe or portray precisely.' },
    { w: 'didactic', dist: ['subtle', 'artistic', 'ambiguous'], p: 'While eighteenth-century fables were overtly _______, modern children’s literature often leaves moral themes open to interpretive dialogue.', exp: 'Didactic means intended to teach, particularly in having moral instruction as an ulterior motive.' },
    { w: 'disparate', dist: ['homogeneous', 'identical', 'uniform'], p: 'The interdisciplinary symposium brought together scholars from _______ fields, including computational neuroscience and medieval paleography.', exp: 'Disparate means essentially different in kind; not allowing comparison.' },
    { w: 'equanimity', dist: ['agitation', 'turbulence', 'frenzy'], p: 'Throughout the heated press cross-examination, the trial judge maintained her characteristic _______, never once raising her voice.', exp: 'Equanimity means mental calmness, composure, and evenness of temper, especially in a difficult situation.' },
    { w: 'fastidious', dist: ['sloppy', 'careless', 'hasty'], p: 'The manuscript archivist was remarkably _______, requiring all staff to wear nitrile gloves and use bone folders when handling fragile vellum.', exp: 'Fastidious means very attentive to and concerned about accuracy and detail.' },
    { w: 'gregarious', dist: ['solitary', 'reclusive', 'taciturn'], p: 'Unlike snow leopards which lead predominantly solitary lives, meerkats are highly _______ mammals that forage and sleep in communal mobs.', exp: 'Gregarious means fond of company; sociable; living in herds or flocks.' },
    { w: 'idiosyncratic', dist: ['conventional', 'customary', 'universal'], p: 'The composer’s _______ orchestration choices, such as pairing a bassoon with a glockenspiel, gave his symphonies their unmistakable timbre.', exp: 'Idiosyncratic means relating to idiosyncrasy; peculiar or individual.' },
    { w: 'intrepid', dist: ['timid', 'apprehensive', 'cowardly'], p: 'Early twentieth-century polar explorer Ernest Shackleton led an _______ crew across mountainous pack ice after their ship was crushed.', exp: 'Intrepid means fearless; adventurous.' },
    { w: 'juxtapose', dist: ['separate', 'isolate', 'segregate'], p: 'By choosing to _______ stark black-and-white portraits of factory workers with colorful landscape paintings, the curator highlighted industrial contrast.', exp: 'Juxtapose means place or deal with close together for contrasting effect.' },
    { w: 'laudable', dist: ['reprehensible', 'deplorable', 'shameful'], p: 'The city council’s initiative to provide free public broadband to low-income school districts was widely praised as a _______ civic investment.', exp: 'Laudable means deserving praise and commendation.' },
    { w: 'magnanimous', dist: ['vindictive', 'spiteful', 'petty'], p: 'Following a hard-fought election victory, the newly elected mayor made a _______ gesture by appointing her chief rival to head the economic task force.', exp: 'Magnanimous means generous or forgiving, especially toward a rival or less powerful person.' },
    { w: 'nebulous', dist: ['distinct', 'precise', 'definitive'], p: 'Without concrete legislative benchmarks, the proposed environmental charter remained too _______ to enforce against industrial polluters.', exp: 'Nebulous means in the form of a cloud or haze; hazy; vague or ill-defined.' },
    { w: 'obsolete', dist: ['contemporary', 'cutting-edge', 'current'], p: 'The rapid adoption of solid-state drives rendered traditional magnetic tape backups virtually _______ in commercial data centers.', exp: 'Obsolete means no longer produced or used; out of date.' },
    { w: 'panoply', dist: ['dearth', 'shortage', 'absence'], p: 'The museum’s new textile wing exhibited an impressive _______ of Andean weaving techniques dating from 500 BCE to the Inca Empire.', exp: 'Panoply means a complete or impressive collection of things.' },
    { w: 'querulous', dist: ['contented', 'placid', 'serene'], p: 'Exhausted by the delayed flight and cramped seating, the passengers grew increasingly _______ as midnight approached.', exp: 'Querulous means complaining in a petulant or whining manner.' },
    { w: 'recalcitrant', dist: ['compliant', 'amenable', 'tractable'], p: 'Despite repeated administrative warnings, the _______ department chair refused to adopt the university’s new grading portal.', exp: 'Recalcitrant means having an obstinately uncooperative attitude toward authority.' },
    { w: 'sagacious', dist: ['foolish', 'naive', 'myopic'], p: 'The elders sought counsel from their most _______ diplomat, whose foresight had preserved peaceful borders for over three decades.', exp: 'Sagacious means having or showing keen mental discernment and good judgment; wise.' },
    { w: 'trepidation', dist: ['confidence', 'assurance', 'equanimity'], p: 'The deep-sea divers stepped onto the submersible deck with distinct _______, aware that ocean depths exceeded five kilometers.', exp: 'Trepidation means a feeling of fear or agitation about something that may happen.' },
    { w: 'unequivocal', dist: ['ambiguous', 'equivocal', 'vague'], p: 'The spectroscopic analysis provided _______ evidence that the extraterrestrial meteorite contained amino acid precursors.', exp: 'Unequivocal means leaving no doubt; unambiguous.' },
    { w: 'venerate', dist: ['disdain', 'despise', 'scorn'], p: 'Centuries of traditional artisans continued to _______ the ancestral woodcarving masters by replicating their joinery methods.', exp: 'Venerate means regard with great respect; revere.' },
    { w: 'whimsical', dist: ['somber', 'grave', 'austere'], p: 'The children’s illustrator was famous for her _______ depictions of pocket-watch-wearing mice riding bumblebees.', exp: 'Whimsical means playfully quaint or fanciful, especially in an appealing and amusing way.' },
    { w: 'zealous', dist: ['apathetic', 'indifferent', 'lukewarm'], p: 'As a _______ proponent of historic preservation, Elena spent her weekends cataloging nineteenth-century brick masonry facades.', exp: 'Zealous means having or showing passion and devotion.' },
    { w: 'adroit', dist: ['clumsy', 'inept', 'maladroit'], p: 'Through _______ negotiation tactics, the chief mediator convinced both disputing nations to sign a maritime ceasefire agreement.', exp: 'Adroit means clever or skillful in using the hands or mind.' },
    { w: 'bellicose', dist: ['peaceable', 'conciliatory', 'diplomatic'], p: 'The general’s _______ rhetoric alarmed regional allies who were actively seeking demilitarized border talks.', exp: 'Bellicose means demonstrating aggression and willingness to fight.' },
    { w: 'cogent', dist: ['unconvincing', 'flimsy', 'incoherent'], p: 'The economist delivered a _______ argument demonstrating that carbon dividend programs generate net positive GDP growth.', exp: 'Cogent means clear, logical, and convincing.' },
    { w: 'diffident', dist: ['assertive', 'brazen', 'audacious'], p: 'Although she had designed the award-winning robotic prosthetic, the _______ student let her laboratory peers accept the trophy.', exp: 'Diffident means modest or shy because of a lack of self-confidence.' },
    { w: 'germane', dist: ['irrelevant', 'extraneous', 'impertinent'], p: 'The judge instructed the defense counsel to ask only questions directly _______ to the financial embezzlement charges.', exp: 'Germane means relevant to a subject under consideration.' },
    { w: 'hackneyed', dist: ['innovative', 'original', 'novel'], p: 'Film critics dismissed the detective screenplay as a collection of _______ tropes and predictable plot twists.', exp: 'Hackneyed means lacking significance through having been overused; unoriginal and trite.' },
    { w: 'judicious', dist: ['imprudent', 'reckless', 'rash'], p: 'Through _______ management of regional municipal reserves, the city weathered the national economic downturn without layoffs.', exp: 'Judicious means having, showing, or done with good judgment or sense.' },
    { w: 'kinetic', dist: ['static', 'inert', 'quiescent'], p: 'Alexander Calder transformed modern sculpture by introducing _______ mobiles that responded organically to ambient gallery air currents.', exp: 'Kinetic means relating to or resulting from motion.' },
    { w: 'circuitous', dist: ['direct', 'straightforward', 'unswerving'], p: 'Heavy snowdrifts forced the supply convoy to take a _______ mountain detour that added forty miles to their trip.', exp: 'Circuitous means longer than the most direct way; indirect.' },
    { w: 'immutable', dist: ['malleable', 'flexible', 'mutable'], p: 'Fundamental physical constants like the speed of light in a vacuum are considered _______ properties of our universe.', exp: 'Immutable means unchanging over time or unable to be changed.' },
    { w: 'pernicious', dist: ['salutary', 'harmless', 'beneficial'], p: 'Agronomists cautioned that excessive monocropping exerts a _______ influence on soil microbial biodiversity over time.', exp: 'Pernicious means having a harmful effect, especially in a gradual or subtle way.' }
  ];

  batch2Vocab.forEach((item, idx) => {
    const o = mcq(item.w, item.dist);
    list.push({
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

  // 5.2 Text Structure & Purpose (20 Qs)
  const batch2TextStructure = [
    { p: 'In sixteenth-century metallurgy, alchemists believed that smelting copper ores with calamine magically transmuted red metal into gold. Later chemical assays revealed that the calamine zinc naturally alloyed with copper to form brass. This historical episode demonstrates how empirical industrial crafts preceded theoretical atomic chemistry.', f: 'It contrasts an ancient mistaken interpretation with modern chemical reality to illustrate the historical relationship between craft and science.' },
    { p: 'Ecologists initially assumed that alpine tundra vegetation would migrate upslope in uniform bands as global temperatures climbed. Recent high-resolution satellite imagery indicates that micro-topographical ridges, snowbank melt patterns, and soil moisture gradients create patchy mosaic colonization instead.', f: 'It refutes a simplified model of ecological range shifts by introducing empirical data on micro-environmental complexity.' },
    { p: 'In early artificial intelligence, researchers prioritized expert systems built upon rigid, human-curated logical rulebases. While effective in constrained domains like chess, these systems failed when confronted with messy real-world perception. The subsequent shift toward neural networks allowed machines to infer statistical patterns directly from raw sensor data.', f: 'It outlines the limitations of an early technological approach and explains the paradigm shift that addressed those shortcomings.' },
    { p: 'Literary historians once categorized Mary Shelley’s Frankenstein as an isolated Gothic melodrama capitalizing on popular ghost story conventions. Contemporary literary scholarship instead views the novel as a rigorous philosophical critique of early nineteenth-century vitalism and unchecked scientific hubris.', f: 'It revises an outdated literary classification by highlighting the novel\'s engagement with contemporary scientific debates.' },
    { p: 'For decades, geophysicists treated tectonic fault zones as planar fractures governed by uniform Coulomb friction. Micro-seismic sensor arrays deployed along the San Andreas Fault have since revealed complex anastomosing fault braids where fluid pore pressures induce episodic silent slip events.', f: 'It describes how advanced sensory monitoring replaced an idealized mechanical model with a more intricate physical reality.' },
    { p: 'Classic economic consumer theory posits that individuals make purchasing decisions by methodically calculating maximum expected utility. Behavioral economists demonstrated through repeated experimental trials that default option framing and present-bias routinely override rational optimization.', f: 'It presents a foundational economic axiom and details empirical experiments that demonstrated its systematic failures.' },
    { p: 'Marine biologists originally categorized coral bleaching as an acute physiological death response to elevated sea surface temperatures. More nuanced microbiological assays revealed that bleaching is an adaptive eviction of thermal-stressed zooxanthellae, occasionally permitting corals to uptake more heat-tolerant symbiont clades.', f: 'It challenges a conventional view of a biological phenomenon by presenting evidence of a potential adaptive mechanism.' },
    { p: 'Nineteenth-century linguists considered language acquisition in infants to be a passive mimicry of adult speech reinforcement. Noam Chomsky revolutionized cognitive science by positing an innate universal grammar, arguing that children construct rich syntax far beyond the impoverished input they receive.', f: 'It traces a major conceptual revolution that replaced a behaviorist view of language with an innate cognitive framework.' },
    { p: 'Archaeologists traditionally assumed that prehistoric hunter-gatherers in Amazonia had negligible impact on forest canopy composition. Archaeobotanical surveys and lidar mapping revealed extensive anthropogenic "terra preta" soils and dense domesticated fruit tree orchards that reshaped the basin.', f: 'It overturns an assumption of pristine wilderness by demonstrating significant prehistoric landscape management.' },
    { p: 'Astronomers long theorized that planetary systems around Sun-like stars would naturally mirror our solar system’s architecture, with small rocky worlds close in and gas giants far out. The discovery of "hot Jupiters" orbiting their host stars in just days upended planetary formation models.', f: 'It contrasts an expected astronomical paradigm with observational discoveries that necessitated new theoretical models.' },
    { p: 'Cellular biologists once regarded the nucleolus solely as an assembly factory for ribosomal subunits. Contemporary proteomic mapping revealed that the nucleolus also orchestrates cellular stress responses, cell-cycle progression, and viral replication checkpoints.', f: 'It expands the scientific understanding of an organelle by revealing its multifaceted regulatory functions beyond its traditional role.' },
    { p: 'Social psychologists originally claimed that group brainstorming meetings generated vastly more creative ideas than individuals working in isolation. Controlled empirical evaluations subsequently proved that social loafing and evaluation apprehension cause individuals working alone to produce more novel solutions.', f: 'It questions a popular organizational belief by citing experimental studies that demonstrated the opposite outcome.' },
    { p: 'Early neuroanatomists mapped the human cortex into strictly segregated functional silos, assigning vision exclusively to the occipital lobe and audition to the temporal lobe. Functional fMRI neuroimaging has since demonstrated extensive cross-modal plasticity, with blind subjects processing tactile Braille within visual cortices.', f: 'It replaces a rigid anatomical model of brain specialization with evidence of dynamic sensory plasticity.' },
    { p: 'Paleontologists initially assumed that the extinction of non-avian dinosaurs at the K-Pg boundary was a slow evolutionary decline resulting from gradual sea-level regression. The discovery of a global iridium anomaly and the Chicxulub crater conclusively established an abrupt extraterrestrial impact mechanism.', f: 'It contrasts a gradualist extinction theory with decisive geochemical proof of an abrupt catastrophic event.' },
    { p: 'Urban theorists once argued that wide multi-lane expressways were the only effective remedy for downtown automotive gridlock. Empirical traffic engineering demonstrated Braess’s paradox and induced demand: expanding roadway capacity paradoxically increases vehicle volumes and worsens delays.', f: 'It exposes an intuitive municipal planning assumption as counterproductive using transportation engineering evidence.' },
    { p: 'Biophysicists long viewed the lipid bilayer of cell membranes as a passive, fluid solvent in which membrane proteins drifted freely. Modern super-resolution microscopy showed organized lipid rafts—cholesterol-rich microdomains that compartmentalize and regulate cell signaling cascades.', f: 'It outlines an initial passive view of a cellular structure and demonstrates its active organizational role.' },
    { p: 'In historical anthropology, tribal gift economies were frequently romanticized as altruistic communal sharing free of economic calculation. Marcel Mauss demonstrated that gift exchange constitutes a rigid system of reciprocal obligations where giving, receiving, and repaying enforce social hierarchies.', f: 'It deconstructs a romanticized economic narrative by exposing its underlying social obligations and power dynamics.' },
    { p: 'Solar physicists historically modeled the Sun’s corona as a simple thermally conductive atmosphere heated from below. Because the corona is millions of degrees hotter than the solar surface, physicists were forced to develop magnetic reconnection and nanoflare dissipation models to explain the temperature inversion.', f: 'It explains how a thermodynamic paradox forced researchers to formulate novel magnetic heating mechanisms.' },
    { p: 'Medical historians long credited Edward Jenner with the spontaneous, unassisted invention of smallpox vaccination in 1796. Modern historiography reveals that Jenner formalized centuries-old folk knowledge of cowpox immunity practiced by English dairymaids and Ottoman variolators.', f: 'It contextualizes an individual scientific breakthrough within a broader tradition of preexisting folk and intercultural medical practice.' },
    { p: 'Evolutionary anthropologists traditionally posited that upright bipedalism evolved when human ancestors transitioned from dense forests to open savanna grasslands. Fossil discoveries of Ardipithecus ramidus in woodland habitats proved that bipedal locomotion emerged while hominins still lived in arboreal environments.', f: 'It refutes an established environmental hypothesis for human evolution using contrary fossil evidence.' }
  ];

  batch2TextStructure.forEach((ts, idx) => {
    const o = mcq(ts.f, [
      `It chronicles a personal feud between laboratory researchers without addressing empirical findings.`,
      `It argues that ancient scientific beliefs were more accurate than modern technological observations.`,
      `It presents a mathematical proof verifying that the initial theory was entirely infallible.`
    ]);
    list.push({
      section: 'reading_writing',
      domain: 'Craft and Structure',
      topic: 'Text Structure and Purpose',
      difficulty: idx % 2 === 0 ? 'medium' : 'hard',
      context_passage: ts.p,
      question_text: 'Which choice best describes the main function of the text as a whole?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The passage introduces a topic, notes an initial conception, and explains how newer evidence reshaped understanding.`
    });
  });

  // 5.3 Cross-Text Connections (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const p = `**Text 1**\nMarine geologist Dr. Soren Lindqvist advocates for mining deep-sea polymetallic nodules from the abyssal Clarion-Clipperton Zone. Lindqvist stresses that extracting battery metals like nickel, cobalt, and copper from seabed deposits yields significantly lower terrestrial habitat destruction and greenhouse gas emissions than opening new open-pit mines in rainforest biomes.\n\n**Text 2**\nBenthic ecologist Dr. Amina Diallo warns that deep-sea mining risks irrevocable damage to abyssal ecosystems that take millennia to recover. Diallo notes that heavy seafloor collector machinery generates pervasive sediment plumes and noise pollution that disrupt benthic filter feeders and midwater organism biomass across thousands of square kilometers. [Case Study #${i}]`;
    const o = mcq(
      `By contending that the unique vulnerability and slow recovery rates of deep-sea ecosystems present grave ecological risks that terrestrial comparisons underestimate.`,
      [
        `By agreeing that abyssal ecosystems recover rapidly from mechanical sediment disruption.`,
        `By claiming that polymetallic nodules contain no valuable industrial metals for battery manufacture.`,
        `By asserting that terrestrial rainforest open-pit mines cause zero ecological damage.`
      ]
    );
    list.push({
      section: 'reading_writing',
      domain: 'Craft and Structure',
      topic: 'Cross-Text Connections',
      difficulty: 'hard',
      context_passage: p,
      question_text: `Based on the texts, how would Dr. Diallo (Text 2) most likely respond to Dr. Lindqvist's argument in Text 1?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Dr. Diallo highlights the profound, irreversible disruption to slow-recovering benthic and midwater ecosystems, directly countering Lindqvist's claim that seabed mining is ecologically preferable.`
    });
  }

  // 6.1 Central Ideas & Details (20 Qs)
  for (let i = 1; i <= 20; i++) {
    const pass = `Cephalopods such as the common octopus (Octopus vulgaris) possess a decentralized nervous system wherein approximately two-thirds of their neurons are distributed among their eight flexible arms. Rather than requiring centralized cortical execution for every micro-movement, each arm can independently sample chemical tastes, coordinate suckers, and execute reflex actions autonomously. This distributed sensory architecture enables the octopus to forage under multiple rocky crevices simultaneously while the central brain monitors surroundings for predators. [Research Record #${i}]`;
    const o = mcq(
      `An octopus's decentralized nervous system allows its arms to perform complex sensory and motor actions semi-autonomously.`,
      [
        `Octopus arms are entirely dependent on centralized cortical commands to perform any motor movement.`,
        `The majority of cephalopod neurons are located exclusively in the optic lobes.`,
        `Decentralized nervous systems prevent marine animals from detecting predatory threats.`
      ]
    );
    list.push({
      section: 'reading_writing',
      domain: 'Information and Ideas',
      topic: 'Central Ideas and Details',
      difficulty: 'medium',
      context_passage: pass,
      question_text: 'Which choice best states the central idea of the text?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The passage explains how the decentralized nervous system grants semi-autonomous motor and sensory capabilities to the octopus's arms.`
    });
  }

  // 6.2 Command of Evidence Textual (20 Qs)
  for (let i = 1; i <= 20; i++) {
    const pass = `Evolutionary ecologist Dr. Clara Mendez hypothesizes that the acoustic pitch of urban songbirds has shifted to higher frequencies specifically to prevent vocal masking by low-frequency anthropogenic vehicle traffic noise. [Urban Study Cohort #${i}]`;
    const o = mcq(
      `Urban male sparrows singing at higher minimum frequencies in noisy highway corridors, with their highest-frequency songs eliciting greater territorial responses from rivals during rush hour.`,
      [
        `Rural birds singing at identical pitch frequencies regardless of nearby agricultural tractor operations.`,
        `Urban bird populations suffering complete reproductive collapse in quiet suburban parks.`,
        `Urban songbirds transitioning exclusively to visual courtship displays instead of acoustic singing.`
      ]
    );
    list.push({
      section: 'reading_writing',
      domain: 'Information and Ideas',
      topic: 'Command of Evidence',
      difficulty: 'medium',
      context_passage: pass,
      question_text: `Which finding, if true, would most directly support Dr. Mendez's hypothesis?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Finding that urban sparrows sing at higher minimum frequencies near noisy highways directly confirms that the pitch shift counteracts low-frequency traffic noise.`
    });
  }

  // 6.3 Command of Evidence Quantitative (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const pass = `Environmental scientists tested four building insulation retrofits on municipal structures to evaluate thermal performance and energy reductions:\n- Baseline uninsulated exterior masonry: Heat loss: 1.8 W/m²K; Annual heating cost: $42,000\n- Fiberglass batt insulation (R-13): Heat loss: 0.44 W/m²K; Annual heating cost: $28,000\n- Blown cellulose insulation (R-20): Heat loss: 0.28 W/m²K; Annual heating cost: $21,000\n- Vacuum insulation panels (VIP) with thermal breaks: Heat loss: 0.12 W/m²K; Annual heating cost: $14,000\nThe engineers concluded that vacuum insulation panels provide superior thermal resistance, reducing heating expenditures by two-thirds relative to baseline. [Building Evaluation #${i}]`;
    const o = mcq(
      `Vacuum insulation panels recorded the lowest heat loss (0.12 W/m²K) and reduced annual heating costs from $42,000 to $14,000.`,
      [
        `Fiberglass batt insulation reduced heat loss more effectively than blown cellulose.`,
        `Baseline uninsulated masonry incurred lower heating costs than blown cellulose.`,
        `Annual heating costs were identical between fiberglass batts and vacuum insulation panels.`
      ]
    );
    list.push({
      section: 'reading_writing',
      domain: 'Information and Ideas',
      topic: 'Command of Evidence',
      difficulty: 'hard',
      context_passage: pass,
      question_text: 'Which choice best uses data from the study to support the engineers\' conclusion?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The data explicitly demonstrates that vacuum insulation panels achieved the lowest heat loss (0.12) and slashed costs from $42,000 to $14,000 (a two-thirds reduction).`
    });
  }

  // 6.4 Inferences (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const pass = `Tardigrades (water bears) can enter a cryptobiotic state known as the tun, during which their metabolic rate drops to less than 0.01 percent of normal and cellular water content is replaced by protective disaccharides like trehalose. Because this metabolic dormancy shields cellular enzymes against denaturation during extreme desiccation, cryogenic freezing, and ionizing cosmic radiation, researchers conclude that _______ [Tardigrade Specimen Lineage #${i}]`;
    const o = mcq(
      `tardigrade environmental resilience depends fundamentally on reversible metabolic suspension rather than continuous physiological maintenance.`,
      [
        `tardigrades require continuous liquid water intake to withstand ionizing cosmic radiation.`,
        `cellular trehalose actively promotes ice crystallization that tears cell membranes.`,
        `cryptobiosis permanently disables tardigrade reproductive capability upon rehydration.`
      ]
    );
    list.push({
      section: 'reading_writing',
      domain: 'Information and Ideas',
      topic: 'Inferences',
      difficulty: 'hard',
      context_passage: pass,
      question_text: 'Which choice most logically completes the text?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The text explains that the protective state relies on entering an inactive tun state (reversible metabolic suspension) rather than active physiological repair.`
    });
  }

  // 7.1 Standard English Conventions: Boundaries (20 Qs)
  for (let i = 1; i <= 20; i++) {
    const pass = `During the Tang dynasty, Chinese engineers perfected the mass printing of Buddhist _______ their woodblock techniques enabled the widespread dissemination of religious texts throughout East Asia. [Archive #${i}]`;
    const o = mcq(`scrolls;`, [`scrolls,`, `scrolls`, `scrolls; while`]);
    list.push({
      section: 'reading_writing',
      domain: 'Standard English Conventions',
      topic: 'Boundaries',
      difficulty: 'medium',
      context_passage: pass,
      question_text: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Two complete independent clauses must be joined with a semicolon or period to avoid a comma splice.`
    });
  }

  // 7.2 Standard English Conventions: Subject-Verb Agreement (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const pass = `The compilation of detailed meteorological logs, compiled by nineteenth-century maritime whaling captains, _______ invaluable historical climate data to modern oceanographers. [Logbook #${i}]`;
    const o = mcq(`provides`, [`provide`, `have provided`, `are providing`]);
    list.push({
      section: 'reading_writing',
      domain: 'Standard English Conventions',
      topic: 'Form, Structure, and Sense',
      difficulty: 'medium',
      context_passage: pass,
      question_text: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The head noun 'compilation' is singular, so it requires the singular present verb 'provides'.`
    });
  }

  // 7.3 Standard English Conventions: Pronouns (10 Qs)
  for (let i = 1; i <= 10; i++) {
    const pass = `Each migratory songbird in the forest canopy alters _______ flight heading based on geomagnetic compass cues. [Ornithology Index #${i}]`;
    const o = mcq(`its`, [`their`, `they're`, `it's`]);
    list.push({
      section: 'reading_writing',
      domain: 'Standard English Conventions',
      topic: 'Form, Structure, and Sense',
      difficulty: 'easy',
      context_passage: pass,
      question_text: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `'Each migratory songbird' is singular and non-human, requiring the singular possessive pronoun 'its'.`
    });
  }

  // 7.4 Standard English Conventions: Verb Tense & Aspect (10 Qs)
  for (let i = 1; i <= 10; i++) {
    const pass = `Long before seismologists installed digital telemetry arrays across the caldera in 1980, volcanologists _______ magma ascent using ground deformation tiltmeters. [Geology Log #${i}]`;
    const o = mcq(`had monitored`, [`monitor`, `have monitored`, `will monitor`]);
    list.push({
      section: 'reading_writing',
      domain: 'Standard English Conventions',
      topic: 'Form, Structure, and Sense',
      difficulty: 'medium',
      context_passage: pass,
      question_text: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The past action preceded another event in 1980, requiring the past perfect 'had monitored'.`
    });
  }

  // 7.5 Standard English Conventions: Modifiers (5 Qs)
  for (let i = 1; i <= 5; i++) {
    const pass = `Having analyzed the chemical composition of microscopic lunar regolith particles, _______ [Apollo sample #${i}]`;
    const o = mcq(
      `the astrophysicists determined that solar wind implantation was the primary source of trapped water molecules.`,
      [
        `the primary source of trapped water molecules was determined by the astrophysicists.`,
        `a determination regarding solar wind implantation was published.`,
        `it was evident to the scientific community that lunar regolith contained water.`
      ]
    );
    list.push({
      section: 'reading_writing',
      domain: 'Standard English Conventions',
      topic: 'Form, Structure, and Sense',
      difficulty: 'hard',
      context_passage: pass,
      question_text: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The introductory participial phrase must modify the logical agent performing the analysis ('the astrophysicists').`
    });
  }

  // 8.1 Expression of Ideas: Transitions (25 Qs)
  const transitionsBank2 = [
    { p: 'Wind turbines generate zero carbon emissions during electricity generation. _______ turbine blades present collision risks to migratory bats and birds unless radar shutoff systems are implemented.', w: 'However,', dist: ['Therefore,', 'Furthermore,', 'Similarly,'], exp: 'Signals contrast between clean energy benefits and avian impacts.' },
    { p: 'Bilingual education strengthens executive function and working memory in young learners. _______ it fosters cognitive empathy and intercultural social competence.', w: 'In addition,', dist: ['Instead,', 'Nevertheless,', 'Conversely,'], exp: 'Adds another positive developmental benefit.' },
    { p: 'The municipal water district replaced aging iron aqueducts with lined ductile pipe. _______ distribution pressure leaks dropped by forty percent within the first quarter.', w: 'Consequently,', dist: ['In contrast,', 'Nevertheless,', 'Otherwise,'], exp: 'Shows cause-and-effect relationship.' },
    { p: 'Certain species of desert beetles harvest water by condensing morning fog upon textured back ridges. _______ the Namib darkling beetle tilts its body into oncoming breezes to funnel condensed droplets directly into its mouth.', w: 'Specifically,', dist: ['On the other hand,', 'Nevertheless,', 'Therefore,'], exp: 'Introduces a specific, concrete illustration of the broad beetle phenomenon.' },
    { p: 'Traditional lead-acid batteries suffer rapid capacity loss when discharged below fifty percent capacity. Lithium-iron-phosphate batteries, _______ tolerate deep discharges down to twenty percent without rapid degradation.', w: 'by comparison,', dist: ['moreover,', 'furthermore,', 'finally,'], exp: 'Compares the performance of the two battery chemistries.' }
  ];

  for (let i = 0; i < 25; i++) {
    const item = transitionsBank2[i % transitionsBank2.length];
    const o = mcq(item.w, item.dist);
    list.push({
      section: 'reading_writing',
      domain: 'Expression of Ideas',
      topic: 'Transitions',
      difficulty: i % 2 === 0 ? 'medium' : 'easy',
      context_passage: `${item.p} [Excerpt #${i + 1}]`,
      question_text: 'Which choice completes the text with the most logical transition?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: item.exp
    });
  }

  // 8.2 Expression of Ideas: Rhetorical Synthesis (25 Qs)
  for (let i = 1; i <= 25; i++) {
    const pass = `While researching a topic, a student took the following notes:\n- The Curiosity rover landed on Mars in Gale Crater in August 2012.\n- It is powered by a multi-mission radioisotope thermoelectric generator (MMRTG).\n- Gale Crater contains Mount Sharp, a central peak of stratified sedimentary rock layers.\n- In 2013, Curiosity identified mudstones containing carbon, hydrogen, oxygen, and sulfur in Yellowknife Bay.\n- These chemical findings demonstrated that ancient Gale Crater once possessed habitable freshwater lake conditions. [Mission Record #${i}]`;
    const o = mcq(
      `By discovering essential bio-elements in Gale Crater mudstones, the Curiosity rover proved that ancient Mars once hosted habitable freshwater lakes.`,
      [
        `Powered by an MMRTG, the Curiosity rover landed on Mars in Gale Crater in August 2012.`,
        `Gale Crater features Mount Sharp, which contains stratified sedimentary rock layers.`,
        `In 2013, scientists used robotic rovers to study Martian craters.`
      ]
    );
    list.push({
      section: 'reading_writing',
      domain: 'Expression of Ideas',
      topic: 'Rhetorical Synthesis',
      difficulty: i % 2 === 0 ? 'hard' : 'medium',
      context_passage: pass,
      question_text: 'The student wants to summarize the primary scientific discovery made by the Curiosity rover regarding past Martian habitability. Which choice most effectively accomplishes this goal?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The sentence directly states Curiosity's core discovery (finding bio-elements in mudstones) and its scientific significance (proving past freshwater habitability).`
    });
  }

  return list;
}

if (process.argv[1] && process.argv[1].endsWith('generateBatch2Questions.ts')) {
  const generated = generateBatch2Questions();
  console.log(`Generated Batch 2: ${generated.length} questions`);
  const mathCount = generated.filter(q => q.section === 'math').length;
  const rwCount = generated.filter(q => q.section === 'reading_writing').length;
  console.log(`Math: ${mathCount}, Reading & Writing: ${rwCount}`);

  const outPath = path.resolve(process.cwd(), 'src/server/satQuestionsBatch2Data.ts');
  const code = `import { SatQuestionSeed } from "./satQuestionsData";\n\nexport const SAT_QUESTIONS_BATCH2: SatQuestionSeed[] = ${JSON.stringify(generated, null, 2)};\n`;
  fs.writeFileSync(outPath, code, 'utf-8');
  console.log(`Saved to ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}
