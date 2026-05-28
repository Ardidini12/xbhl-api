from typing import List
from fastapi import WebSocket
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.debug(f"Client connected to real-time feed. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.debug(f"Client disconnected from real-time feed. Remaining: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """
        Push a message to all connected clients.
        """
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # This usually means the connection is dead, we'll clean up later 
                # or let the next disconnect handle it
                pass

broadcast_manager = ConnectionManager()
