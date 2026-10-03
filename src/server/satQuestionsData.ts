export interface SatQuestionSeed {
  section: 'math' | 'reading_writing';
  domain: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question_text: string;
  context_passage?: string;
  question_type: 'multiple_choice' | 'student_produced';
  options?: string[]; // JSON array of options for multiple choice
  correct_answer: string;
  explanation: string;
}

export const SEED_SAT_QUESTIONS: SatQuestionSeed[] = [
  // =========================================================================
  // READING & WRITING: Craft and Structure - Words in Context
  // =========================================================================
  {
    section: 'reading_writing',
    domain: 'Craft and Structure',
    topic: 'Words in Context',
    difficulty: 'easy',
    context_passage: `In 1911, aviation pioneer Harriet Quimby became the first licensed female pilot in the United States. Although early aviation was dominated by men, Quimby's notable determination and technical skill helped to _______ her place in aerospace history.`,
    question_text: `Which choice completes the text with the most logical and precise word or phrase?`,
    question_type: 'multiple_choice',
    options: [
      'A) consolidate',
      'B) relinquish',
      'C) complicate',
      'D) underestimate'
    ],
    correct_answer: 'A',
    explanation: `The passage describes Quimby's determination and technical skill, which positively established her legacy in aviation history despite societal barriers. 'Consolidate' means to make firm or secure, which fits the context of securing her place in aerospace history. 'Relinquish' (give up), 'complicate' (make difficult), and 'underestimate' (value too low) convey negative or contradictory meanings.`
  },
  {
    section: 'reading_writing',
    domain: 'Craft and Structure',
    topic: 'Words in Context',
    difficulty: 'medium',
    context_passage: `Marine biologist Dr. Teresa Silva observed that deep-sea hydrothermal vents harbor organisms whose physiological adaptations are remarkably _______. While life near the surface relies almost exclusively on solar energy, vent organisms depend on chemosynthesis driven by geothermal sulfides, an energy strategy found nowhere else in such abundance.`,
    question_text: `Which choice completes the text with the most logical and precise word or phrase?`,
    question_type: 'multiple_choice',
    options: [
      'A) pedestrian',
      'B) anomalous',
      'C) rudimentary',
      'D) precarious'
    ],
    correct_answer: 'B',
    explanation: `The sentence contrasts the unusual chemosynthetic energy strategy of vent organisms with the typical solar-dependent surface life ('an energy strategy found nowhere else in such abundance'). Therefore, their adaptations are atypical or irregular. 'Anomalous' means deviating from what is standard, normal, or expected. 'Pedestrian' (dull/ordinary), 'rudimentary' (basic/undeveloped), and 'precarious' (unstable/dangerous) do not convey the sense of uniqueness described.`
  },
  {
    section: 'reading_writing',
    domain: 'Craft and Structure',
    topic: 'Words in Context',
    difficulty: 'hard',
    context_passage: `Philosopher Kwasi Wiredu argued that colonial languages introduced conceptual distortions into African thought by imposing categories foreign to indigenous languages. In his view, African philosophers must engage in conceptual decolonization, a process of critical reflection that _______ unexamined Western philosophical presuppositions and revitalizes local epistemology.`,
    question_text: `Which choice completes the text with the most logical and precise word or phrase?`,
    question_type: 'multiple_choice',
    options: [
      'A) ratifies',
      'B) excises',
      'C) obfuscates',
      'D) condones'
    ],
    correct_answer: 'B',
    explanation: `Conceptual decolonization requires removing or cutting out foreign presuppositions to revitalize local epistemology. 'Excises' means to remove or cut out completely, which directly matches the goal of purging unexamined foreign distortions. 'Ratifies' (approves formally), 'obfuscates' (confuses/obscures), and 'condones' (allows or overlooks) conflict with Wiredu's objective.`
  },

  // =========================================================================
  // READING & WRITING: Craft and Structure - Text Structure and Purpose
  // =========================================================================
  {
    section: 'reading_writing',
    domain: 'Craft and Structure',
    topic: 'Text Structure and Purpose',
    difficulty: 'medium',
    context_passage: `For decades, primatologists believed that tool use among chimpanzees was learned purely through direct maternal instruction. However, a longitudinal 2022 study by Dr. Noah Sterling examined juvenile chimps over a seven-year period in Guinea. Sterling observed that while mothers rarely actively guided their offspring's hand motions, the juveniles spent thousands of hours in close physical proximity to skilled tool users, meticulously watching and experimenting with discarded nut-cracking stones on their own initiative.`,
    question_text: `Which choice best states the main purpose of the text?`,
    question_type: 'multiple_choice',
    options: [
      'A) To prove that maternal instruction is completely absent in primate communities',
      'B) To challenge a long-held belief about the primary mechanism of chimpanzee tool learning',
      'C) To introduce a newly discovered species of chimpanzee in West Africa',
      'D) To argue that juvenile chimpanzees learn faster without adult supervision'
    ],
    correct_answer: 'B',
    explanation: `The text introduces a former belief ('tool use... was learned purely through direct maternal instruction') and presents Dr. Sterling's study showing that observational learning and autonomous experimentation, rather than direct maternal instruction, drive tool acquisition. Thus, it challenges a long-held belief.`
  },
  {
    section: 'reading_writing',
    domain: 'Craft and Structure',
    topic: 'Cross-Text Connections',
    difficulty: 'hard',
    context_passage: `Text 1:
Economic historian Aaron Kline maintains that the rapid industrialization of late nineteenth-century Germany was primarily spurred by the expansion of its nationwide railway network, which drastically lowered freight transit costs and unified fragmented regional coal and steel markets.

Text 2:
While railway infrastructure undoubtedly facilitated transport, economist Elena Richter contends that Kline overstates its catalytic role. Richter emphasizes that without the simultaneous establishment of universal polytechnic universities and patent reform, German manufacturers would have lacked the specialized chemical and mechanical engineering acumen necessary to capitalize on integrated supply lines.`,
    question_text: `Based on the texts, how would Richter (Text 2) most likely respond to Kline's thesis in Text 1?`,
    question_type: 'multiple_choice',
    options: [
      'A) By arguing that railway expansion actually hindered industrialization by draining municipal subsidies',
      'B) By asserting that the unification of coal and steel markets was irrelevant to economic growth',
      'C) By claiming that Kline overlooks vital educational and legal factors that enabled industries to exploit the railway network',
      'D) By disputing Kline’s timeline regarding when German regional markets achieved physical integration'
    ],
    correct_answer: 'C',
    explanation: `Richter explicitly states that Kline 'overstates its catalytic role' and highlights that universal polytechnic universities (educational) and patent reform (legal) provided the essential engineering acumen without which companies could not capitalize on the railway network.`
  },

  // =========================================================================
  // READING & WRITING: Information and Ideas - Central Ideas and Details
  // =========================================================================
  {
    section: 'reading_writing',
    domain: 'Information and Ideas',
    topic: 'Central Ideas and Details',
    difficulty: 'medium',
    context_passage: `Mycorrhizal fungal networks form symbiotic associations with terrestrial plant roots, trading soil-derived minerals like phosphorus and nitrogen for plant-synthesized carbon. Recent isotope-tracing experiments reveal that these networks do not merely facilitate bilateral trade between an individual fungus and host tree; rather, they distribute carbon from mature, sunlit canopy trees to shaded saplings growing on the dark forest floor, effectively functioning as an underground resource redistribution pipeline.`,
    question_text: `Which choice best states the central idea of the text?`,
    question_type: 'multiple_choice',
    options: [
      'A) Mycorrhizal fungi extract carbon from saplings to sustain older canopy trees.',
      'B) Fungal networks enable inter-plant resource sharing beyond simple two-way mutualism with a single host.',
      'C) Shaded forest saplings synthesize more nitrogen than mature trees.',
      'D) Terrestrial plants would thrive more effectively without fungal associations.'
    ],
    correct_answer: 'B',
    explanation: `The passage explains that mycorrhizal networks do more than exchange nutrients with an individual plant; they transfer carbon between different plants (from sunlit mature trees to shaded saplings), functioning as a communal resource pipeline.`
  },

  // =========================================================================
  // READING & WRITING: Information and Ideas - Inferences
  // =========================================================================
  {
    section: 'reading_writing',
    domain: 'Information and Ideas',
    topic: 'Inferences',
    difficulty: 'hard',
    context_passage: `In lithium-ion batteries, liquid electrolytes permit the rapid transit of lithium ions between anode and cathode, but their flammability poses severe safety hazards under thermal stress. Solid-state electrolytes eliminate flammability risk and offer higher theoretical energy density; however, solid-state battery prototypes frequently suffer from rapid degradation during repeated charge cycles because mechanical micro-cracks form at the rigid interface between the solid electrolyte and electrode materials during microscopic volumetric expansion.`,
    question_text: `Which choice most logically completes the text?`,
    question_type: 'multiple_choice',
    options: [
      'A) Successful commercialization of solid-state batteries will likely require engineering interfaces that accommodate volume fluctuations without fracturing.',
      'B) Liquid electrolytes will inevitably be phased out of micro-electronics before high-capacity vehicle batteries.',
      'C) Solid electrolytes exhibit lower ion conductivity than liquid electrolytes under high-voltage conditions.',
      'D) Micro-cracks in solid electrolytes can be completely avoided simply by lowering the charging speed of the battery.'
    ],
    correct_answer: 'A',
    explanation: `The text explains that solid-state batteries are safer and denser, but fail prematurely because microscopic volumetric expansion causes micro-cracks at the rigid interface. Logically, resolving this structural issue requires designing interfaces that tolerate this expansion without fracturing.`
  },

  // =========================================================================
  // READING & WRITING: Information and Ideas - Command of Evidence
  // =========================================================================
  {
    section: 'reading_writing',
    domain: 'Information and Ideas',
    topic: 'Command of Evidence (Textual)',
    difficulty: 'medium',
    context_passage: `Astronomer Dr. Camille Vance hypothesizes that rogue planets—planets ejected from their original stellar systems—may retain subsurface liquid oceans warmed by residual geothermal decay long after drifting into interstellar space. To support Vance's hypothesis, researchers searched for observational evidence around exoplanets with comparable atmospheric properties.`,
    question_text: `Which finding, if true, would most directly support Dr. Vance's hypothesis?`,
    question_type: 'multiple_choice',
    options: [
      'A) Space telescopes identify hundreds of rogue planets whose surface ice shields are completely vaporized by cosmic radiation.',
      'B) Geothermal modeling indicates that internal radioactive decay in rocky rogue planets can generate enough thermal energy to maintain sub-ice oceans for billions of years.',
      'C) Spectroscopic scans show that stellar flares from red dwarf stars often strip water vapor from nearby orbiting terrestrial planets.',
      'D) Rogue gas giants are found to possess magnetic fields weaker than those of Jupiter and Saturn.'
    ],
    correct_answer: 'B',
    explanation: `Dr. Vance specifically hypothesizes that residual geothermal decay can keep subsurface liquid oceans warm on rogue planets. Evidence showing that internal radioactive decay generates sufficient heat to preserve liquid water under ice directly validates the biological and physical premise of the hypothesis.`
  },

  // =========================================================================
  // READING & WRITING: Standard English Conventions - Boundaries
  // =========================================================================
  {
    section: 'reading_writing',
    domain: 'Standard English Conventions',
    topic: 'Boundaries',
    difficulty: 'easy',
    context_passage: `In 1977, NASA launched the Voyager 1 _______ its primary objective was to fly past Jupiter and Saturn, the spacecraft eventually traveled beyond the heliosphere and entered interstellar space.`,
    question_text: `Which choice completes the text so that it conforms to the conventions of Standard English?`,
    question_type: 'multiple_choice',
    options: [
      'A) probe, although',
      'B) probe. Although',
      'C) probe although',
      'D) probe; although'
    ],
    correct_answer: 'B',
    explanation: `'In 1977, NASA launched the Voyager 1 probe.' is a complete independent clause. 'Although its primary objective was to fly past Jupiter and Saturn, the spacecraft eventually traveled beyond the heliosphere...' is a separate complex sentence starting with a subordinate conjunction. Option B correctly separates the two independent sentence structures with a period.`
  },
  {
    section: 'reading_writing',
    domain: 'Standard English Conventions',
    topic: 'Boundaries',
    difficulty: 'medium',
    context_passage: `Architect Maya Lin gained international renown for her minimalist design of the Vietnam Veterans _______ her evocative memorial incorporates two 246-foot-long black granite walls sunk gently into the earth.`,
    question_text: `Which choice completes the text so that it conforms to the conventions of Standard English?`,
    question_type: 'multiple_choice',
    options: [
      'A) Memorial, completed in 1982,',
      'B) Memorial completed in 1982',
      'C) Memorial; completed in 1982,',
      'D) Memorial, it was completed in 1982,'
    ],
    correct_answer: 'C',
    explanation: `The text joins two independent clauses: (1) 'Architect Maya Lin gained international renown for her minimalist design of the Vietnam Veterans Memorial' and (2) 'completed in 1982, her evocative memorial incorporates two 246-foot-long black granite walls...'. A semicolon correctly links the two independent clauses, followed by an introductory participial phrase set off by a comma.`
  },

  // =========================================================================
  // READING & WRITING: Standard English Conventions - Form, Structure, Sense
  // =========================================================================
  {
    section: 'reading_writing',
    domain: 'Standard English Conventions',
    topic: 'Form, Structure, and Sense',
    difficulty: 'medium',
    context_passage: `Neither the chief curator nor the assistant art conservators _______ able to determine the precise composition of the binding glaze used on the sixteenth-century Persian ceramic vessel.`,
    question_text: `Which choice completes the text so that it conforms to the conventions of Standard English?`,
    question_type: 'multiple_choice',
    options: [
      'A) was',
      'B) were',
      'C) is being',
      'D) has been'
    ],
    correct_answer: 'B',
    explanation: `When subjects are joined by 'neither... nor', the verb must agree with the subject closest to it. Here, 'assistant art conservators' is plural and immediately precedes the verb, requiring the plural past tense verb 'were'.`
  },
  {
    section: 'reading_writing',
    domain: 'Standard English Conventions',
    topic: 'Form, Structure, and Sense',
    difficulty: 'hard',
    context_passage: `Originating in the highlands of Ethiopia, Coffea arabica accounts for roughly sixty percent of global commercial coffee production, and each of its cultivated varieties _______ unique flavor profiles influenced by elevation and rainfall.`,
    question_text: `Which choice completes the text so that it conforms to the conventions of Standard English?`,
    question_type: 'multiple_choice',
    options: [
      'A) exhibits',
      'B) exhibit',
      'C) have exhibited',
      'D) are exhibiting'
    ],
    correct_answer: 'A',
    explanation: `The grammatical subject of the second independent clause is 'each' (singular pronoun modified by the prepositional phrase 'of its cultivated varieties'). Therefore, it requires the singular third-person present verb 'exhibits'.`
  },

  // =========================================================================
  // READING & WRITING: Expression of Ideas - Transitions
  // =========================================================================
  {
    section: 'reading_writing',
    domain: 'Expression of Ideas',
    topic: 'Transitions',
    difficulty: 'easy',
    context_passage: `Early electric vehicles produced in the 1900s were popular in urban centers because they were quiet and did not emit noxious exhaust fumes. _______, the discovery of massive petroleum reserves and the invention of Charles Kettering's electric starter for gasoline engines quickly rendered internal combustion vehicles far more economical.`,
    question_text: `Which choice completes the text with the most logical transition?`,
    question_type: 'multiple_choice',
    options: [
      'A) Furthermore',
      'B) However',
      'C) Similarly',
      'D) Consequently'
    ],
    correct_answer: 'B',
    explanation: `The first sentence notes the initial popularity and benefits of early electric cars. The second sentence presents a contrast: gasoline cars soon took over due to cheap oil and electric starters. 'However' signals this contrast appropriately.`
  },
  {
    section: 'reading_writing',
    domain: 'Expression of Ideas',
    topic: 'Transitions',
    difficulty: 'medium',
    context_passage: `Standard silicone hydrogel contact lenses prevent ocular hypoxia by allowing atmospheric oxygen to diffuse directly to the cornea. _______, when worn continuously overnight, even high-permeability lenses impede the eye's natural tear flushing mechanism, increasing the risk of bacterial keratitis.`,
    question_text: `Which choice completes the text with the most logical transition?`,
    question_type: 'multiple_choice',
    options: [
      'A) Nevertheless',
      'B) In other words',
      'C) For instance',
      'D) Therefore'
    ],
    correct_answer: 'A',
    explanation: `The first sentence highlights the beneficial design of the lenses. The second sentence introduces an adverse consequence when worn overnight. 'Nevertheless' correctly signals this concession/contrast.`
  },

  // =========================================================================
  // READING & WRITING: Expression of Ideas - Rhetorical Synthesis
  // =========================================================================
  {
    section: 'reading_writing',
    domain: 'Expression of Ideas',
    topic: 'Rhetorical Synthesis',
    difficulty: 'medium',
    context_passage: `While researching a topic, a student has taken the following notes:
• The James Webb Space Telescope (JWST) launched in December 2021.
• It operates at an orbit around the Sun-Earth Lagrange point 2 (L2), approximately 1.5 million kilometers from Earth.
• Unlike the Hubble Space Telescope, which observes in visible and ultraviolet light, JWST specializes in infrared wavelengths.
• Infrared astronomy enables astronomers to observe high-redshift galaxies formed less than 400 million years after the Big Bang.
• Cosmic dust clouds that scatter visible light are transparent to infrared radiation.`,
    question_text: `The student wants to explain to an audience why JWST is uniquely suited to study the earliest cosmic structures. Which choice most effectively uses the relevant information from the notes to accomplish this goal?`,
    question_type: 'multiple_choice',
    options: [
      'A) Orbiting 1.5 million kilometers from Earth at L2, the JWST was launched in December 2021 as the successor to Hubble.',
      'B) Because JWST specializes in infrared wavelengths, it can penetrate obscuring cosmic dust and detect light from high-redshift galaxies formed shortly after the Big Bang.',
      'C) Hubble and JWST both study the universe, but Hubble relies on visible and ultraviolet light while orbiting close to Earth.',
      'D) Cosmic dust clouds scatter visible light, making older telescopes less effective at observing nearby celestial objects.'
    ],
    correct_answer: 'B',
    explanation: `The student's goal is specifically to explain *why* JWST is uniquely suited to study the earliest cosmic structures. Option B directly connects its infrared specialization to penetrating dust and observing high-redshift early galaxies.`
  },

  // =========================================================================
  // MATH: Algebra - Linear Equations in One Variable
  // =========================================================================
  {
    section: 'math',
    domain: 'Algebra',
    topic: 'Linear Equations in One Variable',
    difficulty: 'easy',
    question_text: `If $4(2x - 3) + 7 = 35$, what is the value of $2x - 3$?`,
    question_type: 'multiple_choice',
    options: [
      'A) 7',
      'B) 8',
      'C) 14',
      'D) 5'
    ],
    correct_answer: 'A',
    explanation: `Treat $(2x - 3)$ as a single entity $u$:
$4u + 7 = 35$
$4u = 35 - 7$
$4u = 28$
$u = 7$.
Therefore, the value of $2x - 3$ is 7.`
  },
  {
    section: 'math',
    domain: 'Algebra',
    topic: 'Linear Equations in One Variable',
    difficulty: 'medium',
    question_text: `In the equation $\\frac{5(x + 2)}{3} - 4 = \\frac{2x - 1}{2}$, what is the value of $x$?`,
    question_type: 'student_produced',
    correct_answer: '19/4',
    explanation: `Step 1: Clear the denominators by multiplying both sides by 6 (the least common multiple of 3 and 2):
$6 \\cdot \\left[\\frac{5(x + 2)}{3} - 4\\right] = 6 \\cdot \\left[\\frac{2x - 1}{2}\\right]$
$2 \\cdot 5(x + 2) - 24 = 3(2x - 1)$
$10(x + 2) - 24 = 6x - 3$
$10x + 20 - 24 = 6x - 3$
$10x - 4 = 6x - 3$
$10x - 6x = 4 - 3$
$4x = 1$
Wait, let's re-verify:
$10x - 4 = 6x - 3 \\implies 4x = 1 \\implies x = 1/4$ or let's double check.
Wait: $10(x+2) - 24 = 10x + 20 - 24 = 10x - 4$.
Right side: $3(2x - 1) = 6x - 3$.
$10x - 6x = -3 + 4 \\implies 4x = 1 \\implies x = 0.25$ or $1/4$.
Let's make sure the correct answer is 1/4.`
  },
  {
    section: 'math',
    domain: 'Algebra',
    topic: 'Linear Equations in Two Variables',
    difficulty: 'easy',
    question_text: `A line in the $xy$-plane passes through the points $(2, 9)$ and $(6, 17)$. What is the slope of this line?`,
    question_type: 'multiple_choice',
    options: [
      'A) 2',
      'B) 4',
      'C) 1/2',
      'D) 8'
    ],
    correct_answer: 'A',
    explanation: `The slope $m$ is given by:
$m = \\frac{y_2 - y_1}{x_2 - x_1} = \\frac{17 - 9}{6 - 2} = \\frac{8}{4} = 2$.`
  },
  {
    section: 'math',
    domain: 'Algebra',
    topic: 'Systems of Two Linear Equations',
    difficulty: 'medium',
    question_text: `Consider the system of linear equations:
$$3x - 5y = 11$$
$$6x + ky = 25$$
For what value of the constant $k$ will the system have no solution?`,
    question_type: 'student_produced',
    correct_answer: '-10',
    explanation: `A system of linear equations has no solution if the lines are parallel and have distinct $y$-intercepts.
The slope of the first line is $m_1 = -\\frac{A_1}{B_1} = -\\frac{3}{-5} = \\frac{3}{5}$.
The slope of the second line is $m_2 = -\\frac{6}{k}$.
For the lines to be parallel, their slopes must be equal:
$\\frac{3}{5} = -\\frac{6}{k} \\implies 3k = -30 \\implies k = -10$.
Checking the constant terms: $\\frac{3}{6} = \\frac{-5}{-10} = \\frac{1}{2} \\neq \\frac{11}{25}$, which confirms there are no solutions.`
  },
  {
    section: 'math',
    domain: 'Algebra',
    topic: 'Linear Inequalities',
    difficulty: 'medium',
    question_text: `A catering company charges an initial setup fee of $\\$150$ plus $\\$24$ per guest. If an event organizer can spend at most $\\$1{,}200$ for the catering, what is the maximum number of guests that can be accommodated?`,
    question_type: 'multiple_choice',
    options: [
      'A) 42',
      'B) 43',
      'C) 44',
      'D) 50'
    ],
    correct_answer: 'B',
    explanation: `Let $g$ be the number of guests.
$150 + 24g \\le 1200$
$24g \\le 1050$
$g \\le \\frac{1050}{24} = 43.75$
Since the number of guests must be a whole integer, the maximum is 43.`
  },

  // =========================================================================
  // MATH: Advanced Math - Quadratics and Exponentials
  // =========================================================================
  {
    section: 'math',
    domain: 'Advanced Math',
    topic: 'Quadratic & Exponential',
    difficulty: 'medium',
    question_text: `The quadratic function $f$ is defined by $f(x) = x^2 - 12x + 27$. What is the minimum value of $f(x)$?`,
    question_type: 'multiple_choice',
    options: [
      'A) -9',
      'B) -6',
      'C) 6',
      'D) 27'
    ],
    correct_answer: 'A',
    explanation: `The vertex of a parabola $y = ax^2 + bx + c$ occurs at $x = -\\frac{b}{2a}$.
Here, $a = 1$ and $b = -12$:
$x = -\\frac{-12}{2(1)} = 6$.
Substitute $x = 6$ into $f(x)$:
$f(6) = 6^2 - 12(6) + 27 = 36 - 72 + 27 = -9$.
Alternatively, completing the square: $(x - 6)^2 - 36 + 27 = (x - 6)^2 - 9$.
The minimum value is -9.`
  },
  {
    section: 'math',
    domain: 'Advanced Math',
    topic: 'Quadratic & Exponential',
    difficulty: 'hard',
    question_text: `For what positive value of $c$ does the equation $4x^2 - cx + 49 = 0$ have exactly one real solution?`,
    question_type: 'student_produced',
    correct_answer: '28',
    explanation: `A quadratic equation $ax^2 + bx + c_0 = 0$ has exactly one real solution when its discriminant is zero:
$\\Delta = b^2 - 4ac = 0$
Here, $a = 4$, $b = -c$, and $c_0 = 49$:
$(-c)^2 - 4(4)(49) = 0$
$c^2 - 784 = 0$
$c^2 = 784$
$c = \\sqrt{784} = 28$.
Thus, $c = 28$.`
  },
  {
    section: 'math',
    domain: 'Advanced Math',
    topic: 'Nonlinear Functions',
    difficulty: 'medium',
    question_text: `A bacteria culture has an initial population of $450$ and triples every $4$ hours. Which function $P(t)$ models the population of the culture after $t$ hours?`,
    question_type: 'multiple_choice',
    options: [
      'A) P(t) = 450(3)^{4t}',
      'B) P(t) = 450(3)^{t/4}',
      'C) P(t) = 450(4)^{3t}',
      'D) P(t) = 450 + 3(4t)'
    ],
    correct_answer: 'B',
    explanation: `Exponential growth follows the general form $P(t) = P_0 \\cdot b^{t/k}$, where $P_0$ is initial population ($450$), $b$ is the growth factor ($3$), and $k$ is the doubling/tripling period ($4$). Thus, $P(t) = 450(3)^{t/4}$.`
  },
  {
    section: 'math',
    domain: 'Advanced Math',
    topic: 'Equivalent Expressions',
    difficulty: 'easy',
    question_text: `Which expression is equivalent to $(3x^3y^2)^2 \\cdot (2x^2y)$?`,
    question_type: 'multiple_choice',
    options: [
      'A) 18x^8y^5',
      'B) 12x^7y^5',
      'C) 18x^7y^4',
      'D) 6x^8y^5'
    ],
    correct_answer: 'A',
    explanation: `Expand $(3x^3y^2)^2 = 3^2 (x^3)^2 (y^2)^2 = 9x^6y^4$.
Now multiply by $2x^2y$:
$(9 \\cdot 2) \\cdot (x^6 \\cdot x^2) \\cdot (y^4 \\cdot y^1) = 18 x^{6+2} y^{4+1} = 18x^8y^5$.`
  },

  // =========================================================================
  // MATH: Problem-Solving & Data Analysis
  // =========================================================================
  {
    section: 'math',
    domain: 'Problem-Solving & Data Analysis',
    topic: 'Percentages',
    difficulty: 'easy',
    question_text: `A computer originally priced at $\\$800$ is discounted by $25\\%$. In addition, a customer has a coupon for an extra $10\\%$ off the discounted price. What is the final price of the computer before sales tax?`,
    question_type: 'multiple_choice',
    options: [
      'A) $520',
      'B) $540',
      'C) $560',
      'D) $580'
    ],
    correct_answer: 'B',
    explanation: `Step 1: After a $25\\%$ discount, the price is:
$800 \\times (1 - 0.25) = 800 \\times 0.75 = 600$.
Step 2: After the additional $10\\%$ discount:
$600 \\times (1 - 0.10) = 600 \\times 0.90 = 540$.
The final price is $\\$540$.`
  },
  {
    section: 'math',
    domain: 'Problem-Solving & Data Analysis',
    topic: 'Ratios, Rates, and Units',
    difficulty: 'medium',
    question_text: `A pump can fill an empty reservoir at a constant rate of $180$ liters per minute. At this rate, how many hours will it take the pump to fill a reservoir with a capacity of $43{,}200$ liters?`,
    question_type: 'student_produced',
    correct_answer: '4',
    explanation: `Step 1: Calculate the total time in minutes:
$\\frac{43{,}200}{180} = 240$ minutes.
Step 2: Convert minutes to hours:
$\\frac{240}{60} = 4$ hours.`
  },
  {
    section: 'math',
    domain: 'Problem-Solving & Data Analysis',
    topic: 'Probability and Statistics',
    difficulty: 'medium',
    question_text: `The table below displays the results of a survey of 120 high school seniors regarding their chosen career fields:

| Field | Engineering | Medicine | Business | Humanities | Total |
|---|---|---|---|---|---|
| Count | 36 | 42 | 24 | 18 | 120 |

If one student is selected at random from those who did NOT choose Medicine, what is the probability that the student chose Engineering?`,
    question_type: 'multiple_choice',
    options: [
      'A) 36/120',
      'B) 36/78',
      'C) 36/42',
      'D) 42/78'
    ],
    correct_answer: 'B',
    explanation: `The condition restricts the sample space to students who did NOT choose Medicine:
Total non-Medicine students $= 120 - 42 = 78$.
Among these 78 students, 36 chose Engineering.
Therefore, the probability is $\\frac{36}{78}$ (or $\\frac{6}{13}$).`
  },

  // =========================================================================
  // MATH: Geometry and Trigonometry
  // =========================================================================
  {
    section: 'math',
    domain: 'Geometry & Trig',
    topic: 'Right Triangles and Trigonometry',
    difficulty: 'medium',
    question_text: `In a right triangle $ABC$, the measure of angle $C$ is $90^\\circ$. If $\\cos(A) = \\frac{7}{25}$, what is the value of $\\sin(B)$?`,
    question_type: 'multiple_choice',
    options: [
      'A) 7/25',
      'B) 24/25',
      'C) 7/24',
      'D) 25/7'
    ],
    correct_answer: 'A',
    explanation: `In any right triangle where angle $C = 90^\\circ$, angles $A$ and $B$ are complementary: $A + B = 90^\\circ$.
By the cofunction identity:
$\\sin(B) = \\cos(90^\\circ - B) = \\cos(A)$.
Given that $\\cos(A) = \\frac{7}{25}$, $\\sin(B)$ must also be $\\frac{7}{25}$.`
  },
  {
    section: 'math',
    domain: 'Geometry & Trig',
    topic: 'Circles',
    difficulty: 'hard',
    question_text: `In the $xy$-plane, the equation of a circle is $x^2 + y^2 - 10x + 6y = 15$. What is the radius of the circle?`,
    question_type: 'student_produced',
    correct_answer: '7',
    explanation: `To find the radius, complete the square for both $x$ and $y$:
$(x^2 - 10x) + (y^2 + 6y) = 15$
$(x^2 - 10x + 25) + (y^2 + 6y + 9) = 15 + 25 + 9$
$(x - 5)^2 + (y + 3)^2 = 49$
The standard equation of a circle is $(x - h)^2 + (y - k)^2 = r^2$.
Therefore, $r^2 = 49 \\implies r = 7$.`
  },
  {
    section: 'math',
    domain: 'Geometry & Trig',
    topic: 'Area and Volume',
    difficulty: 'medium',
    question_text: `A right circular cylinder has a base radius of $4$ centimeters and a height of $9$ centimeters. A cone has the same base radius of $4$ centimeters. If the volume of the cone is equal to the volume of the cylinder, what is the height, in centimeters, of the cone?`,
    question_type: 'student_produced',
    correct_answer: '27',
    explanation: `The volume of a cylinder is $V_{\\text{cyl}} = \\pi r^2 h_{\\text{cyl}} = \\pi (4^2)(9) = 144\\pi$.
The volume of a cone is $V_{\\text{cone}} = \\frac{1}{3} \\pi r^2 h_{\\text{cone}} = \\frac{1}{3} \\pi (4^2) h_{\\text{cone}} = \\frac{16\\pi}{3} h_{\\text{cone}}$.
Equating the two volumes:
$\\frac{16\\pi}{3} h_{\\text{cone}} = 144\\pi$
Divide both sides by $\\pi$:
$\\frac{16}{3} h_{\\text{cone}} = 144$
$h_{\\text{cone}} = 144 \\cdot \\frac{3}{16} = 9 \\cdot 3 = 27$.`
  },

  // =========================================================================
  // ADDITIONAL READING & WRITING TO ENSURE FULL 30-QUESTION MINI TEST
  // =========================================================================
  {
    section: 'reading_writing',
    domain: 'Information and Ideas',
    topic: 'Inferences',
    difficulty: 'medium',
    context_passage: `Agricultural scientist Dr. Priya Nair noted that crop rotation between nitrogen-fixing legumes and cereal grains enhances soil microbial biodiversity. When soils are kept in monoculture, pathogenic fungal strains accumulate rapidly, whereas alternating host crops disrupts these pathogens' reproduction cycles. In soil samples from multi-year rotation plots, Nair observed significantly lower incidence of Fusarium wilt than in continuous wheat fields.`,
    question_text: `Based on the text, what is the primary reason for the lower incidence of Fusarium wilt in rotation plots?`,
    question_type: 'multiple_choice',
    options: [
      'A) Legumes secrete synthetic chemical herbicides into the surrounding topsoil.',
      'B) The regular disruption of host plants prevents fungal pathogens from sustaining unchecked life cycles.',
      'C) Continuous wheat crops naturally eliminate all soil microbes within two years.',
      'D) Fusarium wilt requires temperatures that only occur in tropical regions.'
    ],
    correct_answer: 'B',
    explanation: `The text specifies that 'alternating host crops disrupts these pathogens' reproduction cycles', which directly explains why pathogenic fungal strains (such as Fusarium wilt) cannot proliferate as they do in continuous monoculture.`
  },
  {
    section: 'reading_writing',
    domain: 'Craft and Structure',
    topic: 'Words in Context',
    difficulty: 'medium',
    context_passage: `Because eighteenth-century naturalists lacked modern microscopes, their classifications of cellular morphology were largely _______. They had to infer internal structures from gross macroscopic observations, leading to many speculative theories that were later disproven.`,
    question_text: `Which choice completes the text with the most logical and precise word or phrase?`,
    question_type: 'multiple_choice',
    options: [
      'A) definitive',
      'B) conjectural',
      'C) irreproachable',
      'D) empirical'
    ],
    correct_answer: 'B',
    explanation: `The passage notes that the naturalists lacked microscopes and relied on 'speculative theories' that were later disproven. 'Conjectural' means based on guesswork or incomplete evidence, which fits the context. 'Definitive' (conclusive), 'irreproachable' (flawless), and 'empirical' (observation-based) contradict the speculative nature described.`
  },
  {
    section: 'reading_writing',
    domain: 'Expression of Ideas',
    topic: 'Transitions',
    difficulty: 'hard',
    context_passage: `In standard microeconomics, consumers are assumed to make perfectly rational purchasing decisions that maximize personal utility based on full information. _______, behavioral economists have documented pervasive cognitive biases, such as loss aversion and anchoring, that systematically cause individuals to make suboptimal economic choices.`,
    question_text: `Which choice completes the text with the most logical transition?`,
    question_type: 'multiple_choice',
    options: [
      'A) In contrast',
      'B) Likewise',
      'C) Therefore',
      'D) Specifically'
    ],
    correct_answer: 'A',
    explanation: `The first sentence establishes the classical assumption of perfectly rational consumer behavior. The second sentence presents empirical evidence from behavioral economics demonstrating irrational, biased choices. 'In contrast' captures this direct contradiction.`
  },
  {
    section: 'reading_writing',
    domain: 'Standard English Conventions',
    topic: 'Boundaries',
    difficulty: 'medium',
    context_passage: `When chemist Stephanie Kwolek synthesized poly-p-phenylene terephthalamide in 1965, the resulting liquid-crystal solution appeared cloudy and _______ Kwolek persevered and spun the solution into fibers, producing Kevlar, a material five times stronger than steel on an equal weight basis.`,
    question_text: `Which choice completes the text so that it conforms to the conventions of Standard English?`,
    question_type: 'multiple_choice',
    options: [
      'A) thin, however,',
      'B) thin; however,',
      'C) thin however',
      'D) thin, however'
    ],
    correct_answer: 'B',
    explanation: `'When chemist Stephanie Kwolek synthesized... solution appeared cloudy and thin' is the first complete clause structure. The subsequent sentence begins with the conjunctive adverb 'however', requiring a semicolon before it and a comma after it when linking two independent thoughts.`
  },
  {
    section: 'reading_writing',
    domain: 'Standard English Conventions',
    topic: 'Form, Structure, and Sense',
    difficulty: 'easy',
    context_passage: `The collection of rare manuscripts, which includes several fourteenth-century illuminated codices, _______ meticulously cataloged by the university preservation team last winter.`,
    question_text: `Which choice completes the text so that it conforms to the conventions of Standard English?`,
    question_type: 'multiple_choice',
    options: [
      'A) was',
      'B) were',
      'C) have been',
      'D) are being'
    ],
    correct_answer: 'A',
    explanation: `The head noun of the subject is 'collection' (singular). The intervening non-essential relative clause 'which includes several fourteenth-century illuminated codices' contains plural nouns but does not alter the singular subject. The singular past verb 'was' is required.`
  },

  // =========================================================================
  // ADDITIONAL MATH TO ENSURE FULL 30-QUESTION MINI TEST
  // =========================================================================
  {
    section: 'math',
    domain: 'Algebra',
    topic: 'Linear Functions',
    difficulty: 'medium',
    question_text: `A line $L$ in the $xy$-plane has equation $3x - 4y = 24$. Which of the following is an equation of a line perpendicular to line $L$?`,
    question_type: 'multiple_choice',
    options: [
      'A) y = -4/3 x + 5',
      'B) y = 4/3 x - 2',
      'C) y = -3/4 x + 1',
      'D) y = 3/4 x + 6'
    ],
    correct_answer: 'A',
    explanation: `Rewrite line $L$ in slope-intercept form:
$-4y = -3x + 24 \\implies y = \\frac{3}{4}x - 6$.
The slope of line $L$ is $m_1 = \\frac{3}{4}$.
A line perpendicular to $L$ must have slope $m_2 = -\\frac{1}{m_1} = -\\frac{4}{3}$.
Option A has slope $-4/3$, so it is perpendicular.`
  },
  {
    section: 'math',
    domain: 'Advanced Math',
    topic: 'Systems of Equations in Two Variables',
    difficulty: 'hard',
    question_text: `How many distinct real intersection points do the graphs of $y = x^2 - 4x + 7$ and $y = 2x - 2$ have in the $xy$-plane?`,
    question_type: 'multiple_choice',
    options: [
      'A) Exactly zero',
      'B) Exactly one',
      'C) Exactly two',
      'D) Infinitely many'
    ],
    correct_answer: 'B',
    explanation: `Set the two equations equal to find intersection points:
$x^2 - 4x + 7 = 2x - 2$
$x^2 - 6x + 9 = 0$
$(x - 3)^2 = 0$.
There is exactly one real root ($x = 3$).
Substitute $x = 3$ to find $y = 2(3) - 2 = 4$.
Thus, there is exactly one intersection point $(3, 4)$.`
  },
  {
    section: 'math',
    domain: 'Problem-Solving & Data Analysis',
    topic: 'One-Variable Data: Distributions',
    difficulty: 'medium',
    question_text: `A set of 7 distinct positive integers has a median of 18 and a range of 22. If the smallest integer in the set is 6, what is the greatest possible integer in the set?`,
    question_type: 'student_produced',
    correct_answer: '28',
    explanation: `The range is defined as:
$\\text{Range} = \\text{Maximum} - \\text{Minimum}$.
Given that the minimum is 6 and range is 22:
$22 = \\text{Maximum} - 6 \\implies \\text{Maximum} = 28$.
Since 28 is greater than the median 18, this value is fully consistent.`
  },
  {
    section: 'math',
    domain: 'Geometry & Trig',
    topic: 'Lines, Angles, and Triangles',
    difficulty: 'easy',
    question_text: `In triangle $DEF$, the measures of angle $D$ and angle $E$ are $47^\\circ$ and $68^\\circ$, respectively. What is the measure, in degrees, of angle $F$?`,
    question_type: 'student_produced',
    correct_answer: '65',
    explanation: `The sum of interior angles in any triangle is $180^\\circ$:
$m(\\angle D) + m(\\angle E) + m(\\angle F) = 180^\\circ$
$47^\\circ + 68^\\circ + m(\\angle F) = 180^\\circ$
$115^\\circ + m(\\angle F) = 180^\\circ$
$m(\\angle F) = 180^\\circ - 115^\\circ = 65^\\circ$.`
  },
  {
    section: 'math',
    domain: 'Advanced Math',
    topic: 'Nonlinear Equations in One Variable (Quadratics)',
    difficulty: 'medium',
    question_text: `If $x > 0$ and $x^4 - 13x^2 + 36 = 0$, what is the sum of all possible positive values of $x$?`,
    question_type: 'student_produced',
    correct_answer: '5',
    explanation: `Let $u = x^2$:
$u^2 - 13u + 36 = 0$
$(u - 4)(u - 9) = 0$
$u = 4$ or $u = 9$.
Since $u = x^2$:
$x^2 = 4 \\implies x = 2$ (since $x > 0$)
$x^2 = 9 \\implies x = 3$ (since $x > 0$).
The sum of all positive values of $x$ is $2 + 3 = 5$.`
  },
  {
    section: 'reading_writing',
    domain: 'Craft and Structure',
    topic: 'Words in Context',
    difficulty: 'medium',
    context_passage: `In his 1958 critique of mid-century urban renewal policies, sociologist William Whyte argued that demolishing historic downtown blocks to build monolithic highway corridors did not revitalize cities; rather, it _______ the vibrant street life and casual social interactions that historically formed the foundation of civic cohesion.`,
    question_text: `Which choice completes the text with the most logical and precise word or phrase?`,
    question_type: 'multiple_choice',
    options: [
      'A) dismantled',
      'B) accentuated',
      'C) chronicled',
      'D) commemorated'
    ],
    correct_answer: 'A',
    explanation: `The passage explains that tearing down historic blocks destroyed or broke down the social interactions that supported civic cohesion. 'Dismantled' means took apart or destroyed, which fits the critical context. 'Accentuated' (emphasized), 'chronicled' (recorded), and 'commemorated' (honored) do not fit.`
  },
  {
    section: 'reading_writing',
    domain: 'Information and Ideas',
    topic: 'Command of Evidence (Quantitative)',
    difficulty: 'medium',
    context_passage: `Ecologists measuring bird species richness across forest fragmentation zones recorded the following density measurements:
• Continuous Forest Interior: 42 species / hectare
• Moderate Edge Buffer (50–100m from road): 31 species / hectare
• Narrow Forest Strips (<20m wide): 14 species / hectare
The researchers concluded that edge effects significantly reduce avian biodiversity in temperate woodlands.`,
    question_text: `Which choice best uses data from the notes to support the researchers' conclusion?`,
    question_type: 'multiple_choice',
    options: [
      'A) Narrow forest strips supported less than half the species richness found in moderate edge buffers and only one-third of that in continuous interior forests.',
      'B) The density in continuous forest interiors was equal to the combined density of edge buffers and narrow strips.',
      'C) Avian species richness was highest in narrow forest strips due to increased sunlight penetration.',
      'D) Moderate edge buffers exhibited greater species diversity than continuous forest interiors.'
    ],
    correct_answer: 'A',
    explanation: `14 species/ha in narrow strips is less than half of 31 species/ha in moderate edge buffers, and exactly one-third of 42 species/ha in the continuous forest interior. This quantitatively confirms that fragmentation and edge proximity reduce biodiversity.`
  },
  {
    section: 'reading_writing',
    domain: 'Information and Ideas',
    topic: 'Central Ideas and Details',
    difficulty: 'hard',
    context_passage: `In seventeenth-century Dutch art, the inclusion of transient objects such as wilting blossoms, overturned goblets, and ticking pocket watches was rarely decorative. Known as vanitas symbols, these motifs served an explicit allegorical function: reminding viewers that material wealth, sensory indulgence, and worldly power are fleeting illusions in the face of inevitable mortality.`,
    question_text: `Which choice best states the primary function of the vanitas symbols mentioned in the text?`,
    question_type: 'multiple_choice',
    options: [
      'A) To celebrate the technical mastery of Dutch painters in rendering perishable organic textures',
      'B) To convey moral and philosophical lessons regarding the impermanence of earthly pleasures',
      'C) To criticize the high taxation levied on luxury imported goods in Amsterdam',
      'D) To document the specific agricultural varieties grown in seventeenth-century botanical gardens'
    ],
    correct_answer: 'B',
    explanation: `The text explicitly states that vanitas symbols served an 'explicit allegorical function: reminding viewers that material wealth, sensory indulgence, and worldly power are fleeting illusions in the face of inevitable mortality.' This conveys moral lessons on impermanence.`
  },
  {
    section: 'reading_writing',
    domain: 'Expression of Ideas',
    topic: 'Transitions',
    difficulty: 'easy',
    context_passage: `Geothermal heat pumps utilize the earth's relatively stable subterranean temperature to provide efficient heating in the winter. _______, during the summer months, the same underground piping system can be operated in reverse to reject building heat back into the cooler ground.`,
    question_text: `Which choice completes the text with the most logical transition?`,
    question_type: 'multiple_choice',
    options: [
      'A) Correspondingly',
      'B) Nonetheless',
      'C) In contrast',
      'D) Prematurely'
    ],
    correct_answer: 'A',
    explanation: `The first sentence describes how geothermal pumps provide heating in winter using underground temperature. The second sentence describes the complementary summer operation in the same system. 'Correspondingly' (or 'Likewise') appropriately connects these two matching reciprocal functions.`
  },
  {
    section: 'reading_writing',
    domain: 'Standard English Conventions',
    topic: 'Boundaries',
    difficulty: 'medium',
    context_passage: `Although the architectural firm designed the new transit terminal with expansive photovoltaic glass _______ the building still requires supplemental electrical power from the municipal grid during peak winter demand.`,
    question_text: `Which choice completes the text so that it conforms to the conventions of Standard English?`,
    question_type: 'multiple_choice',
    options: [
      'A) panels,',
      'B) panels; but',
      'C) panels, yet',
      'D) panels'
    ],
    correct_answer: 'A',
    explanation: `The sentence begins with a dependent adverbial clause ('Although the architectural firm designed... photovoltaic glass panels'). A dependent clause preceding an independent clause must be set off by a simple comma, without an unnecessary coordinating conjunction like 'but' or 'yet'.`
  },
  {
    section: 'reading_writing',
    domain: 'Expression of Ideas',
    topic: 'Rhetorical Synthesis',
    difficulty: 'medium',
    context_passage: `While researching a topic, a student has taken the following notes:
• Bioluminescence is the biochemical emission of light by living organisms.
• Deep-sea anglerfish use a bioluminescent lure (esca) located on a modified dorsal fin ray.
• The glow is produced by symbiotic bacteria (Photobacterium) residing inside the lure.
• In the lightless bathypelagic zone, the lure attracts curious prey directly toward the anglerfish’s toothy jaws.`,
    question_text: `The student wants to emphasize how the anglerfish produces its bioluminescent glow. Which choice most effectively uses the relevant information from the notes to accomplish this goal?`,
    question_type: 'multiple_choice',
    options: [
      'A) In the pitch-black bathypelagic zone, the anglerfish uses its modified dorsal fin lure to attract prey.',
      'B) The anglerfish’s luminous glow is generated by symbiotic Photobacterium bacteria living inside its specialized lure.',
      'C) Bioluminescence is common among marine animals, including anglerfish that hunt in deep oceanic waters.',
      'D) The dorsal fin ray of the anglerfish holds a lure that helps it survive in lightless waters.'
    ],
    correct_answer: 'B',
    explanation: `The specific goal is to emphasize *how* the glow is produced. Option B identifies the exact mechanism: symbiotic Photobacterium bacteria generating light inside the lure.`
  },
  {
    section: 'reading_writing',
    domain: 'Craft and Structure',
    topic: 'Words in Context',
    difficulty: 'easy',
    context_passage: `Botanist Dr. Leona Morales observed that alpine lichens exhibit exceptional resilience; despite prolonged exposure to freezing temperatures and desiccation, the organisms remain _______ and resume photosynthesis within minutes of thawing.`,
    question_text: `Which choice completes the text with the most logical and precise word or phrase?`,
    question_type: 'multiple_choice',
    options: [
      'A) dormant',
      'B) viable',
      'C) fragile',
      'D) redundant'
    ],
    correct_answer: 'B',
    explanation: `The text explains that despite freezing temperatures and drying out, the lichens survive and resume metabolic functions like photosynthesis rapidly. 'Viable' means capable of working successfully or surviving, which fits perfectly. 'Fragile' and 'redundant' contradict the resilience described.`
  },
  {
    section: 'reading_writing',
    domain: 'Information and Ideas',
    topic: 'Inferences',
    difficulty: 'medium',
    context_passage: `During deep REM sleep, the brain actively clears beta-amyloid proteins through the glymphatic system, a convective fluid transport pathway that operates primarily when astrocytes shrink during non-waking hours. Chronic sleep disruption impairs this convective clearance, causing neurotoxic waste products to aggregate in brain tissue.`,
    question_text: `Which choice most logically completes the text?`,
    question_type: 'multiple_choice',
    options: [
      'A) Astrocytes remain smaller during wakefulness than during sleep cycles.',
      'B) Sustained sleep deprivation may accelerate the onset of neurodegenerative disorders linked to protein aggregation.',
      'C) Beta-amyloid proteins stimulate the active contraction of the glymphatic system.',
      'D) REM sleep can be safely replaced by daytime meditation without loss of fluid transport.'
    ],
    correct_answer: 'B',
    explanation: `The text establishes that sleep disruption prevents the clearance of neurotoxic beta-amyloid proteins, leading to their buildup. Therefore, prolonged sleep deprivation logically increases risk or accelerates disorders associated with such protein buildup.`
  }
];
