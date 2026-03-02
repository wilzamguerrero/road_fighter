export const CANVAS_WIDTH = 480; // Ancho del juego
export const CANVAS_HEIGHT = 640; // Alto del juego
export const ROAD_WIDTH = 340;
export const ROAD_X_START = (CANVAS_WIDTH - ROAD_WIDTH) / 2;

export const FPS = 60;
export const TIME_LIMIT = 60; // Segundos para llegar a meta (o sobrevivir)
export const MAX_FUEL = 100;
export const FUEL_CONSUMPTION_RATE = 0.05; // Combustible por frame
export const FUEL_REFILL_AMOUNT = 30;

export const PLAYER_WIDTH = 30;
export const PLAYER_HEIGHT = 50;
export const PLAYER_ACCELERATION = 0.2;
export const PLAYER_DECELERATION = 0.1; // Fricción natural
export const PLAYER_BRAKE = 0.4;
export const PLAYER_MAX_SPEED = 12;
export const PLAYER_TURN_SPEED = 4;
export const PLAYER_CENTRIFUGAL_FORCE = 0.6; // Fuerza con la que la curva te empuja

export const SPAWN_RATE = 0.02; // Probabilidad de spawn por frame