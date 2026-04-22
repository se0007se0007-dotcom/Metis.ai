@echo off
chcp 65001 >nul 2>&1
title Metis.AI - Full Stack Launcher
color 0A

echo ============================================
echo    Metis.AI - AgentOps Governance Platform
echo    Full Stack Auto Launcher
echo ============================================
echo.

:: ── 1. Check prerequisites ──
echo [1/7] Checking prerequisites...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found. Please install Node.js v20+
    pause
    exit /b 1
)

where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: pnpm not found. Install with: npm install -g pnpm
    pause
    exit /b 1
)

where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker not found. Please install Docker Desktop.
    pause
    exit /b 1
)

echo    OK - Node.js, pnpm, Docker found
echo.

:: ── 2. Set environment variables ──
echo [2/7] Setting environment variables...
set "DATABASE_URL=postgresql://metis:metis_secret@localhost:5432/metis_dev"
set "REDIS_URL=redis://localhost:6379"
set "AUTH_SECRET=metis-dev-secret-key-change-in-production-2026"
set "API_PORT=4000"
set "API_PREFIX=/v1"
set "CORS_ORIGIN=http://localhost:3000"
set "WORKER_CONCURRENCY=5"
set "LOG_LEVEL=debug"
:: API keys are loaded from .env file by NestJS ConfigModule.
:: Do NOT set placeholders here — they override .env values.
:: Edit the .env file in the project root to set your keys.
echo    OK
echo.

:: ── 3. Start Docker (PostgreSQL + Redis) ──
echo [3/7] Starting Docker infrastructure...

docker rm -f metis-postgres metis-redis >nul 2>&1

docker compose -f infra/compose/docker-compose.yml up -d
if %errorlevel% neq 0 (
    echo ERROR: Docker compose failed. Is Docker Desktop running?
    pause
    exit /b 1
)

echo    Waiting for PostgreSQL to be ready...
set /a PG_WAIT=0
:wait_pg
docker exec metis-postgres pg_isready -U metis -d metis_dev >nul 2>&1
if %errorlevel% neq 0 (
    set /a PG_WAIT+=2
    if %PG_WAIT% geq 60 (
        echo ERROR: PostgreSQL did not start within 60 seconds.
        pause
        exit /b 1
    )
    timeout /t 2 /nobreak >nul
    goto wait_pg
)
echo    OK - PostgreSQL ready

echo    Checking Redis...
docker exec metis-redis redis-cli ping >nul 2>&1
if %errorlevel% neq 0 (
    echo    WARNING: Redis may not be ready yet - continuing...
) else (
    echo    OK - Redis is running
)
echo.

:: ── 4. Install dependencies ──
echo [4/7] Installing dependencies...
call pnpm install
echo.

:: ── 5. Database setup ──
echo [5/7] Setting up database...

echo    [5a] Generating Prisma client...
call pnpm db:generate
if %errorlevel% neq 0 (
    echo ERROR: Prisma generate failed.
    pause
    exit /b 1
)

echo    [5b] Pushing schema to database...
call pnpm --filter @metis/database push -- --accept-data-loss
if %errorlevel% neq 0 (
    echo ERROR: Database push failed.
    pause
    exit /b 1
)

echo    [5c] Seeding database...
call pnpm db:seed
if %errorlevel% neq 0 (
    echo    WARNING: Seed had issues - may already exist, continuing
)
echo    OK - Database setup complete
echo.

:: ── 6. Build packages ──
echo [6/7] Building shared packages...
call pnpm --filter @metis/database build
call pnpm --filter @metis/types build 2>nul
echo    OK - Packages built
echo.

:: ── 7. Kill stale processes and start servers ──
echo [7/7] Cleaning up stale processes...

taskkill /FI "WINDOWTITLE eq Metis API*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Metis Worker*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Metis Frontend*" /F >nul 2>&1

for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":4000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%p /F >nul 2>&1
)
for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%p /F >nul 2>&1
)

timeout /t 2 /nobreak >nul
echo    OK - Ports cleared
echo.

echo ============================================
echo    Starting 3 servers in separate windows...
echo.
echo    API Server    : http://localhost:4000/v1/health
echo    Swagger Docs  : http://localhost:4000/docs
echo    Frontend      : http://localhost:3000
echo    Login         : admin@metis.ai / metis1234
echo ============================================
echo.

:: Child processes inherit all env vars from this parent process.
:: No need to pass them explicitly.
start "Metis API - port 4000" cmd /k "cd /d %~dp0 && pnpm --filter @metis/api dev"

echo Waiting for API server to start...
timeout /t 10 /nobreak >nul

echo Checking API health...
curl -s http://localhost:4000/v1/health >nul 2>&1
if %errorlevel% neq 0 (
    echo    WARNING: API may still be starting...
    timeout /t 5 /nobreak >nul
) else (
    echo    OK - API server responding
)

start "Metis Worker" cmd /k "cd /d %~dp0 && pnpm --filter @metis/worker dev"
start "Metis Frontend - port 3000" cmd /k "cd /d %~dp0 && pnpm --filter @metis/web dev"

timeout /t 8 /nobreak >nul
echo.
echo Opening browser...
start http://localhost:3000

echo.
echo ============================================
echo    All servers started!
echo    Press any key to STOP all servers...
echo ============================================
pause >nul

echo.
echo Stopping servers...
taskkill /FI "WINDOWTITLE eq Metis API*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Metis Worker*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Metis Frontend*" /F >nul 2>&1

for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":4000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%p /F >nul 2>&1
)
for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%p /F >nul 2>&1
)

echo Done. All Metis servers stopped.
pause
