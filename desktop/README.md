# LiturgyGen for the office computers

## Installing on an office computer

1. Copy `LiturgyGen-Setup-<version>.exe` to the computer (USB drive, shared folder).
2. Double-click it. No administrator is needed.
   Windows may say *"Windows protected your PC"* because the installer is not
   signed: choose **More info → Run anyway**.
3. Open **LiturgyGen** from the desktop icon. A small LiturgyGen card shows while it
   starts (a few seconds), then it opens in a window of its own, with its own taskbar
   icon. The dark navy bar across the top is the title bar: drag it to
   move the window, double-click it to maximize, and use the minimize, maximize and
   close buttons at its right end. **Closing the window closes LiturgyGen**; if days are still
   being made, it asks first. Opening the icon again while it is open brings the
   window to the front.

The window is drawn by WebView2, which is part of Windows 11 and of an up-to-date
Windows 10. On a computer without it, LiturgyGen opens in the browser instead, and
an icon beside the clock is how to quit (right-click → **Quit LiturgyGen**).

Links that leave LiturgyGen, such as the USCCB readings page, open in the browser.
Word files are saved to the Downloads folder.

The computer needs internet access only to fetch readings it has not saved yet.

## Where things are kept

| What | Where |
|---|---|
| The program | `%LOCALAPPDATA%\Programs\LiturgyGen` |
| Prayers, corrections, schedule, settings | `%LOCALAPPDATA%\LiturgyGen\liturgygen.sqlite` |
| Saved readings | `%LOCALAPPDATA%\LiturgyGen\cache` |
| Log, if something goes wrong | `%LOCALAPPDATA%\LiturgyGen\logs\server.log` |
| The window's own browser data | `%LOCALAPPDATA%\LiturgyGen\webview` |

To open it, type `%LOCALAPPDATA%\LiturgyGen` into the File Explorer address bar.
Each computer keeps its own copy. To back one up, close LiturgyGen and copy that
folder.

A first install starts with a copy of the data from the computer that built the
installer. Updating (running a newer installer) or uninstalling never touches
the data folder.

## Building the installer (developers)

On Windows, with Inno Setup 6 installed (`winget install JRSoftware.InnoSetup`):

```
npm install
npm run package:desktop
```

The first build downloads the WebView2 SDK from NuGet into `desktop/.cache`. The
result is `desktop/dist/LiturgyGen-Setup-<version>.exe`. Raise `version` in
the root `package.json` before building an update.
