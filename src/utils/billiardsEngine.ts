/**
 * KapsPool: 8-Ball Billiards Physics & WPA Rules Engine
 * 2D Vector Math, Elastic Collisions, Cushion Reflections & Pocket Gravity
 */

export const TABLE_WIDTH = 900;
export const TABLE_HEIGHT = 450;
export const CUSHION_WIDTH = 38;

// Inner play boundary (center of balls will stay inside this area when bouncing off cushions)
export const PLAY_MIN_X = CUSHION_WIDTH + 12; // 50
export const PLAY_MAX_X = TABLE_WIDTH - CUSHION_WIDTH - 12; // 850
export const PLAY_MIN_Y = CUSHION_WIDTH + 12; // 50
export const PLAY_MAX_Y = TABLE_HEIGHT - CUSHION_WIDTH - 12; // 400

export const BALL_RADIUS = 12;
export const BALL_MASS = 1;
export const FRICTION = 0.985;
export const RESTITUTION_CUSHION = 0.92;
export const VELOCITY_STOP_THRESHOLD = 0.05;

export interface Vector2D {
  x: number;
  y: number;
}

export type BallGroupType = 'solids' | 'stripes';

export interface Ball {
  id: number; // 0 = cue ball, 1-7 = solids, 8 = 8-ball, 9-15 = stripes
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  number: number;
  type: 'cue' | 'solid' | 'stripe' | '8ball';
  isPocketed: boolean;
  fallAnimation: number; // 0 to 1 as it falls into pocket
}

export interface Pocket {
  id: number;
  x: number;
  y: number;
  radius: number;
}

// 6 Pockets Coordinates (4 corners + 2 center)
export const POCKETS: Pocket[] = [
  { id: 0, x: CUSHION_WIDTH + 4, y: CUSHION_WIDTH + 4, radius: 24 }, // Top-Left
  { id: 1, x: TABLE_WIDTH / 2, y: CUSHION_WIDTH - 2, radius: 22 }, // Top-Center
  { id: 2, x: TABLE_WIDTH - CUSHION_WIDTH - 4, y: CUSHION_WIDTH + 4, radius: 24 }, // Top-Right
  { id: 3, x: CUSHION_WIDTH + 4, y: TABLE_HEIGHT - CUSHION_WIDTH - 4, radius: 24 }, // Bottom-Left
  { id: 4, x: TABLE_WIDTH / 2, y: TABLE_HEIGHT - CUSHION_WIDTH + 2, radius: 22 }, // Bottom-Center
  { id: 5, x: TABLE_WIDTH - CUSHION_WIDTH - 4, y: TABLE_HEIGHT - CUSHION_WIDTH - 4, radius: 24 } // Bottom-Right
];

// Color definitions for official 8-Ball pool
export const BALL_COLORS: Record<number, string> = {
  0: '#FFFFFF', // Cue Ball
  1: '#FBBF24', // 1: Yellow Solid
  2: '#2563EB', // 2: Blue Solid
  3: '#DC2626', // 3: Red Solid
  4: '#7C3AED', // 4: Purple Solid
  5: '#EA580C', // 5: Orange Solid
  6: '#16A34A', // 6: Green Solid
  7: '#881337', // 7: Maroon Solid
  8: '#111827', // 8: 8-Ball Black
  9: '#FBBF24', // 9: Yellow Stripe
  10: '#2563EB', // 10: Blue Stripe
  11: '#DC2626', // 11: Red Stripe
  12: '#7C3AED', // 12: Purple Stripe
  13: '#EA580C', // 13: Orange Stripe
  14: '#16A34A', // 14: Green Stripe
  15: '#881337' // 15: Maroon Stripe
};

export function getBallType(ballNum: number): 'cue' | 'solid' | 'stripe' | '8ball' {
  if (ballNum === 0) return 'cue';
  if (ballNum === 8) return '8ball';
  if (ballNum >= 1 && ballNum <= 7) return 'solid';
  return 'stripe';
}

/**
 * Creates the initial 16 balls with standard triangle rack layout
 */
