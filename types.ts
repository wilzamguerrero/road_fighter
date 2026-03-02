export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export enum EntityType {
  PLAYER = 'PLAYER',
  ENEMY_CAR = 'ENEMY_CAR',
  FUEL_CAR = 'FUEL_CAR', // Coche especial que da combustible
  ROCK = 'ROCK'
}

export interface Entity {
  id: number;
  type: EntityType;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number; // Velocidad relativa
  color: string;
}

export interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  maxSpeed: number;
  fuel: number;
  distance: number;
}
