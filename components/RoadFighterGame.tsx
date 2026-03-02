import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameState, EntityType, Entity, Player } from '../types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  ROAD_WIDTH,
  ROAD_X_START,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_MAX_SPEED,
  PLAYER_ACCELERATION,
  PLAYER_DECELERATION,
  PLAYER_BRAKE,
  PLAYER_TURN_SPEED,
  PLAYER_CENTRIFUGAL_FORCE,
  MAX_FUEL,
  FUEL_CONSUMPTION_RATE,
  FUEL_REFILL_AMOUNT,
  TIME_LIMIT,
  SPAWN_RATE
} from '../constants';

// Definición de tramos de la carretera
// curve: -1 (Izquierda fuerte), 0 (Recta), 1 (Derecha fuerte)
const TRACK_SEGMENTS = [
  { endDistance: 500, curve: 0 },
  { endDistance: 2000, curve: -0.5 }, // Curva suave izq
  { endDistance: 3000, curve: 0 },
  { endDistance: 5000, curve: 0.8 },  // Curva fuerte der
  { endDistance: 6000, curve: 0 },
  { endDistance: 8000, curve: -0.8 }, // Curva fuerte izq
  { endDistance: 10000, curve: 0.3 },
  { endDistance: 999999, curve: 0 },
];

const RoadFighterGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  
  // Refs for mutable game state
  const playerRef = useRef<Player>({
    x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
    y: CANVAS_HEIGHT - 100,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    speed: 0,
    maxSpeed: PLAYER_MAX_SPEED,
    fuel: MAX_FUEL,
    distance: 0
  });

  const enemiesRef = useRef<Entity[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const roadOffsetRef = useRef<number>(0);
  const timeLeftRef = useRef<number>(TIME_LIMIT);
  const currentCurveRef = useRef<number>(0); // Valor actual de la curva (interpolado)
  
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // --- Input Handling ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // --- Reset Game ---
  const resetGame = useCallback(() => {
    playerRef.current = {
      x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
      y: CANVAS_HEIGHT - 120,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      speed: 0,
      maxSpeed: PLAYER_MAX_SPEED,
      fuel: MAX_FUEL,
      distance: 0
    };
    enemiesRef.current = [];
    roadOffsetRef.current = 0;
    timeLeftRef.current = TIME_LIMIT;
    currentCurveRef.current = 0;
    setGameState(GameState.PLAYING);
  }, []);

  // --- Collision Detection ---
  const checkCollision = (rect1: {x: number, y: number, width: number, height: number}, rect2: Entity) => {
    // Reducir un poco la caja de colisión para que sea más justo
    const buffer = 4;
    return (
      rect1.x + buffer < rect2.x + rect2.width - buffer &&
      rect1.x + rect1.width - buffer > rect2.x + buffer &&
      rect1.y + buffer < rect2.y + rect2.height - buffer &&
      rect1.y + rect1.height - buffer > rect2.y + buffer
    );
  };

  // --- Drawing Helpers ---
  const drawCar = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, isPlayer: boolean) => {
    // Cuerpo del coche
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);

    // Detalles simples (ruedas)
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 2, y + 5, 2, 10); 
    ctx.fillRect(x + w, y + 5, 2, 10); 
    ctx.fillRect(x - 2, y + h - 15, 2, 10); 
    ctx.fillRect(x + w, y + h - 15, 2, 10); 

    // Techo/Parabrisas
    ctx.fillStyle = isPlayer ? '#FFAAAA' : '#AAAAFF';
    ctx.fillRect(x + 5, y + 15, w - 10, h - 30);

    // Luces traseras
    if (isPlayer) {
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(x + 2, y + h - 2, 6, 2);
      ctx.fillRect(x + w - 8, y + h - 2, 6, 2);
    }
  };

  const drawRoad = (ctx: CanvasRenderingContext2D, offset: number, curve: number) => {
    // 1. Césped (Fondo)
    ctx.fillStyle = '#2d6a4f'; 
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. Carretera Base (Asfalto)
    // No la sesgamos con transformaciones complejas para simplificar la lógica de colisión visual,
    // pero dibujaremos las líneas inclinadas para dar la sensación de curva.
    ctx.fillStyle = '#555';
    ctx.fillRect(ROAD_X_START, 0, ROAD_WIDTH, CANVAS_HEIGHT);

    // 3. Bordes (Rojo y Blanco estilo retro)
    const stripeHeight = 40;
    const numStripes = Math.ceil(CANVAS_HEIGHT / stripeHeight) + 1;
    
    for (let i = -1; i < numStripes; i++) {
        const y = (i * stripeHeight) + (offset % stripeHeight);
        // Alternar color basado en posición absoluta aproximada para efecto de velocidad
        const isWhite = Math.abs(Math.floor((offset + y) / stripeHeight)) % 2 === 0;
        ctx.fillStyle = isWhite ? '#FFF' : '#FF0000';
        
        // Borde Izquierdo
        ctx.fillRect(ROAD_X_START, y, 12, stripeHeight);
        // Borde Derecho
        ctx.fillRect(ROAD_X_START + ROAD_WIDTH - 12, y, 12, stripeHeight);
    }

    // 4. Líneas centrales (Con efecto de Skew/Inclinación para simular curva)
    ctx.save();
    // Movemos el origen al centro para rotar/inclinar desde ahí
    // Pero para simplificar en 2D top-down, usaremos `transform` para inclinar el dibujo de las líneas
    // skewX = curve * factor
    const skewAmount = curve * -0.5; // Invertido: si curva es Derecha (+), líneas apuntan izquierda arriba
    
    // Aplicamos skew solo a las líneas centrales para dar sensación de profundidad/curva
    ctx.transform(1, 0, skewAmount, 1, 0, 0); 

    ctx.fillStyle = '#FFF';
    const lineHeight = 60;
    const gap = 60;
    const totalLineH = lineHeight + gap;
    
    // Ajustamos el loop para cubrir el skew
    for (let i = -2; i < (CANVAS_HEIGHT / totalLineH) + 2; i++) {
      const y = (i * totalLineH) + (offset % totalLineH);
      // Ajustamos X basado en el skew manualmente si no usáramos transform, 
      // pero con transform, dibujamos recto y el canvas lo inclina.
      // Necesitamos compensar la X porque el skew mueve todo.
      // Un skew en X mueve la coordenada X basada en Y.
      // x' = x + tan(a)*y.
      // Dibujamos en el centro de la pantalla "lógica".
      
      if (y > -100 && y < CANVAS_HEIGHT + 100) {
         // Dibujamos desplazado en X para contrarrestar el movimiento del skew en el centro de la pantalla
         // (Truco visual rápido)
         const centerX = (CANVAS_WIDTH / 2) - (y * skewAmount); 
         ctx.fillRect(centerX - 4, y, 8, lineHeight);
      }
    }
    ctx.restore();
  };

  // --- Main Game Loop ---
  const update = useCallback((time: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = time;
    const deltaTime = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    // --- GAME LOGIC ---
    if (gameState === GameState.PLAYING) {
      const player = playerRef.current;
      const keys = keysRef.current;

      // 0. Determinar Curva del nivel
      // Buscar el segmento actual
      const currentSegment = TRACK_SEGMENTS.find(s => s.endDistance > player.distance) || TRACK_SEGMENTS[TRACK_SEGMENTS.length - 1];
      const targetCurve = currentSegment.curve;
      
      // Interpolación suave hacia la curva objetivo (Smooth transition)
      const curveLerpSpeed = 0.02;
      currentCurveRef.current = currentCurveRef.current + (targetCurve - currentCurveRef.current) * curveLerpSpeed;
      const curve = currentCurveRef.current;

      // 1. Controls & Physics
      if (keys['w']) {
        player.speed = Math.min(player.speed + PLAYER_ACCELERATION, player.maxSpeed);
      } else if (keys['s']) {
        player.speed = Math.max(player.speed - PLAYER_BRAKE, 0);
      } else {
        player.speed = Math.max(player.speed - PLAYER_DECELERATION, 0);
      }

      // Dirección Manual
      if (player.speed > 0) {
        const turnPower = PLAYER_TURN_SPEED * (player.speed / 5);
        if (keys['a']) player.x -= turnPower;
        if (keys['d']) player.x += turnPower;
      }

      // 2. FÍSICA DE CURVAS (La parte difícil)
      // Si hay curva a la derecha (curve > 0), el coche es empujado a la izquierda (fuerza centrífuga)
      // La fuerza depende de la velocidad del coche.
      if (Math.abs(curve) > 0.01 && player.speed > 1) {
          const centrifugalPush = -curve * player.speed * PLAYER_CENTRIFUGAL_FORCE;
          player.x += centrifugalPush;
      }

      // 3. Boundaries
      if (player.x < ROAD_X_START + 12) {
          player.x = ROAD_X_START + 12;
          player.speed *= 0.92; // Rozar pared frena
          player.fuel -= 0.1; // Daño
      }
      if (player.x > ROAD_X_START + ROAD_WIDTH - player.width - 12) {
          player.x = ROAD_X_START + ROAD_WIDTH - player.width - 12;
          player.speed *= 0.92;
          player.fuel -= 0.1;
      }

      // 4. Fuel & Time
      if (player.speed > 0.1) {
          player.fuel -= FUEL_CONSUMPTION_RATE * (player.speed / 5);
      }
      timeLeftRef.current -= deltaTime;

      if (player.fuel <= 0 || timeLeftRef.current <= 0) {
        setGameState(GameState.GAME_OVER);
      }

      // 5. Update World
      roadOffsetRef.current += player.speed * 3; // Multiplicador visual de velocidad
      player.distance += player.speed;

      // 6. Spawning Enemies
      if (Math.random() < SPAWN_RATE) {
        const isFuelCar = Math.random() < 0.15;
        const laneWidth = (ROAD_WIDTH - 40) / 4;
        const lane = Math.floor(Math.random() * 4); // 4 Carriles virtuales
        
        const newEntity: Entity = {
          id: Date.now() + Math.random(),
          type: isFuelCar ? EntityType.FUEL_CAR : EntityType.ENEMY_CAR,
          // Spawnear alineado a "carriles" pero con algo de aleatoriedad
          x: ROAD_X_START + 20 + (lane * laneWidth) + (Math.random() * 10), 
          y: -150, 
          width: PLAYER_WIDTH,
          height: PLAYER_HEIGHT,
          speed: isFuelCar ? 3 : 2 + Math.random() * 4,
          color: isFuelCar ? '#ec4899' : '#22c55e'
        };
        enemiesRef.current.push(newEntity);
      }

      // 7. Update Enemies
      enemiesRef.current.forEach((enemy, index) => {
        const relativeSpeed = player.speed - enemy.speed;
        enemy.y += relativeSpeed;

        // NOTA: Los enemigos no son afectados por la fuerza centrífuga igual que el jugador
        // porque se asume que la IA "sigue la carretera" perfectamente.
        // Visualmente, si la carretera se mueve, ellos se mueven con ella.
        // Como nuestra carretera es estática en X, ellos se quedan estáticos en X (siguen su carril).

        if (enemy.y > CANVAS_HEIGHT + 100) {
           enemiesRef.current.splice(index, 1);
        }

        if (checkCollision(player, enemy)) {
           if (enemy.type === EntityType.FUEL_CAR) {
             player.fuel = Math.min(player.fuel + FUEL_REFILL_AMOUNT, MAX_FUEL);
             enemiesRef.current.splice(index, 1);
           } else {
             player.speed *= 0.3;
             player.fuel -= 8;
             // Rebote simple
             const pushDir = player.x < enemy.x ? -1 : 1;
             player.x += pushDir * 15;
             enemy.x -= pushDir * 10; // Mover también al enemigo
             // Girar un poco al enemigo visualmente (opcional, no implementado aquí)
           }
        }
      });
    }

    // --- RENDER ---
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Draw Road (Pasamos la curva actual para efectos visuales)
    drawRoad(ctx, roadOffsetRef.current, currentCurveRef.current);

    // 2. Draw Enemies
    enemiesRef.current.forEach(entity => {
      drawCar(ctx, entity.x, entity.y, entity.width, entity.height, entity.color, false);
      if (entity.type === EntityType.FUEL_CAR) {
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px Arial';
        ctx.fillText('FUEL', entity.x + 2, entity.y - 8);
      }
    });

    // 3. Draw Player
    if (gameState !== GameState.GAME_OVER) {
       drawCar(ctx, playerRef.current.x, playerRef.current.y, playerRef.current.width, playerRef.current.height, '#ef4444', true);
    }

    // 4. UI Overlay
    // Fondo HUD
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, 70);

    // Velocidad
    const speedPct = (playerRef.current.speed / playerRef.current.maxSpeed) * 100;
    ctx.fillStyle = 'white';
    ctx.font = '14px "Press Start 2P"';
    ctx.fillText(`SPEED: ${Math.floor(speedPct * 2)}`, 10, 25);
    
    // Indicador de Curva (Flechas)
    if (Math.abs(currentCurveRef.current) > 0.1) {
        ctx.fillStyle = '#facc15'; // Amarillo
        const arrow = currentCurveRef.current > 0 ? ">>>" : "<<<";
        const txtX = currentCurveRef.current > 0 ? CANVAS_WIDTH - 60 : CANVAS_WIDTH / 2 - 20;
        // Dibujarlo en el centro-arriba si es muy fuerte
        ctx.textAlign = "center";
        ctx.font = '20px "Press Start 2P"';
        ctx.fillText(arrow, CANVAS_WIDTH / 2, 100);
        ctx.textAlign = "left"; // Reset
    }

    // Tiempo
    ctx.fillStyle = timeLeftRef.current < 10 ? '#ef4444' : '#fbbf24';
    ctx.font = '14px "Press Start 2P"';
    ctx.fillText(`TIME: ${Math.max(0, timeLeftRef.current).toFixed(1)}`, 280, 25);

    // Barra de Combustible
    ctx.fillStyle = 'white';
    ctx.font = '12px "Press Start 2P"';
    ctx.fillText("FUEL", 10, 50);
    ctx.strokeStyle = 'white';
    ctx.strokeRect(60, 38, 150, 14);
    const fuelWidth = (playerRef.current.fuel / MAX_FUEL) * 146;
    ctx.fillStyle = playerRef.current.fuel < 20 ? '#ef4444' : '#ec4899';
    ctx.fillRect(62, 40, Math.max(0, fuelWidth), 10);

    // Barra de Progreso (Distancia)
    ctx.fillStyle = '#666';
    ctx.fillRect(CANVAS_WIDTH - 20, 100, 10, 200); // Track total
    // Meta
    ctx.fillStyle = '#fff'; 
    ctx.fillRect(CANVAS_WIDTH - 24, 100, 18, 4); 
    // Jugador dot
    // Asumimos meta a los 10000 de distancia
    const progress = Math.min(playerRef.current.distance / 10000, 1); 
    const playerY = 300 - (progress * 200);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(CANVAS_WIDTH - 24, playerY, 18, 4);


    requestRef.current = requestAnimationFrame(() => update(performance.now()));
  }, [gameState]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(() => update(performance.now()));
    return () => cancelAnimationFrame(requestRef.current);
  }, [update]);

  // --- React UI Overlays ---
  return (
    <div className="relative" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="block bg-black shadow-2xl"
      />

      {gameState === GameState.MENU && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white z-10 px-8 text-center">
          <h2 className="text-4xl font-bold mb-8 text-yellow-400 drop-shadow-lg">ROAD FIGHTER</h2>
          
          <div className="bg-zinc-800 p-6 rounded-lg border-2 border-zinc-600 mb-8">
            <p className="text-pink-400 mb-2 font-bold">¡NUEVO!</p>
            <p className="text-xs text-gray-300 mb-4">Cuidado con las curvas. El coche derrapará si no corriges la dirección.</p>
          </div>

          <button
            onClick={resetGame}
            className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow-lg animate-pulse"
          >
            START ENGINE
          </button>
        </div>
      )}

      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white z-10">
          <h2 className="text-4xl font-bold mb-4 text-red-500">GAME OVER</h2>
          <p className="mb-4 text-xl">
            {playerRef.current.fuel <= 0 ? "SIN COMBUSTIBLE" : "TIEMPO AGOTADO"}
          </p>
          <p className="mb-8 text-yellow-300">
            Distancia: {Math.floor(playerRef.current.distance)} m
          </p>
          <button
            onClick={resetGame}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded"
          >
            REINTENTAR
          </button>
        </div>
      )}
    </div>
  );
};

export default RoadFighterGame;