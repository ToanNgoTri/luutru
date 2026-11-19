@echo off
setlocal
cd /d "%~dp0"
title Cap nhat danh sach truy na

rem ===================================================================
rem  Cập nhật danh sách truy nã + thêm cột ĐỊA DANH MỚI (DIADANH_MOI)
rem  - Bấm đúp: hiện menu
rem  - Kéo thả file .xlsx / .json (AutoWeb xuất ra) vào file này: nhập luôn file đó
rem  Cần: Node.js, thư mục này đã chạy "npm install", file .env có SUPABASE_SECRET_KEY
rem ===================================================================

where node >nul 2>nul || (echo [LOI] May chua cai Node.js - tai tai https://nodejs.org & pause & exit /b 1)

if not "%~1"=="" (
  echo Nhap file: %~1
  call npm run truyna -- nhap "%~1" %2 %3
  goto xong
)

echo.
echo   CAP NHAT DANH SACH TRUY NA
echo   ----------------------------------------------
echo   1. Lay tu trang web Bo Cong an ve (day du, ~5 phut) va cap nhat len he thong
echo   2. Lay nhanh 5 trang dau (nguoi moi bi truy na) va cap nhat len he thong
echo   3. Nhap file AutoWeb (.xlsx / .json) va cap nhat len he thong
echo   4. Chi tao file Excel co dia danh moi tu web (KHONG cap nhat he thong)
echo   5. Chi tao file Excel co dia danh moi tu file AutoWeb (KHONG cap nhat he thong)
echo   ----------------------------------------------
set "chon="
set /p "chon=  Chon (1-5): "

if "%chon%"=="1" call npm run truyna
if "%chon%"=="2" call npm run truyna -- nhanh
if "%chon%"=="4" call npm run truyna -- --khong-db
if "%chon%"=="3" goto hoiTep
if "%chon%"=="5" goto hoiTep
goto xong

:hoiTep
echo.
echo   Keo tha file vao cua so nay roi bam Enter (hoac go duong dan):
set "tep="
set /p "tep=  File: "
if not defined tep goto xong
set "tep=%tep:"=%"
if "%chon%"=="3" call npm run truyna -- nhap "%tep%"
if "%chon%"=="5" call npm run truyna -- nhap "%tep%" --khong-db

:xong
echo.
echo   Xong. File ket qua:
echo     - Lay tu web : du-lieu\truyna.xlsx  (va .json)
echo     - Nhap file  : cung thu muc voi file goc, ten ...-diadanh.xlsx  (file .json thi ghi de, them cot)
if exist du-lieu start "" du-lieu
pause