export function createInitialBalls(): Ball[] {
  const balls: Ball[] = [];

  // 0: Cue ball positioned at head string
  balls.push({
    id: 0,
    number: 0,
    type: 'cue',
    x: 230,
    y: TABLE_HEIGHT / 2,
    vx: 0,
    vy: 0,
    radius: BALL_RADIUS,
    color: BALL_COLORS[0],
    isPocketed: false,
    fallAnimation: 0
  });

  // Standard 8-Ball triangle pattern (5 rows)
  // Apex at x = 650, y = TABLE_HEIGHT / 2
  const apexX = 650;
  const apexY = TABLE_HEIGHT / 2;
  const rowDist = (BALL_RADIUS * 2 + 0.5) * Math.cos(Math.PI / 6); // ~21.2px
  const ballDist = BALL_RADIUS * 2 + 0.5; // ~24.5px

  // Row assignments for a balanced standard rack:
  // Row 1 (1 ball): Solid (e.g. 1)
  // Row 2 (2 balls): Stripe (9), Solid (2)
  // Row 3 (3 balls): Solid (3), 8-BALL in middle (8), Stripe (10)
  // Row 4 (4 balls): Stripe (11), Solid (4), Stripe (12), Solid (5)
  // Row 5 (5 balls): Solid (6), Stripe (13), Solid (7), Stripe (14), Stripe (15) - opposite bottom corners
  const rackPattern: number[][] = [
    [1],
    [9, 2],
    [3, 8, 10],
    [11, 4, 12, 5],
    [6, 13, 7, 14, 15]
  ];

  rackPattern.forEach((row, rIdx) => {
    const rx = apexX + rIdx * rowDist;
    const startY = apexY - ((row.length - 1) * ballDist) / 2;

    row.forEach((num, cIdx) => {
      const ry = startY + cIdx * ballDist;
      balls.push({
        id: num,
        number: num,
        type: getBallType(num),
        x: rx,
        y: ry,
        vx: 0,
        vy: 0,
        radius: BALL_RADIUS,
        color: BALL_COLORS[num],
        isPocketed: false,
        fallAnimation: 0
      });
    });
  });

  return balls;
}

/**
 * 2D Vector operations
 */
export function dot(v1: Vector2D, v2: Vector2D): number {
  return v1.x * v2.x + v1.y * v2.y;
}

export function distSq(p1: Vector2D, p2: Vector2D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return dx * dx + dy * dy;
}

export function dist(p1: Vector2D, p2: Vector2D): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

export interface CollisionEvent {
  type: 'ball_hit' | 'cushion_hit' | 'pocket_drop';
  ball1?: Ball;
  ball2?: Ball;
  speed?: number;
}

export interface StepPhysicsResult {
  events: CollisionEvent[];
  allStopped: boolean;
  firstContactBall: Ball | null;
  cushionHitAfterContact: boolean;
  pocketedThisTick: number[];
}

/**
 * Advances physics simulation by 1 tick (sub-stepping for high precision)
 */
