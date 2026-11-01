@echo off
setlocal
chcp 65001 >nul

set "REPO=%~dp0"

echo ============================================
echo  ATAWI FUDOSAN - publish author photo update
echo  Repo: %REPO%
echo ============================================
cd /d "%REPO%"
if errorlevel 1 (
  echo [ERROR] Could not find repo folder: %REPO%
  pause
  exit /b 1
)

for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set "BR=%%b"
echo Current branch: %BR%

echo.
node _tools\check-property-address-policy.mjs
if errorlevel 1 exit /b 1
node --test tests/*.test.cjs
if errorlevel 1 exit /b 1

echo --- git add ---
git add blog assets\author-oishi.jpg

echo.
echo --- git commit ---
git commit -m "blog: add author photo to bio box on all articles"
if errorlevel 1 (
  echo [INFO] Nothing new to commit, or commit skipped. Continuing.
)

echo.
echo --- git pull --rebase ---
git pull --rebase origin %BR%
if errorlevel 1 (
  echo [ERROR] git pull --rebase failed. Resolve conflicts manually, then re-run this script.
  pause
  exit /b 1
)

echo.
node _tools\check-property-address-policy.mjs
if errorlevel 1 exit /b 1
node --test tests/*.test.cjs
if errorlevel 1 exit /b 1

echo --- git push ---
git push origin %BR%
if errorlevel 1 (
  echo [ERROR] git push failed. Check network / credentials and re-run.
  pause
  exit /b 1
)

echo.
echo ============================================
echo  DONE. Changes pushed to GitHub.
echo  Cloudflare Pages will redeploy automatically.
echo ============================================
pause
endlocal
