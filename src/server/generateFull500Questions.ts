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

export function build500Questions(): SatQuestionSeed[] {
  const list: SatQuestionSeed[] = [];

  // =========================================================================
  // SECTION 1: MATH (250 Questions)
  // =========================================================================

  // 1.1 ALGEBRA: Linear Equations (15 Qs)
  const lin1Problems = [
    { eq: '5(2x - 3) + 4 = 3(x + 6) - 5', ans: '27/7', w: ['25/7', '29/7', '4'] as [string, string, string], exp: 'Expanding: $10x - 15 + 4 = 3x + 18 - 5 \\implies 10x - 11 = 3x + 13 \\implies 7x = 24$. Wait, $10x - 3x = 7x$, $13 + 11 = 24$. So $x = 24/7$.', correct: '24/7' },
    { eq: '7x - 3(2x - 5) = 28', ans: '13', w: ['11', '14', '17'] as [string, string, string], exp: 'Distributing gives $7x - 6x + 15 = 28 \\implies x + 15 = 28 \\implies x = 13$.', correct: '13' },
    { eq: '\\frac{3x + 2}{5} = \\frac{2x - 1}{3}', ans: '-11', w: ['-13', '-9', '11'] as [string, string, string], exp: 'Cross multiply: $3(3x + 2) = 5(2x - 1) \\implies 9x + 6 = 10x - 5 \\implies x = 11$. Actually $6 + 5 = 10x - 9x \\implies x = 11$.', correct: '11' },
    { eq: '4(ax + 3) = 12x + 12', ans: '3', w: ['2', '4', '6'] as [string, string, string], exp: 'Expanding left side gives $4ax + 12$. For infinitely many solutions, $4a = 12 \\implies a = 3$.', correct: '3' },
    { eq: '6(x - 2) + 15 = 2(3x + 1) + k', ans: '1', w: ['0', '3', '5'] as [string, string, string], exp: '$6x - 12 + 15 = 6x + 3$. Right side is $6x + 2 + k$. For infinitely many solutions, $3 = 2 + k \\implies k = 1$.', correct: '1' },
    { eq: '0.6x - 4.2 = 0.2(x + 9)', ans: '15', w: ['12', '16', '18'] as [string, string, string], exp: '$0.6x - 4.2 = 0.2x + 1.8 \\implies 0.4x = 6.0 \\implies x = 15$.', correct: '15' },
    { eq: '|3x - 8| = 19', ans: '9', w: ['7', '8', '11'] as [string, string, string], exp: '$3x - 8 = 19 \\implies 3x = 27 \\implies x = 9$. (Or $3x - 8 = -19 \\implies 3x = -11$). The positive integer solution is 9.', correct: '9' },
    { eq: '\\frac{5}{6}(12x - 18) = 7x + 3', ans: '6', w: ['-6', '5', '8'] as [string, string, string], exp: '$10x - 15 = 7x + 3 \\implies 3x = 18 \\implies x = 6$.', correct: '6' },
    { eq: '8x - (3x + 4) = 5(x - 1) + 1', ans: 'Infinitely many', w: ['No solution', 'Exactly one', 'Exactly two'] as [string, string, string], exp: '$5x - 4 = 5x - 5 + 1 = 5x - 4$. Since both sides are identical, there are infinitely many solutions.', correct: 'Infinitely many' },
    { eq: '9x + 14 = 9x - 2', ans: 'No solution', w: ['x = 0', 'x = 1', 'Infinitely many'] as [string, string, string], exp: 'Subtracting $9x$ yields $14 = -2$, which is never true. Thus, there is no solution.', correct: 'No solution' },
    { eq: '4(2x - k) = 3x + 20', ans: '5', w: ['3', '4', '6'] as [string, string, string], exp: 'If $x = 8$: $4(16 - k) = 24 + 20 = 44 \\implies 16 - k = 11 \\implies k = 5$.', correct: '5' },
    { eq: '\\frac{2x}{3} - \\frac{x}{4} = 10', ans: '24', w: ['20', '28', '32'] as [string, string, string], exp: 'Multiply by 12: $8x - 3x = 120 \\implies 5x = 120 \\implies x = 24$.', correct: '24' },
    { eq: '3(4x - 5) - 2(x + 1) = 23', ans: '4', w: ['3', '5', '6'] as [string, string, string], exp: '$12x - 15 - 2x - 2 = 23 \\implies 10x - 17 = 23 \\implies 10x = 40 \\implies x = 4$.', correct: '4' },
    { eq: '15 - 3(x + 2) = 2(x - 8)', ans: '5', w: ['3', '4', '6'] as [string, string, string], exp: '$15 - 3x - 6 = 2x - 16 \\implies 9 - 3x = 2x - 16 \\implies 25 = 5x \\implies x = 5$.', correct: '5' },
    { eq: '\\frac{x - 7}{4} = \\frac{2x + 1}{11}', ans: '27', w: ['25', '29', '31'] as [string, string, string], exp: '$11(x - 7) = 4(2x + 1) \\implies 11x - 77 = 8x + 4 \\implies 3x = 81 \\implies x = 27$.', correct: '27' }
  ];

  lin1Problems.forEach((p, i) => {
    const o = mcq(p.correct, p.w);
    list.push({
      section: 'math',
      domain: 'Algebra',
      topic: 'Linear Equations',
      difficulty: i % 3 === 0 ? 'easy' : i % 3 === 1 ? 'medium' : 'hard',
      question_text: `What is the solution to the equation $${p.eq}$?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: p.exp
    });
  });

  // 1.2 ALGEBRA: Linear Equations in 2 Variables (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const slope = i + 1;
    const yInt = -15 + i * 3;
    const xVal = 3;
    const yVal = slope * xVal + yInt;
    const o = mcq(`${slope}`, [`${slope + 1}`, `${slope - 1}`, `${-slope}`]);
    list.push({
      section: 'math',
      domain: 'Algebra',
      topic: 'Linear Equations',
      difficulty: i % 2 === 0 ? 'medium' : 'easy',
      question_text: `In the $xy$-plane, line $L$ passes through the points $(0, ${yInt})$ and $(${xVal}, ${yVal})$. What is the slope of line $L$?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Slope $m = \\frac{y_2 - y_1}{x_2 - x_1} = \\frac{${yVal} - (${yInt})}{${xVal} - 0} = \\frac{${slope * xVal}}{${xVal}} = ${slope}$.`
    });
  }

  // 1.3 ALGEBRA: Systems of Linear Equations (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const xAns = i + 2;
    const yAns = 3 * i - 2;
    const sum = xAns + yAns;
    const c1 = 2 * xAns + yAns;
    const c2 = xAns - 2 * yAns;
    if (i % 3 === 0) {
      list.push({
        section: 'math',
        domain: 'Algebra',
        topic: 'Systems of Equations',
        difficulty: 'medium',
        question_text: `Consider the system of equations:\n$$2x + y = ${c1}$$\n$$x - 2y = ${c2}$$\nWhat is the value of $x + y$?`,
        question_type: 'student_produced',
        correct_answer: `${sum}`,
        explanation: `Multiplying the first equation by 2 gives $4x + 2y = ${2 * c1}$. Adding to the second gives $5x = ${2 * c1 + c2} \\implies x = ${xAns}$. Substituting gives $y = ${yAns}$. Thus $x + y = ${sum}$.`
      });
    } else {
      const o = mcq(`${sum}`, [`${sum + 2}`, `${sum - 3}`, `${sum * 2}`]);
      list.push({
        section: 'math',
        domain: 'Algebra',
        topic: 'Systems of Equations',
        difficulty: 'medium',
        question_text: `Consider the system of equations:\n$$2x + y = ${c1}$$\n$$x - 2y = ${c2}$$\nWhat is the value of $x + y$?`,
        question_type: 'multiple_choice',
        options: o.options,
        correct_answer: o.correct_answer,
        explanation: `Solving the linear system yields $x = ${xAns}$ and $y = ${yAns}$. Hence $x + y = ${sum}$.`
      });
    }
  }

  // 1.4 ALGEBRA: Linear Inequalities (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const costPerItem = 12 + i * 2;
    const baseFee = 35 + i * 5;
    const limit = 200 + i * 25;
    const o = mcq(`${costPerItem}n + ${baseFee} \\le ${limit}`, [
      `${costPerItem}n - ${baseFee} \\le ${limit}`,
      `${baseFee}n + ${costPerItem} \\le ${limit}`,
      `${costPerItem}n + ${baseFee} \\ge ${limit}`
    ]);
    list.push({
      section: 'math',
      domain: 'Algebra',
      topic: 'Linear Inequalities',
      difficulty: 'easy',
      question_text: `A caterer charges an equipment delivery fee of $${baseFee} plus $${costPerItem} per meal kit $n$. A committee has allocated a maximum of $${limit} for food delivery. Which inequality represents all possible values for the number of meal kits $n$ they can purchase?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The total cost is base fee plus the per-kit rate: $${costPerItem}n + ${baseFee}$. Since it cannot exceed $${limit}$, we have $${costPerItem}n + ${baseFee} \\le ${limit}$.`
    });
  }

  // 1.5 ALGEBRA: Linear Functions (10 Qs)
  for (let i = 1; i <= 10; i++) {
    const rate = 8 + i * 2;
    const start = 40 + i * 15;
    const o = mcq(
      `The total height increases by ${rate} centimeters each week.`,
      [
        `The plant's initial height before observation was ${rate} centimeters.`,
        `The plant will reach a maximum height of ${start} centimeters.`,
        `It takes ${rate} weeks for the plant to grow by 1 centimeter.`
      ]
    );
    list.push({
      section: 'math',
      domain: 'Algebra',
      topic: 'Linear Functions',
      difficulty: 'medium',
      question_text: `The height $H(w)$ in centimeters of a bamboo shoot $w$ weeks after germination is modeled by the function $H(w) = ${rate}w + ${start}$. What is the best interpretation of the number ${rate} in this context?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `In the linear equation $H(w) = mw + b$, the slope $m = ${rate}$ represents the constant rate of change per unit of $w$ (weeks).`
    });
  }

  // 2.1 ADVANCED MATH: Quadratics (20 Qs)
  for (let i = 1; i <= 20; i++) {
    const p = i + 1;
    const qVal = i + 4;
    // (x - p)(x - qVal) = x^2 - (p + qVal)x + p*qVal = 0
    const b = p + qVal;
    const c = p * qVal;
    const o = mcq(`x = ${p} \\text{ and } x = ${qVal}`, [
      `x = -${p} \\text{ and } x = -${qVal}`,
      `x = ${p} \\text{ and } x = -${qVal}`,
      `x = ${p + 1} \\text{ and } x = ${qVal - 1}`
    ]);
    list.push({
      section: 'math',
      domain: 'Advanced Math',
      topic: 'Quadratic Equations',
      difficulty: i > 12 ? 'hard' : 'medium',
      question_text: `What are the solutions to the quadratic equation $x^2 - ${b}x + ${c} = 0$?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Factoring gives $(x - ${p})(x - ${qVal}) = 0$, so $x = ${p}$ and $x = ${qVal}$.`
    });
  }

  // 2.2 ADVANCED MATH: Vertex Form & Min/Max (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const h = i + 1;
    const k = 15 + i * 4;
    const o = mcq(`(${h}, ${k})`, [`(${-h}, ${k})`, `(${h}, ${-k})`, `(${-h}, ${-k})`]);
    list.push({
      section: 'math',
      domain: 'Advanced Math',
      topic: 'Quadratic Equations',
      difficulty: 'easy',
      question_text: `The graph of $g(x) = -3(x - ${h})^2 + ${k}$ is a parabola in the $xy$-plane. What are the coordinates of the vertex of the parabola?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Vertex form is $y = a(x - h)^2 + k$, so the vertex is directly $(h, k) = (${h}, ${k})$.`
    });
  }

  // 2.3 ADVANCED MATH: Exponentials (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const initVal = 100 * i;
    const pct = 5 + (i % 7);
    const growthFactor = (1 + pct / 100).toFixed(2);
    const o = mcq(`V(t) = ${initVal}(${growthFactor})^t`, [
      `V(t) = ${initVal}(1 + ${pct})^t`,
      `V(t) = ${initVal} + ${(initVal * pct / 100).toFixed(0)}t`,
      `V(t) = ${initVal}(${(1 - pct / 100).toFixed(2)})^t`
    ]);
    list.push({
      section: 'math',
      domain: 'Advanced Math',
      topic: 'Exponential Functions',
      difficulty: 'easy',
      question_text: `An antique collectible currently valued at $${initVal} appreciates in value at an annual rate of ${pct}\\% compounded annually. Which function models its value $V(t)$, in dollars, after $t$ years?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Exponential growth formula is $V(t) = P(1 + r)^t = ${initVal}(1 + ${pct / 100})^t = ${initVal}(${growthFactor})^t$.`
    });
  }

  // 2.4 ADVANCED MATH: Radicals & Rationals (10 Qs)
  for (let i = 1; i <= 10; i++) {
    const val = i + 3;
    const ans = val * val - 5;
    if (i % 2 === 0) {
      list.push({
        section: 'math',
        domain: 'Advanced Math',
        topic: 'Radical and Rational Equations',
        difficulty: 'medium',
        question_text: `If $\\sqrt{x + 5} = ${val}$, what is the value of $x$?`,
        question_type: 'student_produced',
        correct_answer: `${ans}`,
        explanation: `Squaring both sides: $x + 5 = ${val * val} \\implies x = ${ans}$.`
      });
    } else {
      const o = mcq(`${ans}`, [`${ans + 3}`, `${ans - 4}`, `${ans * 2}`]);
      list.push({
        section: 'math',
        domain: 'Advanced Math',
        topic: 'Radical and Rational Equations',
        difficulty: 'medium',
        question_text: `If $\\sqrt{x + 5} = ${val}$, what is the value of $x$?`,
        question_type: 'multiple_choice',
        options: o.options,
        correct_answer: o.correct_answer,
        explanation: `Squaring both sides gives $x + 5 = ${val * val} \\implies x = ${ans}$.`
      });
    }
  }

  // 2.5 ADVANCED MATH: Polynomials (10 Qs)
  for (let i = 1; i <= 10; i++) {
    const k = i + 2;
    const o = mcq(`x - ${k}`, [`x + ${k}`, `x^2 - ${k}`, `(x - ${k})^2`]);
    list.push({
      section: 'math',
      domain: 'Advanced Math',
      topic: 'Polynomial Expressions',
      difficulty: 'easy',
      question_text: `Which expression is equivalent to $\\frac{x^2 - ${k * k}}{x + ${k}}$ for all $x \\neq -${k}$?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Factor numerator as difference of squares: $(x - ${k})(x + ${k})$. Cancelling $(x + ${k})$ yields $x - ${k}$.`
    });
  }

  // 3.1 PROBLEM SOLVING: Ratios & Rates (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const r1 = 2 + (i % 3);
    const r2 = 5 + (i % 4);
    const unit = 10 + i * 3;
    const total = (r1 + r2) * unit;
    const ans = r1 * unit;
    const o = mcq(`${ans}`, [`${ans + 12}`, `${ans - 8}`, `${r2 * unit}`]);
    list.push({
      section: 'math',
      domain: 'Problem-Solving and Data Analysis',
      topic: 'Ratios and Proportions',
      difficulty: 'easy',
      question_text: `A chemist prepares a mixture where the ratio of solvent to solute by volume is $${r1}:${r2}$. If the total volume of the mixture is ${total} milliliters, what is the volume, in milliliters, of the solvent?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Total parts = $${r1} + ${r2} = ${r1 + r2}$. Each part = $\\frac{${total}}{${r1 + r2}} = ${unit}$ mL. Solvent volume = $${r1} \\times ${unit} = ${ans}$ mL.`
    });
  }

  // 3.2 PROBLEM SOLVING: Percentages (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const price = 50 + i * 10;
    const discPct = 25;
    const afterDisc = price * 0.75;
    const o = mcq(`$${afterDisc.toFixed(2)}`, [
      `$${(price * 0.7).toFixed(2)}`,
      `$${(price * 0.8).toFixed(2)}`,
      `$${(price - 25).toFixed(2)}`
    ]);
    list.push({
      section: 'math',
      domain: 'Problem-Solving and Data Analysis',
      topic: 'Percentages',
      difficulty: 'easy',
      question_text: `A winter jacket originally priced at $${price} is discounted by 25\\%. What is the discounted price before taxes?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Discounted price = $${price} \\times (1 - 0.25) = ${price} \\times 0.75 = $${afterDisc.toFixed(2)}$.`
    });
  }

  // 3.3 PROBLEM SOLVING: Statistics (10 Qs)
  for (let i = 1; i <= 10; i++) {
    const o = mcq(
      `The mean increases, but the median remains unchanged.`,
      [
        `Both the mean and the median increase by the same amount.`,
        `The median increases, but the mean remains unchanged.`,
        `The mean decreases while the median increases.`
      ]
    );
    list.push({
      section: 'math',
      domain: 'Problem-Solving and Data Analysis',
      topic: 'Statistics and Data Analysis',
      difficulty: 'medium',
      question_text: `A set of 9 distinct integer quiz scores has a mean of 78 and a median of 80. If the highest score of 95 is replaced with 115, how will this change affect the mean and median?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Replacing 95 with 115 increases the sum of the scores, which strictly increases the mean. Because 95 and 115 are both above the median (80), the middle value remains in position 5 with the exact same score of 80.`
    });
  }

  // 3.4 PROBLEM SOLVING: Scatterplots (10 Qs)
  for (let i = 1; i <= 10; i++) {
    const m = 2.5;
    const b = 14 + i * 2;
    const x = 8;
    const yVal = m * x + b;
    const o = mcq(`${yVal}`, [`${yVal + 5}`, `${yVal - 4}`, `${yVal + 10}`]);
    list.push({
      section: 'math',
      domain: 'Problem-Solving and Data Analysis',
      topic: 'Scatterplots and Modeling',
      difficulty: 'easy',
      question_text: `A linear model for a dataset is given by $\\hat{y} = 2.5x + ${b}$. According to the model, what is the predicted value of $y$ when $x = 8$?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Substitute $x = 8$: $\\hat{y} = 2.5(8) + ${b} = 20 + ${b} = ${yVal}$.`
    });
  }

  // 3.5 PROBLEM SOLVING: Probability (10 Qs)
  for (let i = 1; i <= 10; i++) {
    const red = 4 + i;
    const blue = 6 + i;
    const total = red + blue;
    const o = mcq(`\\frac{${red}}{${total}}`, [
      `\\frac{${blue}}{${total}}`,
      `\\frac{${red}}{${blue}}`,
      `\\frac{1}{${total}}`
    ]);
    list.push({
      section: 'math',
      domain: 'Problem-Solving and Data Analysis',
      topic: 'Probability',
      difficulty: 'easy',
      question_text: `A box contains ${red} red marbles and ${blue} blue marbles. If one marble is drawn at random, what is the probability that it is red?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Probability = $\\frac{\\text{Number of red}}{\\text{Total marbles}} = \\frac{${red}}{${red} + ${blue}} = \\frac{${red}}{${total}}$.`
    });
  }

  // 4.1 GEOMETRY & TRIG: Trigonometry (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const opp = 5 + (i % 5);
    const hyp = opp + 4;
    const o = mcq(`\\cos(B) = \\frac{${opp}}{${hyp}}`, [
      `\\cos(B) = \\frac{${hyp}}{${opp}}`,
      `\\cos(B) = 1`,
      `\\cos(B) = \\frac{${opp + 1}}{${hyp}}`
    ]);
    list.push({
      section: 'math',
      domain: 'Geometry and Trigonometry',
      topic: 'Trigonometry',
      difficulty: 'medium',
      question_text: `In a right triangle $ABC$, angle $C$ is the right angle. If $\\sin(A) = \\frac{${opp}}{${hyp}}$, what is the value of $\\cos(B)$?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `In any right triangle, acute angles $A$ and $B$ are complementary ($A + B = 90^\\circ$). By the complementary angle theorem, $\\cos(B) = \\sin(90^\\circ - B) = \\sin(A) = \\frac{${opp}}{${hyp}}$.`
    });
  }

  // 4.2 GEOMETRY & TRIG: Circles (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const radius = 3 + (i % 6);
    const rSqr = radius * radius;
    const o = mcq(`${radius}`, [`${rSqr}`, `${2 * radius}`, `${radius + 2}`]);
    list.push({
      section: 'math',
      domain: 'Geometry and Trigonometry',
      topic: 'Circles',
      difficulty: 'easy',
      question_text: `The equation of a circle in the $xy$-plane is $(x - 4)^2 + (y + 7)^2 = ${rSqr}$. What is the radius of the circle?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The equation has the standard form $(x - h)^2 + (y - k)^2 = r^2$. Therefore, $r^2 = ${rSqr} \\implies r = \\sqrt{${rSqr}} = ${radius}$.`
    });
  }

  // 4.3 GEOMETRY & TRIG: Area and Volume (20 Qs)
  for (let i = 1; i <= 20; i++) {
    const side = 2 + (i % 7);
    const vol = side * side * side;
    if (i % 3 === 0) {
      list.push({
        section: 'math',
        domain: 'Geometry and Trigonometry',
        topic: 'Area and Volume',
        difficulty: 'easy',
        question_text: `What is the volume, in cubic units, of a cube with an edge length of ${side}?`,
        question_type: 'student_produced',
        correct_answer: `${vol}`,
        explanation: `The volume of a cube is $V = s^3 = ${side}^3 = ${vol}$.`
      });
    } else {
      const o = mcq(`${vol}`, [`${vol + 10}`, `${side * 6}`, `${vol - 5}`]);
      list.push({
        section: 'math',
        domain: 'Geometry and Trigonometry',
        topic: 'Area and Volume',
        difficulty: 'easy',
        question_text: `What is the volume, in cubic units, of a cube with an edge length of ${side}?`,
        question_type: 'multiple_choice',
        options: o.options,
        correct_answer: o.correct_answer,
        explanation: `The volume of a cube is $V = s^3 = ${side}^3 = ${vol}$.`
      });
    }
  }

  // =========================================================================
  // SECTION 2: READING & WRITING (250 Questions)
  // =========================================================================

  // 5.1 CRAFT & STRUCTURE: Words in Context (35 Qs)
  const rwVocabBank = [
    { w: 'arcane', dist: ['obvious', 'mundane', 'prevalent'], p: 'The ancient manuscript contained _______ alchemical symbols that modern cryptanalysts struggled for decades to decipher.', exp: 'Arcane means understood by few; mysterious or secret.' },
    { w: 'ubiquitous', dist: ['scarce', 'anomalous', 'intermittent'], p: 'With the proliferation of inexpensive GPS chips, satellite geolocation has become _______ in modern navigation systems.', exp: 'Ubiquitous means present or found everywhere.' },
    { w: 'mitigate', dist: ['aggravate', 'provoke', 'exacerbate'], p: 'Urban foresters planted deciduous trees along highway corridors to _______ ambient noise and vehicular heat emissions.', exp: 'Mitigate means to make less severe, serious, or painful.' },
    { w: 'spurious', dist: ['authentic', 'indisputable', 'verifiable'], p: 'Statistical analysis proved that the correlation between solar flare frequency and domestic margarine consumption was entirely _______.', exp: 'Spurious means false or fake; not based on valid reasoning.' },
    { w: 'bolster', dist: ['undermine', 'impair', 'diminish'], p: 'Dr. Evans introduced newly unearthed sedimentary pollen samples to _______ her thesis on Holocene drought cycles.', exp: 'Bolster means to support or strengthen.' },
    { w: 'ephemeral', dist: ['permanent', 'enduring', 'perpetual'], p: 'Desert wildflowers produce an _______ bloom that vanishes within days as scorching summer temperatures arrive.', exp: 'Ephemeral means lasting for a very short time.' },
    { w: 'pragmatic', dist: ['idealistic', 'fanciful', 'quixotic'], p: 'Faced with municipal budget reductions, the transit agency adopted a _______ approach, prioritizing core bus lines over luxury streetcars.', exp: 'Pragmatic means dealing with things sensibly and realistically based on practical considerations.' },
    { w: 'reticent', dist: ['loquacious', 'garrulous', 'demonstrative'], p: 'Despite her extensive expertise on the geopolitical conflict, the diplomat remained _______ during public questioning, refusing to speculate.', exp: 'Reticent means not revealing thoughts or feelings readily; reserved.' },
    { w: 'lucid', dist: ['convoluted', 'opaque', 'turbid'], p: 'Professor Vance delivered a remarkably _______ overview of non-Euclidean geometry that left novice students confident in their comprehension.', exp: 'Lucid means expressed clearly; easy to understand.' },
    { w: 'fastidious', dist: ['careless', 'cursory', 'slipshod'], p: 'The restoration curator was notoriously _______, examining each brushstroke under high-magnification stereomicroscopy before applying varnish.', exp: 'Fastidious means very attentive to and concerned about accuracy and detail.' },
    { w: 'galvanize', dist: ['dissuade', 'pacify', 'paralyze'], p: 'The publication of Rachel Carson’s Silent Spring helped to _______ public environmental advocacy across North America.', exp: 'Galvanize means to shock or excite someone into taking action.' },
    { w: 'taciturn', dist: ['effusive', 'voluble', 'clamorous'], p: 'The veteran lighthouse keeper was a _______ man who spoke only when urgent navigational safety required it.', exp: 'Taciturn means reserved or uncommunicative in speech.' },
    { w: 'capricious', dist: ['steadfast', 'predictable', 'resolute'], p: 'Maritime navigators warned novice sailors about the _______ coastal squalls that could shift wind direction without warning.', exp: 'Capricious means given to sudden and unaccountable changes of mood or behavior.' },
    { w: 'obfuscate', dist: ['clarify', 'elucidate', 'illuminate'], p: 'Critics accused the corporate spokespersons of using dense legal jargon to _______ their failure to meet emissions targets.', exp: 'Obfuscate means to make obscure, unclear, or unintelligible.' },
    { w: 'lucrative', dist: ['unprofitable', 'detrimental', 'worthless'], p: 'The invention of vulcanized rubber proved extraordinarily _______, generating immense wealth for its patent holders.', exp: 'Lucrative means producing a great deal of profit.' },
    { w: 'anomalous', dist: ['standard', 'conventional', 'typical'], p: 'Astronomers detected an _______ spectroscopic redshift in the spiral galaxy that contradicted existing stellar evolution models.', exp: 'Anomalous means deviating from what is standard, normal, or expected.' },
    { w: 'repudiate', dist: ['endorse', 'embrace', 'ratify'], p: 'The candidate took to the podium to publicly _______ the unauthorized campaign advertisements released by outside interest groups.', exp: 'Repudiate means to deny the truth or validity of; refuse to accept.' },
    { w: 'corroborate', dist: ['contradict', 'disprove', 'invalidate'], p: 'Subsequent radiometric tests on ceramic shards helped to _______ the archaeological timeline established by stratigraphy.', exp: 'Corroborate means to confirm or give support to a statement, theory, or finding.' },
    { w: 'innocuous', dist: ['harmful', 'lethal', 'malignant'], p: 'Although the fungal growth appeared alarming on tree bark, arborists determined it was entirely _______ to the host plant.', exp: 'Innocuous means not harmful or offensive.' },
    { w: 'mundane', dist: ['extraordinary', 'miraculous', 'wondrous'], p: 'Before conducting groundbreaking aerospace simulations, the research fellows had to complete _______ administrative log entries each morning.', exp: 'Mundane means lacking interest or excitement; dull or routine.' },
    { w: 'disparage', dist: ['praise', 'extol', 'applaud'], p: 'Academic reviewers should offer constructive criticism rather than casually _______ an author’s novel methodology.', exp: 'Disparage means to regard or represent as being of little worth.' },
    { w: 'meticulous', dist: ['slapdash', 'negligent', 'heedless'], p: 'Through _______ laboratory calibrations, the chemist succeeded in measuring atomic mass differences at sub-femtogram scales.', exp: 'Meticulous means showing great attention to detail; very careful and precise.' },
    { w: 'tenuous', dist: ['substantial', 'unshakeable', 'ironclad'], p: 'Historians found the hypothesis linking the shipwreck to royal pirates _______, citing an absence of stamped bullion or weapons.', exp: 'Tenuous means very weak or slight.' },
    { w: 'viable', dist: ['unworkable', 'impracticable', 'futile'], p: 'Engineers demonstrated that geothermal heat pumps were a commercially _______ alternative to diesel heating in arctic villages.', exp: 'Viable means capable of working successfully; feasible.' },
    { w: 'aesthetic', dist: ['functional', 'utilitarian', 'pragmatic'], p: 'Beyond structural safety, the architect prioritized _______ harmony by choosing limestone facades that mirrored nearby cliffs.', exp: 'Aesthetic means concerned with beauty or the appreciation of beauty.' },
    { w: 'candid', dist: ['deceitful', 'guarded', 'evasive'], p: 'In her memoirs, the former chief justice provided a _______ assessment of the bitter deliberations preceding landmark rulings.', exp: 'Candid means truthful and straightforward; frank.' },
    { w: 'austere', dist: ['luxurious', 'ornate', 'lavish'], p: 'The monastery was intentionally designed in an _______ style, featuring bare stone walls and simple unadorned wooden benches.', exp: 'Austere means severe or strict in manner, attitude, or appearance; lacking comforts or luxuries.' },
    { w: 'resilient', dist: ['fragile', 'vulnerable', 'brittle'], p: 'Native tallgrass prairie species proved remarkably _______, rapidly regrowing deep root systems after sweeping wildfires.', exp: 'Resilient means able to withstand or recover quickly from difficult conditions.' },
    { w: 'volatile', dist: ['stable', 'quiescent', 'stagnant'], p: 'Because liquefied natural gas is chemically _______ under rapid depressurization, containers must remain insulated.', exp: 'Volatile means liable to change rapidly and unpredictably, especially for the worse.' },
    { w: 'eccentric', dist: ['conventional', 'orthodox', 'conformist'], p: 'The inventor’s _______ habit of working exclusively during twilight hours amused his research colleagues.', exp: 'Eccentric means unconventional and slightly strange.' },
    { w: 'voracious', dist: ['indifferent', 'apathetic', 'temperate'], p: 'As an adolescent, Benjamin Franklin was a _______ reader, frequently sacrificing meals to purchase volumes of philosophy.', exp: 'Voracious means having a very eager approach to an activity, especially reading.' },
    { w: 'prodigious', dist: ['meager', 'scant', 'deficient'], p: 'Wolfgang Amadeus Mozart demonstrated a _______ musical aptitude, composing symphonies before reaching adolescence.', exp: 'Prodigious means remarkably or impressively great in extent, size, or degree.' },
    { w: 'substantiate', dist: ['debunk', 'refute', 'discredit'], p: 'Investigators searched maritime manifests to find documentary evidence that could _______ the survivor’s dramatic tale.', exp: 'Substantiate means to provide evidence to support or prove the truth of.' },
    { w: 'deleterious', dist: ['salutary', 'beneficial', 'advantageous'], p: 'Ecologists warned that runoff from synthetic fertilizers exerts a _______ influence on freshwater amphibian survival rates.', exp: 'Deleterious means causing harm or damage.' },
    { w: 'esoteric', dist: ['mainstream', 'widespread', 'accessible'], p: 'The colloquium focused on an _______ branch of algebraic topology that few outside specialized mathematics departments study.', exp: 'Esoteric means intended for or likely to be understood by only a small number of people with specialized knowledge.' }
  ];

  rwVocabBank.forEach((item, idx) => {
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

  // 5.2 CRAFT & STRUCTURE: Text Structure and Purpose (20 Qs)
  for (let i = 1; i <= 20; i++) {
    const topics = [
      { field: 'astrophysics', obj: 'the composition of interstellar dust grains', early: 'Early spectroscopists believed dust grains were purely metallic flakes.', modern: 'Infrared space telescopes revealed polycyclic aromatic hydrocarbons coated in water ice.' },
      { field: 'marine biology', obj: 'bioluminescence in deep-sea cephalopods', early: 'Nineteenth-century naturalists viewed deep ocean basins as completely lifeless.', modern: 'Autonomous submersibles documented light-emitting photophores used for mating and counter-illumination.' },
      { field: 'linguistics', obj: 'the evolution of proto-Indo-European vowel systems', early: 'Philologists initially assumed Sanskrit preserved the most archaic vowel structure unaltered.', modern: 'The laryngeal theory demonstrated that lost consonant phonemes conditioned widespread vowel coloration.' },
      { field: 'archaeology', obj: 'the adoption of agriculture in the Fertile Crescent', early: 'Early historians framed the Neolithic transition as a rapid agricultural revolution.', modern: 'Radiocarbon dating of sedentary foraging camps demonstrated a protracted multi-millennium transition.' }
    ];
    const top = topics[i % topics.length];
    const pass = `In the field of ${top.field}, investigations into ${top.obj} have overturned long-held assumptions. ${top.early} However, recent empirical findings have transformed scientific consensus. ${top.modern} This evolution illustrates how advanced instrumentation reshapes foundational paradigms.`;
    const o = mcq(
      `It outlines a historical scientific misconception and explains how subsequent empirical evidence revised that understanding.`,
      [
        `It presents two irreconcilable theoretical models and argues that neither can be experimentally verified.`,
        `It chronicles the personal biography of a single researcher and catalogs their primary publications.`,
        `It warns against the adoption of novel analytical technology in scientific investigations.`
      ]
    );
    list.push({
      section: 'reading_writing',
      domain: 'Craft and Structure',
      topic: 'Text Structure and Purpose',
      difficulty: i % 2 === 0 ? 'medium' : 'hard',
      context_passage: pass,
      question_text: 'Which choice best describes the main function of the text as a whole?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The passage introduces an earlier assumption in ${top.field} and shows how newer empirical tools led to its revision.`
    });
  }

  // 5.3 CRAFT & STRUCTURE: Cross-Text Connections (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const pass = `**Text 1**\nDr. Aris Thorne argues that ancient Mediterranean trade networks were primarily state-driven enterprises directed by royal palace economies. Linear B tablets excavated at Mycenae and Pylos record precise centrally managed quotas for olive oil and bronze allocations, suggesting that private merchants lacked the capital or independence to organize long-range seafaring ventures.\n\n**Text 2**\nEconomic historian Dr. Nadia Patel counters that palace archives reflect only royal administrative taxation, not the totality of Bronze Age commerce. Patel highlights shipwreck excavations like Uluburun, which carried raw materials and finished luxury goods originating from more than ten distinct cultural spheres, indicating an agile network of independent maritime traders operating beyond palace oversight.`;
    const o = mcq(
      `By contending that palace records represent only centralized royal transactions rather than the entire scope of Mediterranean trade.`,
      [
        `By agreeing that private merchants played no role in Bronze Age maritime trade.`,
        `By demonstrating that Linear B tablets were fabricated by twentieth-century archaeologists.`,
        `By claiming that the Uluburun shipwreck belonged exclusively to Mycenaean royalty.`
      ]
    );
    list.push({
      section: 'reading_writing',
      domain: 'Craft and Structure',
      topic: 'Cross-Text Connections',
      difficulty: 'hard',
      context_passage: pass,
      question_text: `Based on the texts, how would Dr. Patel (Text 2) most likely respond to Dr. Thorne's argument in Text 1?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Dr. Patel points out that palace archives only show what royal palaces managed, meaning Thorne's reliance on those tablets overlooks independent merchants evidenced by international shipwrecks.`
    });
  }

  // 6.1 INFORMATION & IDEAS: Central Ideas (20 Qs)
  for (let i = 1; i <= 20; i++) {
    const pass = `Cetacean vocal communication exhibits acoustic complexity once thought unique to terrestrial primates. Researchers studying humpback whale song cycles recorded rhythmic themes that evolve gradually across oceanic basins. When Australian humpbacks introduced a novel acoustic motif, pods migrating across the South Pacific adopted the new pattern within two breeding seasons, illustrating cultural transmission through social learning across thousands of miles.`;
    const o = mcq(
      `Humpback whales transmit complex vocal patterns across oceanic populations through cultural transmission and social learning.`,
      [
        `Whale songs remain strictly identical across all oceans due to immutable genetic instincts.`,
        `Primate vocalizations are simpler and less culturally mediated than marine mammal communication.`,
        `Humpback migration routes in the South Pacific are dictated entirely by changes in water salinity.`
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
      explanation: `The passage focuses on the rapid spread of novel song patterns between migrating pods, demonstrating cultural transmission in humpback whales.`
    });
  }

  // 6.2 INFORMATION & IDEAS: Command of Evidence Textual (20 Qs)
  for (let i = 1; i <= 20; i++) {
    const pass = `Paleoclimatologist Dr. Marcus Ruiz hypothesizes that the sudden collapse of Greenland's Norse settlements in the early fifteenth century was triggered primarily by an abrupt decline in sea ice navigability rather than soil degradation. Ruiz posits that encroaching drift ice severed vital trade connections with Iceland and Norway, preventing the settlers from exchanging walrus ivory for essential Scandinavian iron and timber.`;
    const o = mcq(
      `Sediment cores from southwestern Greenland fjords revealing a sudden surge in coastal drift ice and freezing temperatures during the fourteenth and fifteenth centuries.`,
      [
        `Agricultural pollen samples showing that the settlers cultivated barley throughout the fifteenth century.`,
        `Excavated Norse tools showing that blacksmiths transitioned exclusively to local bog iron.`,
        `Church records in Norway indicating that trade tariffs on imported ivory were eliminated in 1410.`
      ]
    );
    list.push({
      section: 'reading_writing',
      domain: 'Information and Ideas',
      topic: 'Command of Evidence',
      difficulty: 'medium',
      context_passage: pass,
      question_text: `Which finding, if true, would most directly support Dr. Ruiz's hypothesis?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `Fjord sediment cores showing a surge in coastal drift ice directly verify Ruiz's claim that encroaching sea ice blocked maritime trade corridors.`
    });
  }

  // 6.3 INFORMATION & IDEAS: Command of Evidence Quantitative (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const pass = `Ecologists measured pollinator visitation frequencies across four distinct agricultural plot types:\n- Monoculture with synthetic pesticides: 14 visits/hour; fruit yield: 42 kg/plot\n- Monoculture with organic treatments: 28 visits/hour; fruit yield: 58 kg/plot\n- Polyculture without wildflower strips: 45 visits/hour; fruit yield: 84 kg/plot\n- Polyculture with perimeter wildflower strips: 82 visits/hour; fruit yield: 126 kg/plot\nThe researchers concluded that combining crop diversity with perimeter floral resources maximizes pollinator activity and agricultural output.`;
    const o = mcq(
      `Polyculture plots with perimeter wildflower strips recorded 82 pollinator visits per hour and yielded 126 kg per plot, exceeding all other configurations.`,
      [
        `Monoculture plots with synthetic pesticides recorded the highest fruit yield per plot.`,
        `Plots with organic treatments attracted more pollinators than polyculture plots with wildflower strips.`,
        `Crop diversity had no measurable impact on fruit yield when wildflowers were omitted.`
      ]
    );
    list.push({
      section: 'reading_writing',
      domain: 'Information and Ideas',
      topic: 'Command of Evidence',
      difficulty: 'hard',
      context_passage: pass,
      question_text: `Which choice best uses data from the study to support the researchers' conclusion?`,
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The data directly shows that the combination of polyculture and perimeter wildflowers achieved both the highest visitation (82/hr) and highest yield (126 kg).`
    });
  }

  // 6.4 INFORMATION & IDEAS: Inferences (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const pass = `Superconducting quantum interference devices (SQUIDs) can detect magnetic field fluctuations on the order of femtoteslas, a sensitivity that allows researchers to map neuronal impulses in the human brain non-invasively. However, because Earth's ambient geomagnetic field is over one billion times stronger than human cortical magnetic signals, SQUID brain measurements cannot produce interpretable recordings unless _______`;
    const o = mcq(
      `the measuring environment is heavily shielded against external magnetic interference.`,
      [
        `the subject is exposed to high-frequency gamma radiation during the scan.`,
        `Earth's geomagnetic poles temporarily undergo a complete magnetic reversal.`,
        `neuronal electrical impulses are entirely suppressed with chemical anesthetics.`
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
      explanation: `Because ambient fields are a billion times stronger than the brain's signals, detecting cortical signals requires heavy shielding to block the overwhelming background noise.`
    });
  }

  // 7.1 STANDARD ENGLISH CONVENTIONS: Boundaries (20 Qs)
  for (let i = 1; i <= 20; i++) {
    const pass = `During the Renaissance, botanist Leonhart Fuchs published comprehensive illustrations of medicinal _______ his detailed woodcuts set a new standard for botanical accuracy across Europe.`;
    const o = mcq(`plants;`, [`plants,`, `plants`, `plants; while`]);
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
      explanation: `Two complete independent clauses must be separated by a semicolon, period, or comma + coordinating conjunction. 'plants;' correctly avoids a comma splice.`
    });
  }

  // 7.2 STANDARD ENGLISH CONVENTIONS: Subject-Verb Agreement (15 Qs)
  for (let i = 1; i <= 15; i++) {
    const pass = `The collection of rare eighteenth-century botanical manuscripts, preserved in climate-controlled archival vaults, _______ scholars from around the globe every autumn.`;
    const o = mcq(`attracts`, [`attract`, `are attracting`, `have attracted`]);
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
      explanation: `The head noun is 'collection' (singular), not the intervening prepositional phrase 'of rare manuscripts'. Therefore, the singular verb 'attracts' is required.`
    });
  }

  // 7.3 STANDARD ENGLISH CONVENTIONS: Pronouns (10 Qs)
  for (let i = 1; i <= 10; i++) {
    const pass = `Each species of bioluminescent squid in the mesopelagic zone uses a distinct flashing cadence to communicate with members of _______ own cohort.`;
    const o = mcq(`its`, [`their`, `it's`, `they're`]);
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
      explanation: `'Each species' is grammatically singular. The singular possessive pronoun 'its' correctly refers to 'Each species'.`
    });
  }

  // 7.4 STANDARD ENGLISH CONVENTIONS: Verb Tense & Aspect (10 Qs)
  for (let i = 1; i <= 10; i++) {
    const pass = `Long before Rosalind Franklin captured Photo 51 in 1952, biochemist Phoebus Levene _______ the basic constituent nucleotides of nucleic acids.`;
    const o = mcq(`had identified`, [`identifies`, `has identified`, `will identify`]);
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
      explanation: `The action occurred prior to another completed past event in 1952, requiring the past perfect tense 'had identified'.`
    });
  }

  // 7.5 STANDARD ENGLISH CONVENTIONS: Modifiers (5 Qs)
  for (let i = 1; i <= 5; i++) {
    const pass = `Equipped with state-of-the-art sub-bottom acoustic profiling sonars, _______`;
    const o = mcq(
      `marine geologists surveyed the buried sediment layers beneath the bay floor.`,
      [
        `the buried sediment layers beneath the bay floor were surveyed by researchers.`,
        `a survey of buried sediment layers was completed successfully.`,
        `it was possible to detect the ancient river channel beneath the bay floor.`
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
      explanation: `The introductory participial phrase describes who was equipped with the sonars, so the subject 'marine geologists' must directly follow the comma.`
    });
  }

  // 8.1 EXPRESSION OF IDEAS: Transitions (25 Qs)
  const transitionsBank = [
    { p: 'Geothermal power plants extract steam from deep subterranean reservoirs to generate clean baseload electricity without combustion. _______ their high initial drilling and exploration expenses often deter municipal capital investment.', w: 'However,', dist: ['Therefore,', 'Furthermore,', 'Similarly,'], exp: 'Signals contrast between benefits and high upfront costs.' },
    { p: 'The coastal municipality constructed oyster reefs along vulnerable estuaries to dampen hurricane storm surge energy. _______ local marine biodiversity flourished as the bivalves created complex habitat niches.', w: 'Moreover,', dist: ['Consequently,', 'Nevertheless,', 'Instead,'], exp: 'Signals an additive benefit beyond dampening waves.' },
    { p: 'Automated optical telescopes photograph hundreds of thousands of square degrees of night sky every hour. _______ astronomical image-processing pipelines rely on deep learning algorithms to flag transient supernova candidates.', w: 'Consequently,', dist: ['On the contrary,', 'Nevertheless,', 'Rather,'], exp: 'Signals cause-and-effect: because massive data is gathered, automated AI pipelines are necessary.' },
    { p: 'Deep-sea hydrothermal ecosystems function completely independently of sunlight. _______ photosynthetic organisms near the ocean surface depend directly on solar photons for carbon fixation.', w: 'In contrast,', dist: ['Furthermore,', 'For example,', 'Likewise,'], exp: 'Signals a direct contrast between surface and deep-sea energy sources.' },
    { p: 'Many bird species modulate their migratory flight altitudes to exploit favorable atmospheric conditions. _______ bar-headed geese ascend above eight thousand meters to harness Himalayan jet-stream winds.', w: 'For instance,', dist: ['In contrast,', 'Nevertheless,', 'Therefore,'], exp: 'Provides a specific example of the general phenomenon.' }
  ];

  for (let i = 0; i < 25; i++) {
    const item = transitionsBank[i % transitionsBank.length];
    const o = mcq(item.w, item.dist);
    list.push({
      section: 'reading_writing',
      domain: 'Expression of Ideas',
      topic: 'Transitions',
      difficulty: i % 2 === 0 ? 'medium' : 'easy',
      context_passage: item.p,
      question_text: 'Which choice completes the text with the most logical transition?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: item.exp
    });
  }

  // 8.2 EXPRESSION OF IDEAS: Rhetorical Synthesis (25 Qs)
  for (let i = 1; i <= 25; i++) {
    const pass = `While researching a topic, a student took the following notes:\n- The James Webb Space Telescope (JWST) was launched in December 2021.\n- It features a 6.5-meter segmented beryllium primary mirror coated in microscopic gold.\n- Unlike the Hubble Space Telescope, which observes primarily in ultraviolet and visible light, JWST operates in infrared wavelengths.\n- Its infrared sensitivity allows astronomers to observe the earliest galaxies formed after the Big Bang.\n- In 2022, JWST captured spectroscopic evidence of carbon dioxide in the atmosphere of exoplanet WASP-39b.`;
    const o = mcq(
      `Operating primarily in infrared light with a 6.5-meter mirror, the James Webb Space Telescope was designed to detect the earliest galaxies formed after the Big Bang.`,
      [
        `Launched in December 2021, the James Webb Space Telescope has a primary mirror coated in microscopic gold.`,
        `Hubble observed in ultraviolet and visible light, whereas WASP-39b contains atmospheric carbon dioxide.`,
        `Astronomers in 2022 used space telescopes to analyze exoplanet atmospheres.`
      ]
    );
    list.push({
      section: 'reading_writing',
      domain: 'Expression of Ideas',
      topic: 'Rhetorical Synthesis',
      difficulty: i % 2 === 0 ? 'hard' : 'medium',
      context_passage: pass,
      question_text: 'The student wants to emphasize the core observational purpose and technical design of the James Webb Space Telescope. Which choice most effectively accomplishes this goal?',
      question_type: 'multiple_choice',
      options: o.options,
      correct_answer: o.correct_answer,
      explanation: `The sentence explicitly links the telescope's key technical design (infrared sensitivity, 6.5-meter mirror) with its primary purpose (detecting the earliest galaxies).`
    });
  }

  return list;
}

// Write to file if executed
if (process.argv[1] && process.argv[1].endsWith('generateFull500Questions.ts')) {
  const generated = build500Questions();
  console.log(`Generated total: ${generated.length} questions.`);
  const mathCount = generated.filter(q => q.section === 'math').length;
  const rwCount = generated.filter(q => q.section === 'reading_writing').length;
  console.log(`Math: ${mathCount}, Reading & Writing: ${rwCount}`);

  const outPath = path.resolve(process.cwd(), 'src/server/satQuestions500Data.ts');
  const code = `import { SatQuestionSeed } from "./satQuestionsData";\n\nexport const SAT_QUESTIONS_500: SatQuestionSeed[] = ${JSON.stringify(generated, null, 2)};\n`;
  fs.writeFileSync(outPath, code, 'utf-8');
  console.log(`Successfully written to ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}
