@echo off
title RXCORP Launcher
echo ==========================================
echo       Lancement de RXCORP Launcher 2.0
echo ==========================================
echo.
if not exist node_modules (
    echo [INFO] Installation des modules npm...
    call npm install
)
echo [INFO] Demarrage de l'application...
call npm start
if %errorlevel% neq 0 (
    echo.
    echo [ERREUR] Impossible de lancer l'application. Verifiez que Node.js est installe sur votre PC Windows.
    pause
)
