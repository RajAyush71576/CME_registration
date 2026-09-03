from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.excel_store import init_workbook
from app.routers import (
    attendance,
    auth,
    certificates,
    events,
    imports,
    observer_sheet,
    participants,
    registrations,
    reports,
)
from app.seed import seed_users


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_workbook()
    seed_users()
    yield


app = FastAPI(title="CME Registration System API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(participants.router)
app.include_router(events.router)
app.include_router(registrations.router)
app.include_router(attendance.router)
app.include_router(certificates.router)
app.include_router(imports.router)
app.include_router(reports.router)
app.include_router(observer_sheet.router)


@app.get("/health")
def health():
    return {"status": "ok"}
