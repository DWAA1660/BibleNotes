from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import init_db
from .routers import auth, bible, commentaries, notes, users, manuscripts

settings = get_settings()

app = FastAPI(title="Bible Notes API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"]
    ,
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


app.include_router(auth.router)
app.include_router(bible.router)
app.include_router(commentaries.router)
app.include_router(notes.router)
app.include_router(users.router)
app.include_router(manuscripts.router)
