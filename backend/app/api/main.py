from fastapi import APIRouter

from app.api.routes import clubs, leagues, login, private, seasons, users, utils
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(login.router)
api_router.include_router(users.router)
api_router.include_router(utils.router)
api_router.include_router(leagues.router)
api_router.include_router(seasons.router)
api_router.include_router(clubs.router)


if settings.ENVIRONMENT == "local":
    api_router.include_router(private.router)
