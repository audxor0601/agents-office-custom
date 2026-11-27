import * as THREE from 'three';
import { theme, Palette } from './Theme.js';

// Palette values live in Theme.ts; this turns the active theme's hex values into THREE.Color.
type ToColors<T> = { [K in keyof T]: T[K] extends number[] ? THREE.Color[] : THREE.Color };

export const Colors = Object.fromEntries(
  Object.entries(theme.colors).map(([k, v]) => [
    k,
    Array.isArray(v) ? v.map((h) => new THREE.Color(h)) : new THREE.Color(v),
  ])
) as ToColors<Palette>;
