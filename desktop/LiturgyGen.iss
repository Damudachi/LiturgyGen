; LiturgyGen installer. Built by desktop/build.mjs - run `npm run package:desktop`,
; not this file directly: the build passes Stage, OutputDir and AppVersion.
;
; Installs for the signed-in Windows account only, so no administrator is needed.
; The program goes in %LOCALAPPDATA%\Programs\LiturgyGen and is replaced on
; every update. The office's data - prayers, corrections, saved readings - lives
; in %LOCALAPPDATA%\LiturgyGen: a new computer starts from the copy bundled here,
; and a computer that already has data keeps it untouched. A public build
; (--public) bundles no data, so a new computer starts empty.

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

[Setup]
AppId={{6C1B9E2A-4D7F-4E4B-9A51-2F7C8D3B1E60}
AppName=LiturgyGen
AppVersion={#AppVersion}
AppVerName=LiturgyGen {#AppVersion}
DefaultDirName={localappdata}\Programs\LiturgyGen
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#OutputDir}
OutputBaseFilename=LiturgyGen-Setup-{#AppVersion}
SetupIconFile=LiturgyGen.ico
UninstallDisplayIcon={app}\LiturgyGen.exe
UninstallDisplayName=LiturgyGen
WizardStyle=modern
Compression=lzma2/max
SolidCompression=yes
; An open LiturgyGen holds its files; close it before replacing them.
CloseApplications=force
RestartApplications=no

[Files]
Source: "{#Stage}\app\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "{#Stage}\data\*"; DestDir: "{localappdata}\LiturgyGen"; Flags: recursesubdirs createallsubdirs onlyifdoesntexist uninsneveruninstall skipifsourcedoesntexist

[InstallDelete]
; Old program files from an earlier version, so nothing stale is left behind.
Type: filesandordirs; Name: "{app}\server"
Type: filesandordirs; Name: "{app}\client"
Type: filesandordirs; Name: "{app}\node"

[Icons]
Name: "{autodesktop}\LiturgyGen"; Filename: "{app}\LiturgyGen.exe"; Comment: "Make the Mass readings missalettes"
Name: "{autoprograms}\LiturgyGen"; Filename: "{app}\LiturgyGen.exe"; Comment: "Make the Mass readings missalettes"

[Run]
Filename: "{app}\LiturgyGen.exe"; Description: "Open LiturgyGen now"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/F /IM LiturgyGen.exe /T"; Flags: runhidden; RunOnceId: "StopLiturgyGen"

[Messages]
FinishedLabel=LiturgyGen is installed. Open it any time from the LiturgyGen icon on the desktop.%n%nYour prayers, corrections and saved readings stay on this computer when LiturgyGen is updated or removed.
