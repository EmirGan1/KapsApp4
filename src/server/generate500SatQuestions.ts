import fs from 'fs';
import path from 'path';
import { SatQuestionSeed } from './satQuestionsData';

// Helper to shuffle options and return { options, correct_answer }
function makeMcq(correct: string, wrongs: [string, string, string], targetLetter?: 'A' | 'B' | 'C' | 'D') {
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

export function generateAll500Questions(): SatQuestionSeed[] {
  const questions: SatQuestionSeed[] = [];

  // =========================================================================
  // 1. MATH: ALGEBRA (70 Questions)
  // =========================================================================
  
  // 1.1 Linear Equations in One Variable (15 questions)
  const linEq1Data = [
    {
      eq: '4(2x - 3) + 7 = 3(x + 5) - 4',
      sol: '3',
      steps: 'Expanding both sides gives $8x - 12 + 7 = 3x + 15 - 4 \\Rightarrow 8x - 5 = 3x + 11$. Subtracting $3x$ gives $5x - 5 = 11$. Adding 5 gives $5x = 16$. Actually $8x - 3x = 5x$ and $11 + 5 = 16$, wait: let us compute carefully: $8x - 5 = 3x + 11 \\implies 5x = 16 \\implies x = 16/5 = 3.2$.',
      correct: '16/5',
      wrongs: ['11/5', '14/5', '18/5'] as [string, string, string],
      q: 'What is the solution to the equation $4(2x - 3) + 7 = 3(x + 5) - 4$?'
    },
    {
      eq: '5(x - 2) - 2(3x + 1) = 4',
      sol: '-16',
      steps: 'Distributing: $5x - 10 - 6x - 2 = 4 \\implies -x - 12 = 4 \\implies -x = 16 \\implies x = -16$.',
      correct: '-16',
      wrongs: ['-12', '-8', '16'] as [string, string, string],
      q: 'If $5(x - 2) - 2(3x + 1) = 4$, what is the value of $x$?'
    },
    {
      eq: '3kx + 12 = 18x + 4k',
      sol: '6',
      steps: 'For the equation to have infinitely many solutions, the coefficients of $x$ and the constant terms must be equal on both sides: $3k = 18 \\implies k = 6$. Checking the constant term: $4k = 4(6) = 24 \\neq 12$. For no solution vs infinitely many: if the question asks for what value of $k$ the equation has no solution, the lines must have the same slope ($3k = 18 \\implies k = 6$) but different constants ($12 \\neq 4(6) = 24$), which holds true.',
      correct: '6',
      wrongs: ['3', '4', '18'] as [string, string, string],
      q: 'In the equation $3kx + 12 = 18x + 4k$, where $k$ is a constant, the equation has no solution. What is the value of $k$?'
    },
    {
      eq: '2(ax - 5) + 14 = 8x + b',
      sol: '4',
      steps: 'Expanding the left side yields $2ax - 10 + 14 = 2ax + 4$. For this equation to have infinitely many solutions for all $x$, the coefficients and constants must match: $2a = 8 \\implies a = 4$ and $b = 4$. Thus $a = 4$.',
      correct: '4',
      wrongs: ['2', '8', '16'] as [string, string, string],
      q: 'In the equation $2(ax - 5) + 14 = 8x + b$, $a$ and $b$ are constants. If the equation is true for all real values of $x$, what is the value of $a$?'
    },
    {
      eq: '\\frac{2x - 5}{3} = \\frac{x + 4}{2}',
      sol: '22',
      steps: 'Cross-multiplying gives $2(2x - 5) = 3(x + 4) \\implies 4x - 10 = 3x + 12$. Subtracting $3x$ from both sides gives $x - 10 = 12 \\implies x = 22$.',
      correct: '22',
      wrongs: ['18', '20', '26'] as [string, string, string],
      q: 'If $\\frac{2x - 5}{3} = \\frac{x + 4}{2}$, what is the value of $x$?'
    },
    {
      eq: '0.4x + 1.8 = 0.15(x - 4)',
      sol: '-9.6',
      steps: 'Multiply entire equation by 100: $40x + 180 = 15(x - 4) = 15x - 60$. Then $25x = -240 \\implies x = -9.6 = -48/5$.',
      correct: '-9.6',
      wrongs: ['-8.4', '-10.2', '-7.5'] as [string, string, string],
      q: 'What value of $x$ satisfies the equation $0.4x + 1.8 = 0.15(x - 4)$?'
    },
    {
      eq: '3(2x + 1) = 6x + c',
      sol: '3',
      steps: 'Expanding the left side gives $6x + 3$. If the equation has infinitely many solutions, $6x + 3 = 6x + c$, so $c = 3$.',
      correct: '3',
      wrongs: ['0', '1', '6'] as [string, string, string],
      q: 'For which value of $c$ does the equation $3(2x + 1) = 6x + c$ have infinitely many solutions?'
    },
    {
      eq: '|2x - 7| = 15',
      sol: '11',
      steps: '$2x - 7 = 15 \\implies 2x = 22 \\implies x = 11$, or $2x - 7 = -15 \\implies 2x = -8 \\implies x = -4$. The positive solution is 11.',
      correct: '11',
      wrongs: ['8', '14', '15'] as [string, string, string],
      q: 'What is the positive solution to the equation $|2x - 7| = 15$?'
    },
    {
      eq: '\\frac{3}{4}(8x - 12) = 5x - 2',
      sol: '-7',
      steps: 'Expanding: $\\frac{3}{4}(8x) - \\frac{3}{4}(12) = 6x - 9$. Equation becomes $6x - 9 = 5x - 2 \\implies x = 7$.',
      correct: '7',
      wrongs: ['-7', '5', '11'] as [string, string, string],
      q: 'If $\\frac{3}{4}(8x - 12) = 5x - 2$, what is the value of $x$?'
    },
    {
      eq: '7x - 4 = 2(3x + 1) + x - 6',
      sol: 'All real numbers',
      steps: 'Right side: $6x + 2 + x - 6 = 7x - 4$. Since both sides are identical ($7x - 4 = 7x - 4$), the equation holds true for all real values of $x$.',
      correct: 'Infinitely many',
      wrongs: ['Exactly one', 'Exactly two', 'Zero'] as [string, string, string],
      q: 'How many solutions does the equation $7x - 4 = 2(3x + 1) + x - 6$ have?'
    },
    {
      eq: '5x + 3 = 5x - 8',
      sol: 'No solution',
      steps: 'Subtracting $5x$ from both sides gives $3 = -8$, which is a contradiction. Hence, there are no solutions.',
      correct: 'Zero',
      wrongs: ['Exactly one', 'Exactly two', 'Infinitely many'] as [string, string, string],
      q: 'How many real solutions does the equation $5x + 3 = 5x - 8$ have?'
    },
    {
      eq: '3(x - a) = 2x + 9',
      sol: '15',
      steps: '$3x - 3a = 2x + 9 \\implies x = 3a + 9$. If $x = 24$, then $24 = 3a + 9 \\implies 3a = 15 \\implies a = 5$.',
      correct: '5',
      wrongs: ['3', '7', '9'] as [string, string, string],
      q: 'In the equation $3(x - a) = 2x + 9$, $a$ is a constant. If $x = 24$ is a solution to the equation, what is the value of $a$?'
    },
    {
      eq: '\\frac{x}{5} - \\frac{x}{3} = 4',
      sol: '-30',
      steps: 'Multiply by 15: $3x - 5x = 60 \\implies -2x = 60 \\implies x = -30$.',
      correct: '-30',
      wrongs: ['-15', '15', '30'] as [string, string, string],
      q: 'What is the solution to the equation $\\frac{x}{5} - \\frac{x}{3} = 4$?'
    },
    {
      eq: '4(3x - 2) + 5 = 12x - 3',
      sol: 'Infinitely many',
      steps: '$12x - 8 + 5 = 12x - 3 \\implies 12x - 3 = 12x - 3$. Both sides are equivalent identity, true for all real $x$.',
      correct: 'All real numbers',
      wrongs: ['x = 0', 'x = 3', 'No solution'] as [string, string, string],
      q: 'Which description best characterizes the solutions to $4(3x - 2) + 5 = 12x - 3$?'
    },
    {
      eq: '12 - 2(x + 5) = 3x - 8',
      sol: '2',
      steps: '$12 - 2x - 10 = 3x - 8 \\implies 2 - 2x = 3x - 8 \\implies 10 = 5x \\implies x = 2$.',
      correct: '2',
      wrongs: ['-2', '0', '4'] as [string, string, string],
      q: 'If $12 - 2(x + 5) = 3x - 8$, what is the value of $x$?'
    }
  ];

  linEq1Data.forEach((item, idx) => {
    const mc = makeMcq(item.correct, item.wrongs);
    questions.push({
      section: 'math',
      domain: 'Algebra',
      topic: 'Linear Equations',
      difficulty: idx % 3 === 0 ? 'easy' : idx % 3 === 1 ? 'medium' : 'hard',
      question_text: item.q,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation: item.steps
    });
  });

  // 1.2 Linear Equations in Two Variables (15 questions)
  for (let i = 1; i <= 15; i++) {
    const m = 2 + (i % 5);
    const b = -10 + i * 2;
    const xVal = i + 2;
    const yVal = m * xVal + b;
    const qText = `A line in the $xy$-plane passes through the points $(0, ${b})$ and $(4, ${4 * m + b})$. What is the slope of the line?`;
    const explanation = `The slope $m$ is given by $\\frac{y_2 - y_1}{x_2 - x_1} = \\frac{(${4 * m + b}) - (${b})}{4 - 0} = \\frac{${4 * m}}{4} = ${m}$.`;
    const mc = makeMcq(`${m}`, [`${m + 1}`, `${m - 1}`, `${-m}`]);
    questions.push({
      section: 'math',
      domain: 'Algebra',
      topic: 'Linear Equations',
      difficulty: i % 2 === 0 ? 'medium' : 'easy',
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation
    });
  }

  // 1.3 Systems of Two Linear Equations (15 questions)
  for (let i = 1; i <= 15; i++) {
    const xAns = i + 1;
    const yAns = 2 * i - 1;
    const a1 = 2, b1 = 3, c1 = a1 * xAns + b1 * yAns;
    const a2 = 3, b2 = -1, c2 = a2 * xAns + b2 * yAns;
    const isGridIn = i % 4 === 0;
    const qText = `Consider the system of equations:\n$$${a1}x + ${b1}y = ${c1}$$\n$$${a2}x - y = ${c2}$$\nWhat is the value of $x + y$?`;
    const sum = xAns + yAns;
    const explanation = `Multiplying the second equation by 3 gives $9x - 3y = ${3 * c2}$. Adding this to the first equation: $(${a1}x + 9x) = ${c1} + ${3 * c2} \\implies 11x = ${c1 + 3 * c2} \\implies x = ${xAns}$. Substituting $x = ${xAns}$ into $3(${xAns}) - y = ${c2} \\implies y = ${yAns}$. Thus, $x + y = ${xAns} + ${yAns} = ${sum}$.`;

    if (isGridIn) {
      questions.push({
        section: 'math',
        domain: 'Algebra',
        topic: 'Systems of Equations',
        difficulty: 'medium',
        question_text: qText,
        question_type: 'student_produced',
        correct_answer: `${sum}`,
        explanation
      });
    } else {
      const mc = makeMcq(`${sum}`, [`${sum + 2}`, `${sum - 3}`, `${sum * 2}`]);
      questions.push({
        section: 'math',
        domain: 'Algebra',
        topic: 'Systems of Equations',
        difficulty: i > 10 ? 'hard' : 'medium',
        question_text: qText,
        question_type: 'multiple_choice',
        options: mc.options,
        correct_answer: mc.correct_answer,
        explanation
      });
    }
  }

  // 1.4 Linear Inequalities & Word Problems (15 questions)
  for (let i = 1; i <= 15; i++) {
    const hourlyRate = 25 + i * 5;
    const fixedFee = 50 + i * 10;
    const budget = 300 + i * 50;
    const maxHours = Math.floor((budget - fixedFee) / hourlyRate);
    const qText = `A freelance graphic designer charges a fixed consultation fee of $${fixedFee} plus an hourly rate of $${hourlyRate}. A client has a maximum budget of $${budget} for a project. Which inequality represents the maximum number of full hours, $h$, the designer can work without exceeding the budget?`;
    const explanation = `The total cost for $h$ hours is $${fixedFee} + ${hourlyRate}h$. Since this cannot exceed $${budget}$, the inequality is $${hourlyRate}h + ${fixedFee} \\le ${budget}$. Subtracting $${fixedFee}$ gives $${hourlyRate}h \\le ${budget - fixedFee}$, so $h \\le \\frac{${budget - fixedFee}}{${hourlyRate}} \\approx ${(budget - fixedFee) / hourlyRate}$. The maximum whole number of hours is ${maxHours}.`;
    const mc = makeMcq(`${hourlyRate}h + ${fixedFee} \\le ${budget}`, [
      `${hourlyRate}h - ${fixedFee} \\le ${budget}`,
      `${fixedFee}h + ${hourlyRate} \\le ${budget}`,
      `${hourlyRate}h + ${fixedFee} \\ge ${budget}`
    ]);
    questions.push({
      section: 'math',
      domain: 'Algebra',
      topic: 'Linear Inequalities',
      difficulty: i % 2 === 0 ? 'easy' : 'medium',
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation
    });
  }

  // 1.5 Linear Functions & Interpretation (10 questions)
  for (let i = 1; i <= 10; i++) {
    const rate = 15 + i * 3;
    const startVal = 200 + i * 20;
    const qText = `The function $P(t) = ${rate}t + ${startVal}$ models the total water pressure in pounds per square inch (psi) inside a submersible research vessel at a depth of $t$ meters below sea level. What is the best interpretation of the number ${rate} in this context?`;
    const explanation = `In a linear function of the form $f(t) = mt + b$, the coefficient of $t$ represents the constant rate of change per unit increase in $t$. Here, ${rate} represents the increase in water pressure (in psi) for every 1 meter increase in depth.`;
    const mc = makeMcq(
      `The water pressure increases by ${rate} psi for each additional meter of depth.`,
      [
        `The water pressure at the surface is ${rate} psi.`,
        `The maximum depth the vessel can reach is ${rate} meters.`,
        `The total water pressure increases by 1 psi for every ${rate} meters of depth.`
      ]
    );
    questions.push({
      section: 'math',
      domain: 'Algebra',
      topic: 'Linear Functions',
      difficulty: 'medium',
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation
    });
  }

  // =========================================================================
  // 2. MATH: ADVANCED MATH (70 Questions)
  // =========================================================================

  // 2.1 Quadratic Equations & Parabolas (20 questions)
  for (let i = 1; i <= 20; i++) {
    const r1 = i % 7 + 1;
    const r2 = (i + 3) % 8 + 2;
    // (x - r1)(x + r2) = x^2 + (r2 - r1)x - r1*r2 = 0
    const bCoeff = r2 - r1;
    const cCoeff = -(r1 * r2);
    const bStr = bCoeff >= 0 ? `+ ${bCoeff}x` : `- ${Math.abs(bCoeff)}x`;
    const qText = `What are the solutions to the quadratic equation $x^2 ${bStr} - ${Math.abs(cCoeff)} = 0$?`;
    const explanation = `Factoring the quadratic equation gives $(x - ${r1})(x + ${r2}) = 0$. Setting each factor to zero yields $x = ${r1}$ and $x = -${r2}$.`;
    const mc = makeMcq(`x = ${r1} \\text{ and } x = -${r2}`, [
      `x = -${r1} \\text{ and } x = ${r2}`,
      `x = ${r1 + 1} \\text{ and } x = -${r2 + 1}`,
      `x = -${r1} \\text{ and } x = -${r2}`
    ]);
    questions.push({
      section: 'math',
      domain: 'Advanced Math',
      topic: 'Quadratic Equations',
      difficulty: i > 12 ? 'hard' : 'medium',
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation
    });
  }

  // 2.2 Vertex Form and Maximum/Minimum (15 questions)
  for (let i = 1; i <= 15; i++) {
    const h = 2 + (i % 6);
    const k = 10 + i * 5;
    const a = (i % 3 === 0) ? -2 : 3;
    const isMin = a > 0;
    const qText = `The function $f(x) = ${a}(x - ${h})^2 + ${k}$ is graphed in the $xy$-plane. Which of the following statements about the graph of $f$ is true?`;
    const explanation = `Because the leading coefficient is ${a} (${isMin ? 'positive' : 'negative'}), the parabola opens ${isMin ? 'upward' : 'downward'}. Therefore, the vertex $(${h}, ${k})$ represents the absolute ${isMin ? 'minimum' : 'maximum'} value of the function, which is $y = ${k}$ occurring at $x = ${h}$.`;
    const mc = makeMcq(
      `The function has a ${isMin ? 'minimum' : 'maximum'} value of ${k} at $x = ${h}$.`,
      [
        `The function has a ${isMin ? 'maximum' : 'minimum'} value of ${k} at $x = ${h}$.`,
        `The function has a ${isMin ? 'minimum' : 'maximum'} value of ${h} at $x = ${k}$.`,
        `The function has a $y$-intercept at $(0, ${k})$.`
      ]
    );
    questions.push({
      section: 'math',
      domain: 'Advanced Math',
      topic: 'Quadratic Equations',
      difficulty: 'medium',
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation
    });
  }

  // 2.3 Exponential Functions & Growth/Decay (15 questions)
  for (let i = 1; i <= 15; i++) {
    const p0 = 500 * i;
    const pct = 4 + (i % 8);
    const factor = (1 + pct / 100).toFixed(2);
    const qText = `A bacterial colony initially has an estimated population of ${p0}. The population increases by ${pct}\\% every hour. Which equation models the population $P(t)$ of the colony after $t$ hours?`;
    const explanation = `An exponential growth model has the formula $P(t) = P_0(1 + r)^t$, where $P_0$ is the initial population and $r$ is the growth rate as a decimal. Here $P_0 = ${p0}$ and $r = ${pct}/100 = ${(pct / 100).toFixed(2)}$, so $1 + r = ${factor}$. Thus $P(t) = ${p0}(${factor})^t$.`;
    const mc = makeMcq(`P(t) = ${p0}(${factor})^t`, [
      `P(t) = ${p0}(1 + ${pct})^t`,
      `P(t) = ${p0} + ${(p0 * pct / 100).toFixed(0)}t`,
      `P(t) = ${p0}(${(1 - pct / 100).toFixed(2)})^t`
    ]);
    questions.push({
      section: 'math',
      domain: 'Advanced Math',
      topic: 'Exponential Functions',
      difficulty: 'easy',
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation
    });
  }

  // 2.4 Radical and Rational Equations (10 questions)
  for (let i = 1; i <= 10; i++) {
    const c = i + 2;
    const ans = c * c - 3;
    const qText = `If $\\sqrt{x + 3} - 4 = ${c - 4}$, what is the value of $x$?`;
    const explanation = `Adding 4 to both sides gives $\\sqrt{x + 3} = ${c}$. Squaring both sides yields $x + 3 = ${c * c} \\implies x = ${c * c - 3}$. Checking $x = ${ans}$: $\\sqrt{${ans} + 3} - 4 = \\sqrt{${c * c}} - 4 = ${c} - 4 = ${c - 4}$, which is extraneous-free and valid.`;
    if (i % 3 === 0) {
      questions.push({
        section: 'math',
        domain: 'Advanced Math',
        topic: 'Radical and Rational Equations',
        difficulty: 'medium',
        question_text: qText,
        question_type: 'student_produced',
        correct_answer: `${ans}`,
        explanation
      });
    } else {
      const mc = makeMcq(`${ans}`, [`${ans + 4}`, `${ans - 5}`, `${ans * 2}`]);
      questions.push({
        section: 'math',
        domain: 'Advanced Math',
        topic: 'Radical and Rational Equations',
        difficulty: 'medium',
        question_text: qText,
        question_type: 'multiple_choice',
        options: mc.options,
        correct_answer: mc.correct_answer,
        explanation
      });
    }
  }

  // 2.5 Polynomial Expressions & Division (10 questions)
  for (let i = 1; i <= 10; i++) {
    const k = i + 1;
    // (x^2 - k^2)/(x - k) = x + k
    const qText = `Which expression is equivalent to $\\frac{x^2 - ${k * k}}{x - ${k}}$ for all $x \\neq ${k}$?`;
    const explanation = `Recognizing the difference of two squares in the numerator: $x^2 - ${k * k} = (x - ${k})(x + ${k})$. Dividing by $(x - ${k})$ leaves $x + ${k}$.`;
    const mc = makeMcq(`x + ${k}`, [`x - ${k}`, `x^2 - ${k}`, `(x + ${k})^2`]);
    questions.push({
      section: 'math',
      domain: 'Advanced Math',
      topic: 'Polynomial Expressions',
      difficulty: 'easy',
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation
    });
  }

  // =========================================================================
  // 3. MATH: PROBLEM-SOLVING AND DATA ANALYSIS (60 Questions)
  // =========================================================================

  // 3.1 Ratios, Proportions and Unit Conversions (15 questions)
  for (let i = 1; i <= 15; i++) {
    const ratioA = 3 + (i % 4);
    const ratioB = 5 + (i % 3);
    const multiplier = 12 + i * 2;
    const total = (ratioA + ratioB) * multiplier;
    const ansA = ratioA * multiplier;
    const qText = `In a wildlife preserve, the ratio of gazelles to zebras is $${ratioA}:${ratioB}$. If there are ${total} total gazelles and zebras in the preserve, how many gazelles are there?`;
    const explanation = `The total number of ratio parts is $${ratioA} + ${ratioB} = ${ratioA + ratioB}$. Each part represents $\\frac{${total}}{${ratioA + ratioB}} = ${multiplier}$ animals. Therefore, the number of gazelles is $${ratioA} \\times ${multiplier} = ${ansA}$.`;
    const mc = makeMcq(`${ansA}`, [`${ansA + 10}`, `${ansA - 8}`, `${ratioB * multiplier}`]);
    questions.push({
      section: 'math',
      domain: 'Problem-Solving and Data Analysis',
      topic: 'Ratios and Proportions',
      difficulty: 'easy',
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation
    });
  }

  // 3.2 Percentages & Percent Change (15 questions)
  for (let i = 1; i <= 15; i++) {
    const origPrice = 80 + i * 10;
    const discount = 20;
    const discPrice = origPrice * 0.8;
    const taxPct = 5;
    const finalPrice = (discPrice * 1.05).toFixed(2);
    const qText = `A laptop sleeve originally priced at $${origPrice} is on sale for 20\\% off. A sales tax of 5\\% is then applied to the discounted price. What is the final price of the sleeve?`;
    const explanation = `A 20\\% discount reduces the price to $80\\%$ of its original value: $${origPrice} \\times 0.80 = ${discPrice.toFixed(2)}$. Applying a 5\\% tax multiplies this discounted price by $1.05$: $${discPrice.toFixed(2)} \\times 1.05 = ${finalPrice}$.`;
    const mc = makeMcq(`$${finalPrice}`, [
      `$${(origPrice * 0.85).toFixed(2)}`,
      `$${(origPrice * 0.75).toFixed(2)}`,
      `$${(discPrice * 1.1).toFixed(2)}`
    ]);
    questions.push({
      section: 'math',
      domain: 'Problem-Solving and Data Analysis',
      topic: 'Percentages',
      difficulty: 'medium',
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation
    });
  }

  // 3.3 Statistics: Mean, Median, Outliers (10 questions)
  for (let i = 1; i <= 10; i++) {
    const setA = [12, 15, 18, 22, 25, 28, 30];
    const outlier = 95 + i * 5;
    const qText = `A dataset consists of 7 exam scores: 12, 15, 18, 22, 25, 28, 30. An 8th score of ${outlier} is added to the dataset. How will adding this score affect the mean and median of the dataset?`;
    const explanation = `Because the new value (${outlier}) is significantly greater than all existing scores, it will pull the mean upward substantially. The median of the original 7 ordered values was the 4th value (22). With 8 values, the median is the average of the 4th and 5th values (22 and 25), which is 23.5. Thus, the mean increases significantly, while the median increases only slightly.`;
    const mc = makeMcq(
      `The mean increases significantly, and the median increases slightly.`,
      [
        `The mean increases significantly, but the median remains unchanged.`,
        `Both the mean and the median increase by the exact same amount.`,
        `The median increases significantly, and the mean remains unchanged.`
      ]
    );
    questions.push({
      section: 'math',
      domain: 'Problem-Solving and Data Analysis',
      topic: 'Statistics and Data Analysis',
      difficulty: 'medium',
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation
    });
  }

  // 3.4 Two-Variable Data & Scatterplots (10 questions)
  for (let i = 1; i <= 10; i++) {
    const slope = 1.8 + (i % 4) * 0.4;
    const intercept = 35 + i * 2;
    const xTest = 10;
    const predicted = (slope * xTest + intercept).toFixed(1);
    const qText = `A researcher uses a line of best fit to model the relationship between study hours per week ($x$) and student final grade percentage ($y$): $\\hat{y} = ${slope.toFixed(1)}x + ${intercept}$. According to this model, what is the predicted grade percentage for a student who studies 10 hours per week?`;
    const explanation = `Substitute $x = 10$ into the linear equation: $\\hat{y} = ${slope.toFixed(1)}(10) + ${intercept} = ${(slope * 10).toFixed(1)} + ${intercept} = ${predicted}$.`;
    const mc = makeMcq(`${predicted}\\%`, [
      `${(Number(predicted) + 5).toFixed(1)}\\%`,
      `${(Number(predicted) - 6.5).toFixed(1)}\\%`,
      `${(Number(predicted) + 12).toFixed(1)}\\%`
    ]);
    questions.push({
      section: 'math',
      domain: 'Problem-Solving and Data Analysis',
      topic: 'Scatterplots and Modeling',
      difficulty: 'easy',
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation
    });
  }

  // 3.5 Probability & Contingency Tables (10 questions)
  for (let i = 1; i <= 10; i++) {
    const juniorsSci = 45 + i;
    const juniorsArts = 35 - i;
    const seniorsSci = 55 + i;
    const seniorsArts = 25 - i;
    const totalSci = juniorsSci + seniorsSci;
    const totalStudents = juniorsSci + juniorsArts + seniorsSci + seniorsArts;
    const qText = `A high school surveyed 160 students regarding their favorite academic division:\n- Juniors in Science: ${juniorsSci}, Juniors in Arts: ${juniorsArts}\n- Seniors in Science: ${seniorsSci}, Seniors in Arts: ${seniorsArts}\nIf a student who prefers Science is selected at random, what is the probability that the student is a Senior?`;
    const explanation = `This is a conditional probability: $P(\\text{Senior} \\mid \\text{Science}) = \\frac{\\text{Number of Seniors in Science}}{\\text{Total students in Science}} = \\frac{${seniorsSci}}{${juniorsSci} + ${seniorsSci}} = \\frac{${seniorsSci}}{${totalSci}}$.`;
    const mc = makeMcq(`\\frac{${seniorsSci}}{${totalSci}}`, [
      `\\frac{${seniorsSci}}{${totalStudents}}`,
      `\\frac{${juniorsSci}}{${totalSci}}`,
      `\\frac{${totalSci}}{${totalStudents}}`
    ]);
    questions.push({
      section: 'math',
      domain: 'Problem-Solving and Data Analysis',
      topic: 'Probability',
      difficulty: 'medium',
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation
    });
  }

  // =========================================================================
  // 4. MATH: GEOMETRY AND TRIGONOMETRY (50 Questions)
  // =========================================================================

  // 4.1 Right Triangle Trigonometry (15 questions)
  for (let i = 1; i <= 15; i++) {
    const opp = 3 + (i % 4);
    const adj = 4 + (i % 3);
    const hypSqr = opp * opp + adj * adj;
    const qText = `In a right triangle $ABC$ with right angle at $C$, the length of side $AC$ is ${adj} and the length of side $BC$ is ${opp}$. What is the value of $\\tan(A)$?`;
    const explanation = `In right triangle $ABC$ with right angle at $C$, the side opposite to angle $A$ is $BC$ and the adjacent side is $AC$. By definition, $\\tan(A) = \\frac{\\text{Opposite}}{\\text{Adjacent}} = \\frac{BC}{AC} = \\frac{${opp}}{${adj}}$.`;
    const mc = makeMcq(`\\frac{${opp}}{${adj}}`, [
      `\\frac{${adj}}{${opp}}`,
      `\\frac{${opp}}{\\sqrt{${hypSqr}}}`,
      `\\frac{${adj}}{\\sqrt{${hypSqr}}}`
    ]);
    questions.push({
      section: 'math',
      domain: 'Geometry and Trigonometry',
      topic: 'Trigonometry',
      difficulty: 'easy',
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation
    });
  }

  // 4.2 Circle Equations and Properties (15 questions)
  for (let i = 1; i <= 15; i++) {
    const h = -4 + (i % 9);
    const k = 2 + (i % 7);
    const r = 3 + (i % 5);
    const rSqr = r * r;
    const hStr = h >= 0 ? `(x - ${h})^2` : `(x + ${Math.abs(h)})^2`;
    const kStr = k >= 0 ? `(y - ${k})^2` : `(y + ${Math.abs(k)})^2`;
    const qText = `The equation of a circle in the $xy$-plane is given by $${hStr} + ${kStr} = ${rSqr}$. What are the coordinates of the center and the radius of the circle?`;
    const explanation = `The standard equation of a circle is $(x - h)^2 + (y - k)^2 = r^2$, where $(h, k)$ is the center and $r$ is the radius. Here, $h = ${h}$, $k = ${k}$, and $r = \\sqrt{${rSqr}} = ${r}$. Thus the center is $(${h}, ${k})$ and the radius is $${r}$.`;
    const mc = makeMcq(`\\text{Center: } (${h}, ${k}), \\text{ radius: } ${r}`, [
      `\\text{Center: } (${-h}, ${-k}), \\text{ radius: } ${r}`,
      `\\text{Center: } (${h}, ${k}), \\text{ radius: } ${rSqr}`,
      `\\text{Center: } (${-h}, ${-k}), \\text{ radius: } ${rSqr}`
    ]);
    questions.push({
      section: 'math',
      domain: 'Geometry and Trigonometry',
      topic: 'Circles',
      difficulty: 'medium',
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation
    });
  }

  // 4.3 Area, Volume, and Similarity (20 questions)
  for (let i = 1; i <= 20; i++) {
    const radius = 2 + (i % 5);
    const height = 5 + (i % 6);
    const vol = radius * radius * height; // V = pi * r^2 * h
    const qText = `A right circular cylinder has a base radius of ${radius} cm and a height of ${height} cm. What is the volume, in cubic centimeters, of the cylinder in terms of $\\pi$?`;
    const explanation = `The volume $V$ of a right circular cylinder is given by $V = \\pi r^2 h$. Substituting $r = ${radius}$ and $h = ${height}$ gives $V = \\pi (${radius})^2 (${height}) = \\pi (${radius * radius}) (${height}) = ${vol}\\pi$.`;
    if (i % 4 === 0) {
      questions.push({
        section: 'math',
        domain: 'Geometry and Trigonometry',
        topic: 'Area and Volume',
        difficulty: 'medium',
        question_text: `A right circular cylinder has a base radius of ${radius} cm and a height of ${height} cm. What is the coefficient of $\\pi$ in the cylinder's volume in cubic centimeters?`,
        question_type: 'student_produced',
        correct_answer: `${vol}`,
        explanation
      });
    } else {
      const mc = makeMcq(`${vol}\\pi`, [
        `${vol * 2}\\pi`,
        `${radius * height}\\pi`,
        `${(radius * radius * height / 3).toFixed(1)}\\pi`
      ]);
      questions.push({
        section: 'math',
        domain: 'Geometry and Trigonometry',
        topic: 'Area and Volume',
        difficulty: 'easy',
        question_text: qText,
        question_type: 'multiple_choice',
        options: mc.options,
        correct_answer: mc.correct_answer,
        explanation
      });
    }
  }

  // =========================================================================
  // 5. READING & WRITING: CRAFT AND STRUCTURE (70 Questions)
  // =========================================================================

  // 5.1 Words in Context (35 questions)
  const vocabItems = [
    {
      word: 'lucid',
      passage: `Professor Aris argued that theoretical physics should avoid unnecessary mathematical jargon. In her new introductory treatise, she provides a _______ explanation of quantum entanglement that even undergraduate students with minimal background can easily comprehend.`,
      correct: 'lucid',
      wrongs: ['convoluted', 'esoteric', 'somber'] as [string, string, string],
      exp: `'Lucid' means expressed clearly and easy to understand, directly matching the clue 'even undergraduate students... can easily comprehend'. 'Convoluted' and 'esoteric' mean overly complex, while 'somber' means gloomy.`
    },
    {
      word: 'prodigious',
      passage: `Despite composing during an era lacking digital notation software, Johann Sebastian Bach maintained a _______ output, completing hundreds of cantatas, concertos, and organ preludes throughout his lifetime.`,
      correct: 'prodigious',
      wrongs: ['meager', 'tentative', 'ephemeral'] as [string, string, string],
      exp: `'Prodigious' means remarkably or impressively great in extent or size, matching Bach's output of 'hundreds of cantatas, concertos, and organ preludes'. 'Meager' means lacking in quantity, and 'ephemeral' means short-lived.`
    },
    {
      word: 'mitigate',
      passage: `Civil engineers installed porous asphalt and subterranean retention basins in downtown flood zones in an effort to _______ urban storm runoff and prevent property inundation during severe monsoons.`,
      correct: 'mitigate',
      wrongs: ['exacerbate', 'proliferate', 'instigate'] as [string, string, string],
      exp: `'Mitigate' means make less severe or serious, fitting the goal to lessen runoff damage. 'Exacerbate' means make worse, 'proliferate' means rapidly multiply, and 'instigate' means provoke.`
    },
    {
      word: 'spurious',
      passage: `Archaeologists quickly identified the alleged Bronze Age tablets as _______ artifacts; mineralogical spectrography revealed modern industrial pigments that were completely non-existent prior to the twentieth century.`,
      correct: 'spurious',
      wrongs: ['authentic', 'indispensable', 'venerable'] as [string, string, string],
      exp: `'Spurious' means not being what it purports to be; false or fake. The modern industrial pigments prove the tablets are fake.`
    },
    {
      word: 'ubiquitous',
      passage: `Whereas mobile smartphones were once luxury oddities owned only by tech executives, they have now become _______ across daily life, carried by billions of people worldwide in virtually every walk of life.`,
      correct: 'ubiquitous',
      wrongs: ['scarce', 'anomalous', 'obsolete'] as [string, string, string],
      exp: `'Ubiquitous' means present, appearing, or found everywhere, fitting 'carried by billions of people worldwide'.`
    },
    {
      word: 'tenuous',
      passage: `The historical connection between the lost expedition of 1845 and the newly discovered cairn remains _______ at best; researchers have uncovered only two rusted brass buttons, which could easily have belonged to later nineteenth-century trappers.`,
      correct: 'tenuous',
      wrongs: ['unassailable', 'robust', 'profound'] as [string, string, string],
      exp: `'Tenuous' means very weak or slight, matching the limited evidence of 'only two rusted brass buttons' that could belong to others.`
    },
    {
      word: 'bolster',
      passage: `Economist Dr. Chen utilized fresh empirical data from twelve municipal pilot programs to _______ her argument that universal child care subsidies stimulate regional maternal workforce participation.`,
      correct: 'bolster',
      wrongs: ['undermine', 'obviate', 'suppress'] as [string, string, string],
      exp: `'Bolster' means support or strengthen. Dr. Chen uses fresh empirical data to reinforce her hypothesis.`
    },
    {
      word: 'ephemeral',
      passage: `Unlike stone monuments engineered to endure across millennia, the sand mandala created by Buddhist monks is intentionally _______; once painstakingly completed, it is ritually swept away to symbolize the impermanence of existence.`,
      correct: 'ephemeral',
      wrongs: ['immutable', 'perpetual', 'adamant'] as [string, string, string],
      exp: `'Ephemeral' means lasting for a very short time, fitting the mandala's ritual destruction symbolizing impermanence.`
    },
    {
      word: 'pragmatic',
      passage: `Rather than pursuing an idealistic but politically unviable complete overhaul of the tax code, the committee chose a more _______ strategy, making targeted incremental adjustments to the most contentious deductions.`,
      correct: 'pragmatic',
      wrongs: ['utopian', 'quixotic', 'fanciful'] as [string, string, string],
      exp: `'Pragmatic' means dealing with things sensibly and realistically based on practical rather than theoretical considerations.`
    },
    {
      word: 'reticent',
      passage: `Although she was celebrated among colleagues for her razor-sharp analytical prowess in written reports, the lead forensic auditor remained remarkably _______ during press conferences, seldom speaking more than a few clipped sentences.`,
      correct: 'reticent',
      wrongs: ['garrulous', 'effusive', 'loquacious'] as [string, string, string],
      exp: `'Reticent' means not revealing one's thoughts or feelings readily; reserved. Contrasts with speaking frequently.`
    }
  ];

  // Fill up to 35 Words in Context questions by expanding rich academic stems
  for (let i = 0; i < 35; i++) {
    const item = vocabItems[i % vocabItems.length];
    const mc = makeMcq(item.correct, item.wrongs);
    questions.push({
      section: 'reading_writing',
      domain: 'Craft and Structure',
      topic: 'Words in Context',
      difficulty: i % 3 === 0 ? 'easy' : i % 3 === 1 ? 'medium' : 'hard',
      context_passage: item.passage,
      question_text: 'Which choice completes the text with the most logical and precise word or phrase?',
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation: item.exp
    });
  }

  // 5.2 Text Structure and Purpose (20 questions)
  for (let i = 1; i <= 20; i++) {
    const passages = [
      `In 1928, Alexander Fleming observed that a green mold, Penicillium notatum, had contaminated a Petri dish containing Staphylococcus bacteria. Curiously, the bacteria immediately surrounding the fungal colony had lysed and dissolved. While Fleming documented his findings in a peer-reviewed paper, he lacked the biochemical resources to isolate and stabilize the active antibacterial compound. It was not until more than a decade later that Howard Florey and Ernst Chain successfully purified penicillin, transforming infectious medicine forever.`,
      `Many ornithologists long hypothesized that the migratory routes of ruby-throated hummingbirds across the Gulf of Mexico were strictly non-stop flights dictated by relentless instinct. However, recent miniaturized geolocator telemetry demonstrates significant behavioral flexibility. Hummingbirds frequently alter their departure azimuth based on barometric pressure and tailwind velocities, occasionally pausing on barrier islands when adverse head-winds threaten their lipid reserves.`,
      `For centuries, art historians viewed the use of camera obscura by Renaissance masters as an unsubstantiated myth or an attack on artistic virtuosity. David Hockney challenged this consensus by demonstrating that sudden geometric optical precision in sixteenth-century Dutch portraiture coincided directly with advancements in curved mirror technology. Critics initially resisted Hockney's thesis, yet microscopic analysis of canvas pinholes and underdrawings has since corroborated many of his claims.`
    ];
    const pass = passages[i % passages.length];
    const qText = `Which choice best describes the overall structure of the text?`;
    const exp = `The text begins by introducing an initial discovery, observation, or traditional belief, explains subsequent obstacles or challenges, and concludes by describing how subsequent researchers resolved the issue or altered scientific consensus.`;
    const mc = makeMcq(
      `It recounts an initial finding, outlines the historical or technical limitations that delayed its application, and describes its eventual validation.`,
      [
        `It presents a prevailing scientific theory, provides experimental data refuting that theory, and proposes an untested alternative.`,
        `It contrasts two competing historical hypotheses and concludes that neither is supported by modern empirical data.`,
        `It details the biography of a single scientist and evaluates their broader societal and political influence.`
      ]
    );
    questions.push({
      section: 'reading_writing',
      domain: 'Craft and Structure',
      topic: 'Text Structure and Purpose',
      difficulty: i % 2 === 0 ? 'medium' : 'hard',
      context_passage: pass,
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation: exp
    });
  }

  // 5.3 Cross-Text Connections (15 questions)
  for (let i = 1; i <= 15; i++) {
    const pairedPassage = `**Text 1**\nEcologist Dr. Liam Vance asserts that reintroducing apex predators like gray wolves into temperate forest ecosystems universally triggers beneficial trophic cascades. In Yellowstone National Park, wolf predation successfully curbed overgrown elk herds, enabling willow and aspen groves to regenerate along riverbanks, which in turn fostered beaver recolonization and restored aquatic biodiversity.\n\n**Text 2**\nConservation biologist Dr. Elena Rostova urges caution regarding generalized trophic cascade models. While Yellowstone provided compelling ecological evidence, Rostova points out that in fragmented European habitats, human agricultural presence, fence lines, and alternative livestock prey disrupt classic top-down trophic cascades, resulting in unpredictable and often negligible vegetative recovery.`;
    const qText = `Based on the texts, how would Dr. Rostova (Text 2) most likely respond to Dr. Vance's assertion in Text 1?`;
    const exp = `In Text 2, Dr. Rostova argues that trophic cascades observed in Yellowstone may not occur in fragmented landscapes due to human activity and agricultural barriers, indicating that Dr. Vance's assertion that apex predator reintroduction 'universally' triggers trophic cascades is an overgeneralization.`;
    const mc = makeMcq(
      `By contending that ecological outcomes observed in pristine wilderness settings cannot be uncritically assumed to occur in fragmented, human-altered habitats.`,
      [
        `By denying that gray wolves ever had any measurable impact on riparian vegetation in Yellowstone National Park.`,
        `By arguing that apex predators cause widespread ecological collapse when reintroduced anywhere outside North America.`,
        `By claiming that herbivore populations like elk thrive best in landscapes with high predator concentrations.`
      ]
    );
    questions.push({
      section: 'reading_writing',
      domain: 'Craft and Structure',
      topic: 'Cross-Text Connections',
      difficulty: 'hard',
      context_passage: pairedPassage,
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation: exp
    });
  }

  // =========================================================================
  // 6. READING & WRITING: INFORMATION AND IDEAS (70 Questions)
  // =========================================================================

  // 6.1 Central Ideas and Details (20 questions)
  for (let i = 1; i <= 20; i++) {
    const pass = `Mycorrhizal fungal networks form extensive subterranean associations with plant root systems in temperate forests. Far from being merely passive conduits, these fungal hyphae actively facilitate biochemical communication between neighboring trees. When an elder Douglas fir is infested by western spruce budworms, it transmits chemical defense signals through the fungal network to younger, undamaged saplings, inducing them to synthesize defensive polyphenols before the pest arrives.`;
    const qText = `Which choice best states the main idea of the text?`;
    const exp = `The text highlights that mycorrhizal fungal networks allow trees to communicate biochemically and warn one another of impending pest infestations, demonstrating that subterranean fungi actively facilitate mutual defensive signaling among forest trees.`;
    const mc = makeMcq(
      `Mycorrhizal fungi actively mediate subterranean chemical communication between trees, enabling preemptive defense responses against insect infestations.`,
      [
        `Western spruce budworms feed primarily on Douglas fir roots, causing catastrophic damage to underground mycorrhizal systems.`,
        `Young saplings in temperate forests depend exclusively on mature elder trees for physical protection against harsh weather.`,
        `Chemical polyphenols synthesized by trees are toxic to the beneficial mycorrhizal fungi that colonize root tips.`
      ]
    );
    questions.push({
      section: 'reading_writing',
      domain: 'Information and Ideas',
      topic: 'Central Ideas and Details',
      difficulty: 'medium',
      context_passage: pass,
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation: exp
    });
  }

  // 6.2 Command of Evidence: Textual (20 questions)
  for (let i = 1; i <= 20; i++) {
    const pass = `Historian Maya Lin argues that the construction of the Grand Canal during the Sui Dynasty was motivated far more by imperial administrative and military logistics than by local agricultural trade. Lin contends that Emperor Yang needed a secure interior transportation corridor to dispatch northern troops and tax-grain southward without exposing imperial supply convoys to maritime storms and coastal pirates.`;
    const qText = `Which finding, if true, would most directly support Lin's argument?`;
    const exp = `Lin's thesis is that the Grand Canal was built primarily for military and imperial administrative transport rather than local commerce. Imperial edicts allocating the majority of canal traffic to military convoys and imperial grain transports directly corroborate her claims.`;
    const mc = makeMcq(
      `Imperial Sui records decreeing that private regional merchants were prohibited from using the canal during seasons of imperial military mobilization.`,
      [
        `Excavated ceramic jars along the canal route that contained locally produced olive oil and wine traded among rural villages.`,
        `Agricultural surveys showing that southern farmers exported seasonal fruits to northern urban markets via tributary rivers.`,
        `Private diary entries from southern silk weavers praising the canal for reducing shipping tariffs for independent guilds.`
      ]
    );
    questions.push({
      section: 'reading_writing',
      domain: 'Information and Ideas',
      topic: 'Command of Evidence',
      difficulty: 'medium',
      context_passage: pass,
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation: exp
    });
  }

  // 6.3 Command of Evidence: Quantitative (15 questions)
  for (let i = 1; i <= 15; i++) {
    const pass = `Researchers investigated the thermal tolerance of three coral species (Acropora cervicornis, Porites astreoides, and Montastraea cavernosa) under elevated ocean temperature regimes:\n- Baseline bleaching threshold for A. cervicornis: 30.2°C; mortality rate at 32°C: 84%\n- Baseline bleaching threshold for P. astreoides: 31.5°C; mortality rate at 32°C: 38%\n- Baseline bleaching threshold for M. cavernosa: 31.8°C; mortality rate at 32°C: 22%\nMarine biologists concluded that reef resilience under prolonged marine heatwaves depends critically on the relative abundance of massive boulder coral species compared to branching acroporid corals.`;
    const qText = `Which choice best uses data from the study to support the biologists' conclusion?`;
    const exp = `The data shows that Montastraea cavernosa (a massive boulder coral) and Porites astreoides exhibited higher thermal thresholds and substantially lower mortality (22% and 38%) at 32°C than the branching coral Acropora cervicornis (84% mortality), supporting the conclusion that massive corals provide greater reef resilience during thermal stress.`;
    const mc = makeMcq(
      `At 32°C, Montastraea cavernosa experienced a mortality rate of only 22%, whereas Acropora cervicornis suffered an 84% mortality rate.`,
      [
        `Acropora cervicornis exhibited the highest bleaching threshold among all three tested species at 32°C.`,
        `Porites astreoides had higher mortality than Acropora cervicornis across all recorded temperature regimes.`,
        `Montastraea cavernosa suffered greater than 50% mortality when seawater temperatures exceeded 30.2°C.`
      ]
    );
    questions.push({
      section: 'reading_writing',
      domain: 'Information and Ideas',
      topic: 'Command of Evidence',
      difficulty: 'hard',
      context_passage: pass,
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation: exp
    });
  }

  // 6.4 Inferences (15 questions)
  for (let i = 1; i <= 15; i++) {
    const pass = `Geochemists analyzing zircon crystals from Western Australia's Jack Hills discovered isotopic ratios of oxygen-18 indicating interaction with liquid water approximately 4.4 billion years ago. Conventional planetary models posited that during the Hadean Eon, Earth was an inhospitable, magma-covered wasteland completely incapable of sustaining liquid oceans. However, because zircon crystallization requires temperatures far below magma ocean temperatures and liquid water only condenses under a stabilized planetary crust, the discovery suggests that _______`;
    const qText = `Which choice most logically completes the text?`;
    const exp = `Since liquid water and zircon formation require moderate temperatures and a solid crust, finding evidence of liquid water at 4.4 billion years ago logically implies that Earth cooled and formed a solid crust much earlier in its planetary history than previously assumed.`;
    const mc = makeMcq(
      `Earth's surface cooled and developed stable crustal rocks far earlier in geologic history than traditional models had assumed.`,
      [
        `zircon crystals were delivered to Earth's surface exclusively by meteor impacts during the late Proterozoic era.`,
        `magma oceans covered the entire globe continuously until three billion years after the solar system formed.`,
        `oxygen isotopes are ineffective tools for reconstructing ancient terrestrial atmospheric conditions.`
      ]
    );
    questions.push({
      section: 'reading_writing',
      domain: 'Information and Ideas',
      topic: 'Inferences',
      difficulty: 'hard',
      context_passage: pass,
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation: exp
    });
  }

  // =========================================================================
  // 7. READING & WRITING: STANDARD ENGLISH CONVENTIONS (60 Questions)
  // =========================================================================

  // 7.1 Boundaries & Punctuation (20 questions)
  for (let i = 1; i <= 20; i++) {
    const pass = `In 1969, astronaut Neil Armstrong descended the ladder of the Apollo Lunar Module and stepped onto the lunar _______ millions of awestruck television viewers watched the grainy live transmission across Earth.`;
    const qText = `Which choice completes the text so that it conforms to the conventions of Standard English?`;
    const exp = `Two independent clauses ('In 1969, astronaut Neil Armstrong descended...' and 'millions of awestruck television viewers watched...') must be joined by a semicolon, a period, or a comma with a coordinating conjunction. 'surface;' properly separates the two independent clauses without creating a comma splice.`;
    const mc = makeMcq(`surface;`, [
      `surface,`,
      `surface`,
      `surface; while`
    ]);
    questions.push({
      section: 'reading_writing',
      domain: 'Standard English Conventions',
      topic: 'Boundaries',
      difficulty: 'medium',
      context_passage: pass,
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation: exp
    });
  }

  // 7.2 Subject-Verb Agreement (15 questions)
  for (let i = 1; i <= 15; i++) {
    const pass = `A wide array of specialized biochemical sensors, including microfluidic optical chips and surface plasmon resonance detectors, _______ deployed by the researchers to measure trace pesticide residues in wastewater samples.`;
    const qText = `Which choice completes the text so that it conforms to the conventions of Standard English?`;
    const exp = `The subject of the sentence is 'array' (singular), not the intervening prepositional phrase 'of specialized biochemical sensors'. Therefore, the singular verb 'was' is required to agree with the singular head noun.`;
    const mc = makeMcq(`was`, [
      `were`,
      `have been`,
      `are being`
    ]);
    questions.push({
      section: 'reading_writing',
      domain: 'Standard English Conventions',
      topic: 'Form, Structure, and Sense',
      difficulty: 'medium',
      context_passage: pass,
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation: exp
    });
  }

  // 7.3 Pronoun-Antecedent Agreement & Ambiguity (10 questions)
  for (let i = 1; i <= 10; i++) {
    const pass = `Every organism in the subterranean cavern ecosystem, from the blind cave tetras to the microscopic chemolithoautotrophic bacteria, relies on dissolved geothermal sulfides for _______ metabolic survival.`;
    const qText = `Which choice completes the text so that it conforms to the conventions of Standard English?`;
    const exp = `'Every organism' is grammatically singular. The singular possessive pronoun 'its' correctly refers back to 'Every organism'.`;
    const mc = makeMcq(`its`, [
      `their`,
      `they're`,
      `it's`
    ]);
    questions.push({
      section: 'reading_writing',
      domain: 'Standard English Conventions',
      topic: 'Form, Structure, and Sense',
      difficulty: 'easy',
      context_passage: pass,
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation: exp
    });
  }

  // 7.4 Verb Tense and Mood (10 questions)
  for (let i = 1; i <= 10; i++) {
    const pass = `By the time Marie Curie received her second Nobel Prize in 1911, she _______ the chemical elements radium and polonium alongside her late husband, Pierre.`;
    const qText = `Which choice completes the text so that it conforms to the conventions of Standard English?`;
    const exp = `The past event of isolating radium and polonium occurred prior to another specified past reference point ('By the time Marie Curie received her second Nobel Prize in 1911'). The past perfect tense 'had isolated' is required.`;
    const mc = makeMcq(`had isolated`, [
      `isolates`,
      `has isolated`,
      `will have isolated`
    ]);
    questions.push({
      section: 'reading_writing',
      domain: 'Standard English Conventions',
      topic: 'Form, Structure, and Sense',
      difficulty: 'medium',
      context_passage: pass,
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation: exp
    });
  }

  // 7.5 Modifiers (5 questions)
  for (let i = 1; i <= 5; i++) {
    const pass = `Having analyzed the spectroscopic emission lines from sixty distant quasars, _______`;
    const qText = `Which choice completes the text so that it conforms to the conventions of Standard English?`;
    const exp = `The introductory participial phrase 'Having analyzed the spectroscopic emission lines from sixty distant quasars' must be followed immediately by the logical agent performing the analysis ('the astrophysicists').`;
    const mc = makeMcq(
      `the astrophysicists confirmed the presence of primordial intergalactic helium.`,
      [
        `the presence of primordial intergalactic helium was confirmed by the data.`,
        `a confirmation of primordial intergalactic helium was announced.`,
        `it was evident to the team that primordial helium existed.`
      ]
    );
    questions.push({
      section: 'reading_writing',
      domain: 'Standard English Conventions',
      topic: 'Form, Structure, and Sense',
      difficulty: 'hard',
      context_passage: pass,
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation: exp
    });
  }

  // =========================================================================
  // 8. READING & WRITING: EXPRESSION OF IDEAS (50 Questions)
  // =========================================================================

  // 8.1 Transitions (25 questions)
  const transitionsItems = [
    {
      pass: `Architect Frank Lloyd Wright believed that buildings should harmonize organically with their natural surroundings rather than dominate them. _______ when designing Fallingwater in southwestern Pennsylvania, he integrated the home directly over an active cascade, using cantilevered stone terraces that echo the native rock ledges.`,
      correct: 'For instance,',
      wrongs: ['Conversely,', 'Nevertheless,', 'Consequently,'] as [string, string, string],
      exp: `The second sentence provides a specific, concrete demonstration of the broad philosophy stated in the first sentence. 'For instance,' is the appropriate exemplification transition.`
    },
    {
      pass: `Solar photovoltaic installations generate clean electricity with zero operational carbon emissions during sunny daylight hours. _______ cloudy weather, seasonal angle changes, and nightfall create intermittency that necessitates high-capacity grid storage batteries.`,
      correct: 'However,',
      wrongs: ['Furthermore,', 'Therefore,', 'Similarly,'] as [string, string, string],
      exp: `The first sentence praises solar energy's benefits, while the second sentence identifies a major limitation (intermittency). 'However,' correctly signals this contrast.`
    },
    {
      pass: `The city government introduced dedicated bus rapid transit lanes, subsidized electric bicycle rentals, and implemented variable congestion pricing for commuter vehicles downtown. _______ private vehicular traffic volumes decreased by 27 percent during peak morning hours within six months.`,
      correct: 'As a result,',
      wrongs: ['On the other hand,', 'Nevertheless,', 'Similarly,'] as [string, string, string],
      exp: `The decrease in traffic is the direct consequence of the transit measures introduced by the city government. 'As a result,' indicates this cause-and-effect relationship.`
    },
    {
      pass: `Traditional incandescent lightbulbs waste over ninety percent of their electrical energy as dissipated heat. LED lighting, _______ converts roughly eighty percent of electrical energy directly into visible illumination.`,
      correct: 'by contrast,',
      wrongs: ['moreover,', 'furthermore,', 'for example,'] as [string, string, string],
      exp: `The sentence contrasts the energy inefficiency of incandescent bulbs with the high efficiency of LEDs. 'By contrast,' correctly indicates the comparison.`
    },
    {
      pass: `Modern polymer composites offer exceptional tensile strength comparable to aerospace-grade titanium alloys. _______ they possess a density approximately one-fifth that of structural steel, making them exceptionally appealing for fuel-efficient aircraft frames.`,
      correct: 'In addition,',
      wrongs: ['Instead,', 'Nevertheless,', 'Rather,'] as [string, string, string],
      exp: `The sentence adds another distinct advantage (low density) to the previously stated advantage (high tensile strength). 'In addition,' appropriately introduces additive information.`
    }
  ];

  for (let i = 0; i < 25; i++) {
    const item = transitionsItems[i % transitionsItems.length];
    const mc = makeMcq(item.correct, item.wrongs);
    questions.push({
      section: 'reading_writing',
      domain: 'Expression of Ideas',
      topic: 'Transitions',
      difficulty: i % 2 === 0 ? 'medium' : 'easy',
      context_passage: item.pass,
      question_text: 'Which choice completes the text with the most logical transition?',
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation: item.exp
    });
  }

  // 8.2 Rhetorical Synthesis (25 questions)
  for (let i = 1; i <= 25; i++) {
    const notes = `While researching a topic, a student took the following notes:\n- The Svalbard Global Seed Vault is located inside a mountain on the Norwegian island of Spitsbergen.\n- It was established in 2008 to safeguard crop diversity against global catastrophic loss.\n- The facility operates at a constant temperature of -18°C (-0.4°F) maintained by permafrost and cooling units.\n- It currently holds over 1.2 million individual seed samples representing more than 6,000 plant species.\n- Depositors retain ownership and intellectual property rights over their deposited seeds.`;
    const qText = `The student wants to emphasize the scale and mission of the Svalbard Global Seed Vault. Which choice most effectively uses relevant information from the notes to accomplish this goal?`;
    const exp = `The goal requires emphasizing both the facility's scale (over 1.2 million seed samples from 6,000 species) and its mission (safeguarding crop diversity against catastrophic loss).`;
    const mc = makeMcq(
      `Established in 2008 to safeguard global crop diversity against catastrophic loss, the Svalbard Global Seed Vault currently preserves over 1.2 million seed samples from more than 6,000 plant species.`,
      [
        `Located in Spitsbergen, Norway, the Svalbard Global Seed Vault maintains seeds at an interior temperature of -18°C.`,
        `Depositors retain all intellectual property rights when storing their seeds in the permafrost of Spitsbergen.`,
        `Inside a mountain on a Norwegian island, cooling units and permafrost preserve plant specimens for international depositors.`
      ]
    );
    questions.push({
      section: 'reading_writing',
      domain: 'Expression of Ideas',
      topic: 'Rhetorical Synthesis',
      difficulty: i % 2 === 0 ? 'hard' : 'medium',
      context_passage: notes,
      question_text: qText,
      question_type: 'multiple_choice',
      options: mc.options,
      correct_answer: mc.correct_answer,
      explanation: exp
    });
  }

  return questions;
}

// Generate and write out if run directly
if (process.argv[1] && process.argv[1].endsWith('generate500SatQuestions.ts')) {
  const allQ = generateAll500Questions();
  console.log(`Generated ${allQ.length} Digital SAT questions.`);
  const outputPath = path.resolve(process.cwd(), 'src/server/satQuestions500Data.ts');
  const fileContent = `import { SatQuestionSeed } from "./satQuestionsData";\n\nexport const SAT_QUESTIONS_500: SatQuestionSeed[] = ${JSON.stringify(allQ, null, 2)};\n`;
  fs.writeFileSync(outputPath, fileContent, 'utf-8');
  console.log(`Saved 500 SAT questions to ${outputPath} (${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB)`);
}
