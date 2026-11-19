@echo off
setlocal
cd /d "%~dp0"
title Excel AutoWeb sang CSV (them dia danh moi)

rem ==================================================================
rem  File Excel danh sach truy na (AutoWeb xuat ra)  -->  file CSV
rem  co them cot DIADANH_MOI ngay sau NOIDKTT.
rem  Cach dung: KEO THA file Excel vao file nay, hoac bam dup roi chon file.
rem  Ket qua: file .csv cung ten, cung thu muc voi file Excel
rem  (dau phay, UTF-8 khong BOM - dung de nhap vao Supabase).
rem ==================================================================

where node >nul 2>nul || (echo [LOI] May chua cai Node.js - tai tai https://nodejs.org & pause & exit /b 1)

set "tep=%~1"
if not defined tep (
  echo Chon file Excel AutoWeb xuat ra...
  for /f "usebackq delims=" %%F in (`powershell -NoProfile -STA -Command "Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.OpenFileDialog; $d.Filter = 'Excel (*.xlsx)|*.xlsx|Tat ca|*.*'; $d.Title = 'Chon file danh sach truy na (AutoWeb)'; if ($d.ShowDialog() -eq 'OK') { $d.FileName }"`) do set "tep=%%F"
)
if not defined tep (echo Khong chon file nao. & pause & exit /b 0)

echo.
echo Dang xu ly: %tep%
echo.
call node --use-system-ca scripts\truyna.mjs nhap "%tep%" --chi-csv
if errorlevel 1 (echo. & echo [LOI] Khong xu ly duoc file, xem thong bao o tren. & pause & exit /b 1)

echo.
echo XONG.
pause