export function stepPhysics(
  balls: Ball[],
  firstContactRef: { current: Ball | null },
  cushionHitRef: { current: boolean }
): { events: CollisionEvent[]; allStopped: boolean; pocketedThisTick: number[] } {
  const events: CollisionEvent[] = [];
  const pocketedThisTick: number[] = [];

  const subSteps = 4;
  for (let step = 0; step < subSteps; step++) {
    // 1. Move balls & apply friction
    balls.forEach((b) => {
      if (b.isPocketed) return;

      if (b.fallAnimation > 0) {
        // Falling into pocket animation
        b.fallAnimation += 0.08 / subSteps;
        b.radius = Math.max(2, BALL_RADIUS * (1 - b.fallAnimation));
        b.vx *= 0.85;
        b.vy *= 0.85;
        b.x += b.vx / subSteps;
        b.y += b.vy / subSteps;
        if (b.fallAnimation >= 1) {
          b.isPocketed = true;
          b.radius = BALL_RADIUS;
          b.vx = 0;
          b.vy = 0;
        }
        return;
      }

      b.x += b.vx / subSteps;
      b.y += b.vy / subSteps;

      // Friction
      const f = Math.pow(FRICTION, 1 / subSteps);
      b.vx *= f;
      b.vy *= f;

      if (Math.hypot(b.vx, b.vy) < VELOCITY_STOP_THRESHOLD) {
        b.vx = 0;
        b.vy = 0;
      }
    });

    // 2. Pocket attraction & entry
    balls.forEach((b) => {
      if (b.isPocketed || b.fallAnimation > 0) return;

      for (const pocket of POCKETS) {
        const d = dist(b, pocket);
        if (d < pocket.radius + 6) {
          // Attract toward pocket center
          const pull = 0.18;
          b.vx += (pocket.x - b.x) * pull;
          b.vy += (pocket.y - b.y) * pull;

          if (d < pocket.radius - 2) {
            b.fallAnimation = 0.05;
            pocketedThisTick.push(b.number);
            events.push({ type: 'pocket_drop', ball1: b });
            break;
          }
        }
      }
    });

    // 3. Cushion collisions (with gaps for pockets)
    balls.forEach((b) => {
      if (b.isPocketed || b.fallAnimation > 0) return;

      let hitCushion = false;
      const r = b.radius;

      // Top Cushion segments (Left: 60..425, Right: 475..840)
      if (b.y - r < PLAY_MIN_Y) {
        const inLeftTop = b.x >= 64 && b.x <= 425;
        const inRightTop = b.x >= 475 && b.x <= 836;
        if (inLeftTop || inRightTop) {
          b.y = PLAY_MIN_Y + r;
          b.vy = Math.abs(b.vy) * RESTITUTION_CUSHION;
          hitCushion = true;
        }
      }

      // Bottom Cushion segments (Left: 60..425, Right: 475..840)
      if (b.y + r > PLAY_MAX_Y) {
        const inLeftBottom = b.x >= 64 && b.x <= 425;
        const inRightBottom = b.x >= 475 && b.x <= 836;
        if (inLeftBottom || inRightBottom) {
          b.y = PLAY_MAX_Y - r;
          b.vy = -Math.abs(b.vy) * RESTITUTION_CUSHION;
          hitCushion = true;
        }
      }

      // Left Cushion (y: 64..386)
      if (b.x - r < PLAY_MIN_X) {
        if (b.y >= 64 && b.y <= 386) {
          b.x = PLAY_MIN_X + r;
          b.vx = Math.abs(b.vx) * RESTITUTION_CUSHION;
          hitCushion = true;
        }
      }

      // Right Cushion (y: 64..386)
      if (b.x + r > PLAY_MAX_X) {
        if (b.y >= 64 && b.y <= 386) {
          b.x = PLAY_MAX_X - r;
          b.vx = -Math.abs(b.vx) * RESTITUTION_CUSHION;
          hitCushion = true;
        }
      }

      if (hitCushion) {
        events.push({ type: 'cushion_hit', ball1: b, speed: Math.hypot(b.vx, b.vy) });
        if (firstContactRef.current !== null) {
          cushionHitRef.current = true;
        }
      }
    });

    // 4. Ball-to-Ball Elastic Collisions
    for (let i = 0; i < balls.length; i++) {
      const b1 = balls[i];
      if (b1.isPocketed || b1.fallAnimation > 0) continue;

      for (let j = i + 1; j < balls.length; j++) {
        const b2 = balls[j];
        if (b2.isPocketed || b2.fallAnimation > 0) continue;

        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const d = Math.hypot(dx, dy);
        const minDist = b1.radius + b2.radius;

        if (d < minDist && d > 0.0001) {
          // Positional overlap resolution
          const overlap = minDist - d;
          const nx = dx / d;
          const ny = dy / d;

          b1.x -= nx * (overlap * 0.5);
          b1.y -= ny * (overlap * 0.5);
          b2.x += nx * (overlap * 0.5);
          b2.y += ny * (overlap * 0.5);

          // Normal and tangent relative velocity
          const dvx = b1.vx - b2.vx;
          const dvy = b1.vy - b2.vy;
          const velAlongNormal = dvx * nx + dvy * ny;

          // Only collide if moving towards each other
          if (velAlongNormal > 0) {
            // Elastic collision formula for equal masses:
            // v1' = v1 - (v1-v2 . n) * n
            // v2' = v2 + (v1-v2 . n) * n
            b1.vx -= velAlongNormal * nx;
            b1.vy -= velAlongNormal * ny;
            b2.vx += velAlongNormal * nx;
            b2.vy += velAlongNormal * ny;

            const impactSpeed = Math.abs(velAlongNormal);
            events.push({ type: 'ball_hit', ball1: b1, ball2: b2, speed: impactSpeed });

            // Record first contact of cue ball
            if ((b1.id === 0 || b2.id === 0) && firstContactRef.current === null) {
              firstContactRef.current = b1.id === 0 ? b2 : b1;
            }
          }
        }
      }
    }
  }

  // Check if all balls stopped moving
  const allStopped = balls.every(
    (b) => b.isPocketed || (Math.hypot(b.vx, b.vy) < 0.02 && b.fallAnimation === 0)
  );

  return { events, allStopped, pocketedThisTick };
}

/**
 * Aiming line & trajectory prediction
 */
