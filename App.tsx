import React from 'react';
import RoadFighterGame from './components/RoadFighterGame';

const App: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 text-white">
      <h1 className="text-3xl text-yellow-400 mb-4 tracking-widest uppercase drop-shadow-md">
        Road Fighter React
      </h1>
      <p className="text-xs text-zinc-400 mb-2">
        USA <span className="text-white font-bold">[W, A, S, D]</span> PARA CONDUCIR
      </p>
      
      <div className="border-4 border-zinc-700 rounded-lg overflow-hidden shadow-2xl">
        <RoadFighterGame />
      </div>

      <div className="mt-4 text-center text-xs text-zinc-500 max-w-md">
        <p>Objetivo: Sobrevive hasta que termine el tiempo.</p>
        <p>Recoge los coches <span className="text-pink-400">ROSA</span> para obtener combustible.</p>
      </div>
    </div>
  );
};

export default App;