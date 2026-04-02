"""
DINO RUSH - Real-time Multiplayer Server
FastAPI + WebSockets: relays game state between Shaun & Dean's phones
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import json, asyncio, logging
from collections import defaultdict

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("dino")

app = FastAPI(title="Dino Rush Multiplayer")

# rooms[room_id] = { player_id: WebSocket }
rooms: dict[str, dict[str, WebSocket]] = defaultdict(dict)
# last known state per player per room
states: dict[str, dict[str, dict]] = defaultdict(dict)

async def broadcast_to_others(room_id: str, sender_id: str, msg: dict):
    dead = []
    if room_id not in rooms: return
    for pid, ws in rooms[room_id].items():
        if pid != sender_id:
            try:
                await ws.send_text(json.dumps(msg, ensure_ascii=False))
            except Exception:
                dead.append(pid)
    for pid in dead:
        rooms[room_id].pop(pid, None)
        states[room_id].pop(pid, None)

@app.websocket("/ws/{room_id}/{player_id}")
async def ws_endpoint(websocket: WebSocket, room_id: str, player_id: str):
    await websocket.accept()
    log.info(f"[{room_id}] Player '{player_id}' connected")

    # Add to room
    rooms[room_id][player_id] = websocket

    # 1. Notify others this player joined
    await broadcast_to_others(room_id, player_id, {
        "type": "joined",
        "player": player_id,
        "players": list(rooms[room_id].keys())
    })

    # 2. Tell the new player who is already here
    await websocket.send_text(json.dumps({
        "type": "room_info",
        "players": list(rooms[room_id].keys())
    }))

    # 3. Synchronize current state of other players to the newcomer
    for pid, state in states[room_id].items():
        if pid != player_id:
            await websocket.send_text(json.dumps(state))

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            # Tag the message with the sender's ID
            msg["player"] = player_id
            
            # Update cache for state messages
            if msg.get("type") == "state":
                states[room_id][player_id] = msg
                
            await broadcast_to_others(room_id, player_id, msg)

    except WebSocketDisconnect:
        log.info(f"[{room_id}] Player '{player_id}' disconnected")
        if player_id in rooms[room_id]:
            del rooms[room_id][player_id]
        if player_id in states[room_id]:
            del states[room_id][player_id]
        
        await broadcast_to_others(room_id, player_id, {
            "type": "left",
            "player": player_id,
            "players": list(rooms[room_id].keys())
        })


# Serve static game files — must come AFTER websocket routes
app.mount("/", StaticFiles(directory="game", html=True), name="static")