export interface AimTrajectory {
  cueBallStart: Vector2D;
  cueBallTarget: Vector2D;
  hitBall: Ball | null;
  targetBallTrajectory: Vector2D | null;
  cueBallDeflection: Vector2D | null;
  cushionReflectionPoint: Vector2D | null;
}

export function calculateAimTrajectory(
  cueBall: Ball,
  aimAngle: number,
  allBalls: Ball[]
): AimTrajectory {
  const dirX = Math.cos(aimAngle);
  const dirY = Math.sin(aimAngle);

  let closestHitDist = Infinity;
  let closestBall: Ball | null = null;
  let cueContactPoint: Vector2D = { x: cueBall.x + dirX * 1000, y: cueBall.y + dirY * 1000 };

  // 1. Ray-Circle Intersection with other balls
  allBalls.forEach((b) => {
    if (b.id === 0 || b.isPocketed || b.fallAnimation > 0) return;

    const toBx = b.x - cueBall.x;
    const toBy = b.y - cueBall.y;
    const proj = toBx * dirX + toBy * dirY;

    if (proj > 0) {
      const closestPointX = cueBall.x + dirX * proj;
      const closestPointY = cueBall.y + dirY * proj;
      const dSq = distSq(b, { x: closestPointX, y: closestPointY });
      const maxDist = (BALL_RADIUS + b.radius) * 0.99;

      if (dSq < maxDist * maxDist) {
        const offset = Math.sqrt(maxDist * maxDist - dSq);
        const hitDist = proj - offset;
        if (hitDist > 0 && hitDist < closestHitDist) {
          closestHitDist = hitDist;
          closestBall = b;
          cueContactPoint = {
            x: cueBall.x + dirX * hitDist,
            y: cueBall.y + dirY * hitDist
          };
        }
      }
    }
  });

  if (closestBall) {
    // Contact normal from cue contact position to target ball center
    const hitNormalX = (closestBall as Ball).x - cueContactPoint.x;
    const hitNormalY = (closestBall as Ball).y - cueContactPoint.y;
    const hitLen = Math.hypot(hitNormalX, hitNormalY) || 1;
    const normX = hitNormalX / hitLen;
    const normY = hitNormalY / hitLen;

    // Target ball projected direction
    const targetLineEnd: Vector2D = {
      x: (closestBall as Ball).x + normX * 110,
      y: (closestBall as Ball).y + normY * 110
    };

    // Cue ball deflection (perpendicular tangent)
    const dotNorm = dirX * normX + dirY * normY;
    const tanX = dirX - normX * dotNorm;
    const tanY = dirY - normY * dotNorm;
    const tanLen = Math.hypot(tanX, tanY) || 1;

    const cueDeflectionEnd: Vector2D = {
      x: cueContactPoint.x + (tanX / tanLen) * 70,
      y: cueContactPoint.y + (tanY / tanLen) * 70
    };

    return {
      cueBallStart: { x: cueBall.x, y: cueBall.y },
      cueBallTarget: cueContactPoint,
      hitBall: closestBall,
      targetBallTrajectory: targetLineEnd,
      cueBallDeflection: cueDeflectionEnd,
      cushionReflectionPoint: null
    };
  }

  // 2. If no ball is hit, trace ray to the closest cushion
  let rayDistToCushion = 1000;
  let bounceReflect: Vector2D | null = null;

  if (dirX > 0) {
    const t = (PLAY_MAX_X - cueBall.x) / dirX;
    if (t > 0 && t < rayDistToCushion) {
      rayDistToCushion = t;
      cueContactPoint = { x: PLAY_MAX_X, y: cueBall.y + dirY * t };
      bounceReflect = { x: PLAY_MAX_X - dirX * 60, y: cueBall.y + dirY * t + dirY * 60 };
    }
  } else if (dirX < 0) {
    const t = (PLAY_MIN_X - cueBall.x) / dirX;
    if (t > 0 && t < rayDistToCushion) {
      rayDistToCushion = t;
      cueContactPoint = { x: PLAY_MIN_X, y: cueBall.y + dirY * t };
      bounceReflect = { x: PLAY_MIN_X - dirX * 60, y: cueBall.y + dirY * t + dirY * 60 };
    }
  }

  if (dirY > 0) {
    const t = (PLAY_MAX_Y - cueBall.y) / dirY;
    if (t > 0 && t < rayDistToCushion) {
      rayDistToCushion = t;
      cueContactPoint = { x: cueBall.x + dirX * t, y: PLAY_MAX_Y };
      bounceReflect = { x: cueBall.x + dirX * t + dirX * 60, y: PLAY_MAX_Y - dirY * 60 };
    }
  } else if (dirY < 0) {
    const t = (PLAY_MIN_Y - cueBall.y) / dirY;
    if (t > 0 && t < rayDistToCushion) {
      rayDistToCushion = t;
      cueContactPoint = { x: cueBall.x + dirX * t, y: PLAY_MIN_Y };
      bounceReflect = { x: cueBall.x + dirX * t + dirX * 60, y: PLAY_MIN_Y - dirY * 60 };
    }
  }

  return {
    cueBallStart: { x: cueBall.x, y: cueBall.y },
    cueBallTarget: cueContactPoint,
    hitBall: null,
    targetBallTrajectory: null,
    cueBallDeflection: null,
    cushionReflectionPoint: bounceReflect
  };
}

