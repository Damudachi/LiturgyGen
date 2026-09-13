# LiturgyGen for the office computers

## Installing on an office computer

1. Copy `LiturgyGen-Setup-<version>.exe` to the computer (USB drive, shared folder).
2. Double-click it. No administrator is needed.
   Windows may say *"Windows protected your PC"* because the installer is not
   signed: choose **More info → Run anyway**.
3. Open **LiturgyGen** from the desktop icon. It opens in the browser at
   `http://localhost:4000`, and a LiturgyGen icon appears beside the clock.
   To close it, right-click that icon and choose **Quit LiturgyGen**.

The computer needs internet access only to fetch readings it has not saved yet.

## Where things are kept

| What | Where |
|---|---|
| The program | `%LOCALAPPDATA%\Programs\LiturgyGen` |
| Prayers, corrections, schedule, settings | `%LOCALAPPDATA%\LiturgyGen\liturgygen.sqlite` |
| Saved readings | `%LOCALAPPDATA%\LiturgyGen\cache` |
| Log, if something goes wrong | `%LOCALAPPDATA%\LiturgyGen\logs\server.log` |

The tray icon's **Open data folder** goes straight there. Each computer keeps
its own copy. To back one up, quit LiturgyGen and copy that folder.

A first install starts with a copy of the data from the computer that built the
installer. Updating (running a newer installer) or uninstalling never touches
the data folder.

## Building the installer (developers)

On Windows, with Inno Setup 6 installed (`winget install JRSoftware.InnoSetup`):

```
npm install
npm run package:desktop
```

The result is `desktop/dist/LiturgyGen-Setup-<version>.exe`. Raise `version` in
the root `package.json` before building an update.
