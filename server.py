"""
DINO RUSH EXTREME: JURASSIC SURVIVOR - SERVER AUTHORITATIVE MATCHMAKER
FastAPI + WebSockets: handles match states, obstacles synchronization, and leaderboards.
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
import json, asyncio, logging, random, time
from collections import defaultdict
from typing import Dict, List, Set

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("jurassic-server")

app = FastAPI(title="Dino Rush Extreme Hub")

# --- Game Logic Constants ---
TICK_RATE = 0.05  # 20Hz for world updates
SPAWN_INTERVAL = 2.5 # Every 2.5 seconds, spawn something

class MatchSession:
    def __init__(self, room_id: str):
        self.room_id = room_id
        self.players: Dict[str, WebSocket] = {} # role: ws
        self.ready_players: Set[str] = set()
        self.is_running = False
        self.start_time = 0
        self.score = 0
        self.task = None

    async def broadcast(self, msg: dict, exclude: str = None):
        dead = []
        for role, ws in self.players.items():
            if role != exclude:
                try:
                    await ws.send_text(json.dumps(msg, ensure_ascii=False))
                except Exception:
                    dead.append(role)
        for role in dead:
            self.players.pop(role, None)
            self.ready_players.discard(role)

    async def game_loop(self):
        log.info(f"[{self.room_id}] Game loop started")
        last_spawn = 0
        while self.is_running and len(self.players) > 0:
            now = time.time()
            # Spawner Logic: Authoritative spawn set to ensure both see same obstacles
            if now - last_spawn > SPAWN_INTERVAL:
                spawn_set = self.generate_spawn_set()
                await self.broadcast({"type": "spawn", "data": spawn_set})
                last_spawn = now
            
            # Special Events every 30s
            if int(now - self.start_time) % 45 == 0 and int(now - self.start_time) > 0:
                await self.broadcast({"type": "event", "event_type": "VOLCANO_ERUPTION"})

            await asyncio.sleep(TICK_RATE)

    def generate_spawn_set(self):
        # Professional randomized patterns
        lane = random.choice([-4, 0, 4])
        obs_type = random.choice(["MINE", "MINE", "BIRD", "LAVA_GAP", "POWERUP"])
        
        # Multiple hazards at higher speeds can be added here
        return [{
            "id": f"obs_{int(time.time()*1000)}",
            "type": obs_type,
            "lane": lane,
            "z": -150 # Spawn point far ahead
        }]

sessions: Dict[str, MatchSession] = {}

def get_session(room_id: str) -> MatchSession:
    if room_id not in sessions:
        sessions[room_id] = MatchSession(room_id)
    return sessions[room_id]

@app.websocket("/ws/{room_id}/{player_id}")
async def match_endpoint(websocket: WebSocket, room_id: str, player_id: str):
    await websocket.accept()
    session = get_session(room_id)
    session.players[player_id] = websocket
    log.info(f"[{room_id}] {player_id} connected")

    # Sync room status
    await session.broadcast({
        "type": "lobby_update",
        "players": list(session.players.keys()),
        "ready": list(session.ready_players)
    })

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            msg["player"] = player_id # Force sender identification

            # --- Lobby Ready System ---
            if msg["type"] == "ready":
                session.ready_players.add(player_id)
                await session.broadcast({"type": "ready_update", "player": player_id, "ready": list(session.ready_players)})
                
                # Auto-start logic
                if len(session.ready_players) >= 2 and not session.is_running:
                    session.is_running = True
                    session.start_time = time.time()
                    await session.broadcast({"type": "start_countdown", "delay": 3})
                    session.task = asyncio.create_task(session.game_loop())

            # --- Real-time State Relay ---
            elif msg["type"] in ["state", "event", "jump", "lane_change", "crouch"]:
                await session.broadcast(msg, exclude=player_id)

            # --- Game Control ---
            elif msg["type"] == "game_over":
                session.is_running = False
                await session.broadcast({"type": "remote_game_over", "player": player_id, "score": msg.get("score", 0)})

    except WebSocketDisconnect:
        log.info(f"[{room_id}] {player_id} disconnected")
        session.players.pop(player_id, None)
        session.ready_players.discard(player_id)
        if len(session.players) == 0:
            session.is_running = False
            if session.task: session.task.cancel()
        await session.broadcast({"type": "lobby_update", "players": list(session.players.keys())})

# Serve static game files
app.mount("/", StaticFiles(directory="game", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