/**
 * Strict WPA 8-Ball Rules Evaluation
 */
export interface ShotResultContext {
  shooterId: number;
  shooterAssignedGroup: BallGroupType | null;
  firstContactBall: Ball | null;
  cushionHitAfterContact: boolean;
  pocketedBallsThisShot: number[];
  allBalls: Ball[];
  isBreakShot: boolean;
}

export interface ShotEvaluation {
  isFoul: boolean;
  foulReason: string | null;
  keepTurn: boolean; // True if extra shot granted
  assignedGroupUpdate: { [userId: number]: BallGroupType } | null;
  gameWinner: number | null; // User ID of winner
  gameLoser: number | null;
  cueBallInHand: boolean;
  gameStatusUpdate: 'playing' | 'finished';
}

export function evaluateWpa8BallRules(
  ctx: ShotResultContext,
  opponentId: number
): ShotEvaluation {
  const {
    shooterId,
    shooterAssignedGroup,
    firstContactBall,
    cushionHitAfterContact,
    pocketedBallsThisShot,
    allBalls,
    isBreakShot
  } = ctx;

  const isScratch = pocketedBallsThisShot.includes(0);
  const isEightBallPocketed = pocketedBallsThisShot.includes(8);
  const pocketedSolids = pocketedBallsThisShot.filter((n) => n >= 1 && n <= 7);
  const pocketedStripes = pocketedBallsThisShot.filter((n) => n >= 9 && n <= 15);

  // Remaining balls on table for each group
  const remainingSolids = allBalls.filter((b) => b.type === 'solid' && !b.isPocketed).length;
  const remainingStripes = allBalls.filter((b) => b.type === 'stripe' && !b.isPocketed).length;

  let shooterGroup = shooterAssignedGroup;
  let assignedGroupUpdate: { [userId: number]: BallGroupType } | null = null;

  // 1. Check if 8-Ball was pocketed
  if (isEightBallPocketed) {
    if (isBreakShot && !isScratch) {
      // 8-ball on break without scratch = Instant Break Win in casual WPA rules
      return {
        isFoul: false,
        foulReason: null,
        keepTurn: false,
        assignedGroupUpdate: null,
        gameWinner: shooterId,
        gameLoser: opponentId,
        cueBallInHand: false,
        gameStatusUpdate: 'finished'
      };
    }

    if (isScratch) {
      // Scratching while pocketing 8-ball = Instant Loss!
      return {
        isFoul: true,
        foulReason: 'Siyah top sokulurken beyaz top cebe girdi! (Hükmen Mağlubiyet)',
        keepTurn: false,
        assignedGroupUpdate: null,
        gameWinner: opponentId,
        gameLoser: shooterId,
        cueBallInHand: false,
        gameStatusUpdate: 'finished'
      };
    }

    const shooterRemainingGroupBalls =
      shooterGroup === 'solids'
        ? remainingSolids
        : shooterGroup === 'stripes'
        ? remainingStripes
        : 7;

    if (shooterRemainingGroupBalls > 0 || shooterGroup === null) {
      // Premature 8-ball pocketing = Instant Loss!
      return {
        isFoul: true,
        foulReason: 'Tüm grup topları bitmeden 8 numaralı siyah top sokuldu! (Hükmen Mağlubiyet)',
        keepTurn: false,
        assignedGroupUpdate: null,
        gameWinner: opponentId,
        gameLoser: shooterId,
        cueBallInHand: false,
        gameStatusUpdate: 'finished'
      };
    }

    // Legal 8-Ball pocketing when own group is cleared!
    return {
      isFoul: false,
      foulReason: null,
      keepTurn: false,
      assignedGroupUpdate: null,
      gameWinner: shooterId,
      gameLoser: opponentId,
      cueBallInHand: false,
      gameStatusUpdate: 'finished'
    };
  }

  // 2. Check Scratch
  if (isScratch) {
    return {
      isFoul: true,
      foulReason: 'Beyaz top cebe girdi (Scratch Faulü)! Sıra rakipte, top serbest.',
      keepTurn: false,
      assignedGroupUpdate: null,
      gameWinner: null,
      gameLoser: null,
      cueBallInHand: true,
      gameStatusUpdate: 'playing'
    };
  }

  // 3. Check No Ball Contact
  if (!firstContactBall) {
    return {
      isFoul: true,
      foulReason: 'Beyaz top hiçbir topa temas etmedi! Faul.',
      keepTurn: false,
      assignedGroupUpdate: null,
      gameWinner: null,
      gameLoser: null,
      cueBallInHand: true,
      gameStatusUpdate: 'playing'
    };
  }

  // 4. Check Group Contact (Wrong ball first contact)
  if (shooterGroup !== null) {
    const shooterRemaining = shooterGroup === 'solids' ? remainingSolids : remainingStripes;

    if (shooterRemaining > 0) {
      // Must hit own group ball first
      if (firstContactBall.type !== (shooterGroup === 'solids' ? 'solid' : 'stripe')) {
        return {
          isFoul: true,
          foulReason: `Faul: İlk temas kendi grubunuza ait bir topa yapılmadı (${shooterGroup === 'solids' ? 'Düz' : 'Çizgili'} vurulmalıydı)!`,
          keepTurn: false,
          assignedGroupUpdate: null,
          gameWinner: null,
          gameLoser: null,
          cueBallInHand: true,
          gameStatusUpdate: 'playing'
        };
      }
    } else {
      // Own group is finished, must hit 8-ball first
      if (firstContactBall.type !== '8ball') {
        return {
          isFoul: true,
          foulReason: 'Faul: Grubunuz bittiği için ilk temas 8 numaralı siyah topa yapılmalıydı!',
          keepTurn: false,
          assignedGroupUpdate: null,
          gameWinner: null,
          gameLoser: null,
          cueBallInHand: true,
          gameStatusUpdate: 'playing'
        };
      }
    }
  } else {
    // Open table: cannot hit 8-ball first
    if (firstContactBall.type === '8ball') {
      return {
        isFoul: true,
        foulReason: 'Faul: Masa henüz açıkken ilk temas 8 numaralı siyah topa yapılamaz!',
        keepTurn: false,
        assignedGroupUpdate: null,
        gameWinner: null,
        gameLoser: null,
        cueBallInHand: true,
        gameStatusUpdate: 'playing'
      };
    }
  }

  // 5. Cushion contact rule: At least one ball must touch a cushion or be pocketed
  const anyPocketed = pocketedBallsThisShot.length > 0;
  if (!anyPocketed && !cushionHitAfterContact) {
    return {
      isFoul: true,
      foulReason: 'Faul: Temastan sonra hiçbir top banta çarpmadı veya cebe girmedi!',
      keepTurn: false,
      assignedGroupUpdate: null,
      gameWinner: null,
      gameLoser: null,
      cueBallInHand: true,
      gameStatusUpdate: 'playing'
    };
  }

  // 6. Group Assignment (First legally pocketed ball)
  if (shooterGroup === null && !isBreakShot) {
    if (pocketedSolids.length > 0 && pocketedStripes.length === 0) {
      shooterGroup = 'solids';
      assignedGroupUpdate = {
        [shooterId]: 'solids',
        [opponentId]: 'stripes'
      };
    } else if (pocketedStripes.length > 0 && pocketedSolids.length === 0) {
      shooterGroup = 'stripes';
      assignedGroupUpdate = {
        [shooterId]: 'stripes',
        [opponentId]: 'solids'
      };
    }
  }

  // 7. Determine turn continuation
  let keepTurn = false;
  if (shooterGroup === 'solids') {
    keepTurn = pocketedSolids.length > 0;
  } else if (shooterGroup === 'stripes') {
    keepTurn = pocketedStripes.length > 0;
  } else {
    // Open table break or open shot
    keepTurn = anyPocketed;
  }

  return {
    isFoul: false,
    foulReason: null,
    keepTurn,
    assignedGroupUpdate,
    gameWinner: null,
    gameLoser: null,
    cueBallInHand: false,
    gameStatusUpdate: 'playing'
  };
}
