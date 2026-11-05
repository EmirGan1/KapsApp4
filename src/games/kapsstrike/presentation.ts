export const GRAPHICS: Record<string, any> = {
  high: { shadows: true, bloom: true, fov: 75, particles: true },
  medium: { shadows: true, bloom: false, fov: 75, particles: false },
  low: { shadows: false, bloom: false, fov: 75, particles: false }
};

export const knifeTiming: any = {
  deploy: 0.5,
  inspect: 1.2
};
