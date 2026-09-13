@echo off
title RXCORP Launcher 2.0
echo ==========================================
echo       Lancement de RXCORP Launcher 2.0
echo ==========================================
echo.

:: Resoudre le chemin reseau (UNC path fix)
pushd "%~dp0"

echo [INFO] Emplacement : %CD%

if not exist node_modules (
    echo [INFO] Premier demarrage : installation des dependances npm...
    call npm install
)

echo [INFO] Demarrage de l'application RXCORP...
call npm start

if %errorlevel% neq 0 (
    echo.
    echo =========================================================
    echo [ERREUR] Impossible de lancer RXCORP Launcher.
    echo Assurez-vous que Node.js est bien installe sur Windows :
    echo https://nodejs.org
    echo =========================================================
    echo.
    pause
)

popd
