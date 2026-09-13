// LiturgyGen.exe - what the desktop icon opens.
//
// Starts the bundled Node server out of sight and shows LiturgyGen in a window
// of its own, drawn by WebView2 - the web view built into Windows 11 and kept
// up to date on Windows 10. Closing the window quits LiturgyGen. Opening the
// icon again brings the open window to the front; the server is started once.
//
// A computer without WebView2 still works: LiturgyGen opens in the browser
// instead, with an icon beside the clock to quit it.
//
// Built with the C# compiler that ships with Windows (.NET Framework 4), so the
// office computer needs nothing installed: see desktop/build.mjs. That compiler
// speaks C# 5 - no string interpolation, no "?.".

using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

static class Launcher
{
    // The environment overrides exist for testing a build beside a running
    // development copy; the office never sets them.
    public static readonly int Port = EnvInt("LITURGYGEN_PORT", 4000);
    public static readonly string Url = "http://localhost:" + Port + "/";
    // The server listens on IPv4 only. "localhost" tries IPv6 first, and .NET's
    // fallback outlasts a short timeout, so health checks name the address.
    static readonly string ApiUrl = "http://127.0.0.1:" + Port + "/api/";
    static readonly string AppDir = AppDomain.CurrentDomain.BaseDirectory;
    public static readonly string DataDir = Environment.GetEnvironmentVariable("LITURGYGEN_DATA_DIR") ?? Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LiturgyGen");
    static readonly bool NoBrowser = Environment.GetEnvironmentVariable("LITURGYGEN_NO_BROWSER") == "1";
    static readonly string LogFile = Path.Combine(DataDir, "logs", "server.log");

    static Process server;
    static bool quitting;
    static MainWindow window;
    static NotifyIcon tray;

    [DllImport("user32.dll")]
    static extern bool SetProcessDPIAware();

    [DllImport("user32.dll")]
    static extern bool AllowSetForegroundWindow(int processId);

    [STAThread]
    static void Main()
    {
        SetProcessDPIAware();
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        bool firstInstance;
        using (var mutex = new Mutex(true, "Local\\LiturgyGenLauncher" + Port, out firstInstance))
        {
            if (!firstInstance)
            {
                ShowRunningCopy();
                return;
            }

            using (var showSignal = new EventWaitHandle(false, EventResetMode.AutoReset, ShowSignalName()))
            {
                var listener = new Thread(delegate()
                {
                    while (showSignal.WaitOne())
                    {
                        if (window != null) window.ShowAgain();
                        else OpenBrowser();
                    }
                });
                listener.IsBackground = true;
                listener.Start();

                if (WebView2Available())
                {
                    window = new MainWindow();
                    Application.Run(window);
                }
                else
                {
                    RunInBrowser();
                }
                StopServer();
            }
        }
    }

    static string ShowSignalName()
    {
        return "Local\\LiturgyGenShow" + Port;
    }

    /// <summary>The icon was opened again: bring the open copy forward.</summary>
    static void ShowRunningCopy()
    {
        EventWaitHandle signal;
        if (EventWaitHandle.TryOpenExisting(ShowSignalName(), out signal))
        {
            // Windows only lets the process the user clicked hand focus on.
            AllowSetForegroundWindow(-1);
            signal.Set();
            signal.Dispose();
            return;
        }
        if (WaitForServer(20000)) OpenBrowser();
        else Fail("LiturgyGen is starting but did not answer. Try again in a moment.");
    }

    static bool WebView2Available()
    {
        try
        {
            return !string.IsNullOrEmpty(CoreWebView2Environment.GetAvailableBrowserVersionString());
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Start the server unless one is already answering. Null on success, else what to tell the office.</summary>
    public static string EnsureServer()
    {
        if (IsLiturgyGen()) return null; // a development copy is already serving
        if (PortTaken())
        {
            return "Another program on this computer is using port " + Port +
                   ", which LiturgyGen needs. Close that program and open LiturgyGen again.";
        }

        try
        {
            StartServer();
        }
        catch (Exception error)
        {
            return "LiturgyGen could not start: " + error.Message;
        }

        if (!WaitForServer(60000))
        {
            StopServer();
            return "LiturgyGen did not start. Details were saved in:\n" + LogFile;
        }
        return null;
    }

    static void StartServer()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(LogFile));
        // Keep the log from growing without end.
        if (File.Exists(LogFile) && new FileInfo(LogFile).Length > 5 * 1024 * 1024) File.Delete(LogFile);

        var info = new ProcessStartInfo(
            Path.Combine(AppDir, "node", "node.exe"),
            "\"" + Path.Combine(AppDir, "server", "src", "index.js") + "\"");
        info.WorkingDirectory = Path.Combine(AppDir, "server");
        info.UseShellExecute = false;
        info.CreateNoWindow = true;
        info.RedirectStandardOutput = true;
        info.RedirectStandardError = true;
        info.EnvironmentVariables["NODE_ENV"] = "production";
        info.EnvironmentVariables["HOST"] = "127.0.0.1";
        info.EnvironmentVariables["PORT"] = Port.ToString();
        info.EnvironmentVariables["LITURGYGEN_DATA_DIR"] = DataDir;
        info.EnvironmentVariables["LITURGYGEN_PARENT_PID"] = Process.GetCurrentProcess().Id.ToString();

        var log = new StreamWriter(LogFile, true) { AutoFlush = true };
        log.WriteLine();
        log.WriteLine("---- " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " starting ----");
        DataReceivedEventHandler write = delegate(object sender, DataReceivedEventArgs e)
        {
            if (e.Data == null) return;
            lock (log) log.WriteLine(e.Data);
        };

        server = new Process();
        server.StartInfo = info;
        server.EnableRaisingEvents = true;
        server.OutputDataReceived += write;
        server.ErrorDataReceived += write;
        server.Exited += delegate
        {
            if (quitting) return;
            // The server stopped on its own; say so rather than leave a dead window.
            var message = "LiturgyGen stopped unexpectedly. Open it again from the desktop icon.\n\nDetails: " + LogFile;
            if (window != null && window.IsHandleCreated)
            {
                window.BeginInvoke((Action)delegate
                {
                    Fail(message);
                    quitting = true;
                    window.Close();
                });
            }
            else if (tray != null)
            {
                tray.Visible = false;
                Fail(message);
                Application.Exit();
            }
        };
        server.Start();
        server.BeginOutputReadLine();
        server.BeginErrorReadLine();
    }

    public static void StopServer()
    {
        quitting = true;
        if (tray != null) tray.Visible = false;
        try
        {
            if (server != null && !server.HasExited) server.Kill();
        }
        catch
        {
            // Already gone.
        }
    }

    public static bool Quitting
    {
        get { return quitting; }
    }

    /// <summary>Without WebView2: the browser, and an icon beside the clock to quit.</summary>
    static void RunInBrowser()
    {
        var error = EnsureServer();
        if (error != null)
        {
            Fail(error);
            return;
        }

        var menu = new ContextMenuStrip();
        var open = menu.Items.Add("Open LiturgyGen", null, delegate { OpenBrowser(); });
        open.Font = new Font(open.Font, FontStyle.Bold);
        menu.Items.Add("Open data folder", null, delegate { OpenDataFolder(); });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Quit LiturgyGen", null, delegate { Application.Exit(); });

        tray = new NotifyIcon();
        tray.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        tray.Text = "LiturgyGen";
        tray.ContextMenuStrip = menu;
        tray.DoubleClick += delegate { OpenBrowser(); };
        tray.Visible = true;
        tray.ShowBalloonTip(4000, "LiturgyGen is running",
            "It opens in your browser. To close it, right-click this icon and choose Quit.", ToolTipIcon.Info);
        Microsoft.Win32.SystemEvents.SessionEnding += delegate { StopServer(); };

        OpenBrowser();
        Application.Run();
    }

    public static void OpenDataFolder()
    {
        Directory.CreateDirectory(DataDir);
        Process.Start("explorer.exe", "\"" + DataDir + "\"");
    }

    static int EnvInt(string name, int fallback)
    {
        int value;
        return int.TryParse(Environment.GetEnvironmentVariable(name), out value) ? value : fallback;
    }

    public static void OpenBrowser()
    {
        OpenExternal(Url);
    }

    public static void OpenExternal(string address)
    {
        if (NoBrowser) return;
        try
        {
            Process.Start(address);
        }
        catch (Exception error)
        {
            Fail("Could not open the browser (" + error.Message + "). Open " + address + " yourself.");
        }
    }

    static string Get(string path)
    {
        try
        {
            var request = (HttpWebRequest)WebRequest.Create(ApiUrl + path);
            request.Timeout = 1500;
            request.Proxy = null;
            using (var response = request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream()))
            {
                return reader.ReadToEnd();
            }
        }
        catch (WebException error)
        {
            // Something answered, just not with what we asked for.
            return error.Response != null ? "" : null;
        }
        catch
        {
            return null;
        }
    }

    static bool IsLiturgyGen()
    {
        var body = Get("health");
        return body != null && body.Contains("\"service\":\"LiturgyGen\"");
    }

    static bool PortTaken()
    {
        return Get("health") != null;
    }

    /// <summary>Whether days are still being made or fetched, which quitting would stop.</summary>
    public static bool BatchRunning()
    {
        var body = Get("batch");
        return body != null && body.Contains("\"status\":\"running\"");
    }

    static bool WaitForServer(int timeoutMs)
    {
        var watch = Stopwatch.StartNew();
        while (watch.ElapsedMilliseconds < timeoutMs)
        {
            if (server != null && server.HasExited) return false;
            if (IsLiturgyGen()) return true;
            Thread.Sleep(400);
        }
        return false;
    }

    public static void Fail(string message)
    {
        MessageBox.Show(message, "LiturgyGen", MessageBoxButtons.OK, MessageBoxIcon.Warning);
    }
}

/// <summary>
/// LiturgyGen's own window: a "starting" note, then the app itself.
///
/// Once the page is up, the Windows title bar is removed and LiturgyGen's navbar
/// takes its place (client/src/components/WindowControls.jsx). The page reports
/// presses on the bar and its buttons; this window does the moving, sizing and
/// closing, so Windows' own behaviour - snapping to screen edges, dragging a
/// maximized window down to restore it - comes for free. Until the page says it
/// is ready, the normal title bar stays, so the window can always be moved and
/// closed even if the page never loads.
/// </summary>
class MainWindow : Form
{
    readonly Label starting;
    readonly WebView2 web;
    bool shownOnce;
    bool navbarIsTitleBar;
    bool lastMaximized;

    const int WM_NCCALCSIZE = 0x0083;
    const int WM_NCLBUTTONDOWN = 0x00A1;
    const int HTCAPTION = 2, HTTOP = 12, HTTOPLEFT = 13, HTTOPRIGHT = 14;
    const uint SWP_FRAMECHANGED = 0x0020, SWP_NOMOVE = 0x0002, SWP_NOSIZE = 0x0001, SWP_NOZORDER = 0x0004, SWP_NOACTIVATE = 0x0010;

    [StructLayout(LayoutKind.Sequential)]
    struct RECT { public int Left, Top, Right, Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    struct NCCALCSIZE_PARAMS
    {
        public RECT Proposed, Before, BeforeClient;
        public IntPtr Position;
    }

    [DllImport("user32.dll")]
    static extern bool ReleaseCapture();

    [DllImport("user32.dll")]
    static extern IntPtr SendMessage(IntPtr window, int message, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);

    [DllImport("user32.dll")]
    static extern bool IsZoomed(IntPtr window);

    [DllImport("user32.dll")]
    static extern short GetAsyncKeyState(int key);

    public MainWindow()
    {
        Text = "LiturgyGen";
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        BackColor = ColorTranslator.FromHtml("#f7f2e6");
        MinimumSize = new Size(900, 600);
        var area = Screen.PrimaryScreen.WorkingArea;
        // A small screen opens maximized; the size set here is what Restore returns
        // to, so keep it clear of the screen edges.
        var small = area.Width < 1500 || area.Height < 900;
        Size = small ? new Size(area.Width * 85 / 100, area.Height * 85 / 100) : new Size(1440, 920);
        StartPosition = FormStartPosition.Manual;
        Location = new Point(area.Left + (area.Width - Width) / 2, area.Top + (area.Height - Height) / 2);
        if (small) WindowState = FormWindowState.Maximized;

        starting = new Label();
        starting.Dock = DockStyle.Fill;
        starting.TextAlign = ContentAlignment.MiddleCenter;
        starting.Font = new Font("Segoe UI", 16f);
        starting.ForeColor = ColorTranslator.FromHtml("#1b2740");
        starting.Text = "Opening LiturgyGen\u2026";

        web = new WebView2();
        web.Dock = DockStyle.Fill;
        web.Visible = false;
        web.DefaultBackgroundColor = BackColor;

        Controls.Add(web);
        Controls.Add(starting);
    }

    protected override async void OnShown(EventArgs e)
    {
        base.OnShown(e);

        var error = await Task.Run(() => Launcher.EnsureServer());
        if (error != null)
        {
            Launcher.Fail(error);
            Close();
            return;
        }

        try
        {
            var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(Launcher.DataDir, "webview"));
            await web.EnsureCoreWebView2Async(environment);
        }
        catch (Exception failure)
        {
            // The web view would not start after all: fall back to the browser
            // and keep this window as the way to quit.
            starting.Text = "LiturgyGen is open in your browser.\nClose this window to quit LiturgyGen.";
            Launcher.OpenBrowser();
            Debug.WriteLine(failure);
            return;
        }

        var core = web.CoreWebView2;
        core.Settings.AreDevToolsEnabled = false;
        core.Settings.IsStatusBarEnabled = false;
        core.Settings.IsZoomControlEnabled = true;
        core.DocumentTitleChanged += delegate { Text = string.IsNullOrEmpty(core.DocumentTitle) ? "LiturgyGen" : core.DocumentTitle; };

        // Links out of LiturgyGen (the USCCB readings page) open in the browser.
        core.NewWindowRequested += delegate(object sender, CoreWebView2NewWindowRequestedEventArgs args)
        {
            args.Handled = true;
            Launcher.OpenExternal(args.Uri);
        };
        core.NavigationStarting += delegate(object sender, CoreWebView2NavigationStartingEventArgs args)
        {
            if (args.Uri.StartsWith(Launcher.Url, StringComparison.OrdinalIgnoreCase)) return;
            args.Cancel = true;
            Launcher.OpenExternal(args.Uri);
        };
        core.WebMessageReceived += OnPageMessage;
        core.NavigationCompleted += delegate
        {
            if (shownOnce) return;
            shownOnce = true;
            web.Visible = true;
            starting.Visible = false;
            web.Focus();
        };

        core.Navigate(Launcher.Url);
    }

    void OnPageMessage(object sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        string message;
        try
        {
            message = args.TryGetWebMessageAsString();
        }
        catch
        {
            return;
        }

        switch (message)
        {
            case "ready":
                // The navbar is on screen with its window buttons: it can be the title bar now.
                if (!navbarIsTitleBar)
                {
                    navbarIsTitleBar = true;
                    SetWindowPos(Handle, IntPtr.Zero, 0, 0, 0, 0, SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE);
                }
                PostWindowState(true);
                break;
            case "drag":
                SystemGesture(HTCAPTION);
                break;
            case "resize-top":
                SystemGesture(HTTOP);
                break;
            case "resize-topleft":
                SystemGesture(HTTOPLEFT);
                break;
            case "resize-topright":
                SystemGesture(HTTOPRIGHT);
                break;
            case "toggle-maximize":
                WindowState = WindowState == FormWindowState.Maximized ? FormWindowState.Normal : FormWindowState.Maximized;
                break;
            case "minimize":
                WindowState = FormWindowState.Minimized;
                break;
            case "close":
                Close();
                break;
        }
    }

    /// <summary>Hand the mouse press to Windows as if it landed on the title bar or a frame edge.</summary>
    void SystemGesture(int hitTest)
    {
        // The message arrives a moment after the press. If the button is already up,
        // starting a move would leave the window following the mouse.
        const int VK_LBUTTON = 0x01;
        if ((GetAsyncKeyState(VK_LBUTTON) & 0x8000) == 0) return;
        ReleaseCapture();
        SendMessage(Handle, WM_NCLBUTTONDOWN, (IntPtr)hitTest, IntPtr.Zero);
    }

    void PostWindowState(bool always)
    {
        // Windows resizes the form while it is still being built, before the web view exists.
        if (web == null || web.CoreWebView2 == null) return;
        var maximized = WindowState == FormWindowState.Maximized;
        if (!always && maximized == lastMaximized) return;
        lastMaximized = maximized;
        web.CoreWebView2.PostWebMessageAsJson("{\"type\":\"window\",\"maximized\":" + (maximized ? "true" : "false") + "}");
    }

    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        PostWindowState(false);
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WM_NCCALCSIZE && m.WParam != IntPtr.Zero && navbarIsTitleBar)
        {
            // Let Windows size the frame, then give the title bar's height back to
            // the page. The side and bottom edges stay, so the window still resizes
            // and keeps its shadow; the page draws its own top resize edge.
            var before = (NCCALCSIZE_PARAMS)Marshal.PtrToStructure(m.LParam, typeof(NCCALCSIZE_PARAMS));
            base.WndProc(ref m);
            var after = (NCCALCSIZE_PARAMS)Marshal.PtrToStructure(m.LParam, typeof(NCCALCSIZE_PARAMS));
            // A maximized window hangs its frame off the screen on every side;
            // keep the top inside it or the navbar is cut off.
            var frame = after.Proposed.Left - before.Proposed.Left;
            after.Proposed.Top = before.Proposed.Top + (IsZoomed(Handle) ? frame : 0);
            Marshal.StructureToPtr(after, m.LParam, false);
            m.Result = IntPtr.Zero;
            return;
        }
        base.WndProc(ref m);
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        if (!Launcher.Quitting && e.CloseReason == CloseReason.UserClosing && Launcher.BatchRunning())
        {
            var answer = MessageBox.Show(
                "Days are still being made. Closing LiturgyGen stops them.\n\nClose anyway?",
                "LiturgyGen", MessageBoxButtons.YesNo, MessageBoxIcon.Warning, MessageBoxDefaultButton.Button2);
            if (answer != DialogResult.Yes)
            {
                e.Cancel = true;
                return;
            }
        }
        base.OnFormClosing(e);
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        Launcher.StopServer();
        base.OnFormClosed(e);
    }

    /// <summary>Called from another thread when the icon is opened again.</summary>
    public void ShowAgain()
    {
        if (!IsHandleCreated) return;
        BeginInvoke((Action)delegate
        {
            if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
            Activate();
            TopMost = true;
            TopMost = false;
        });
    }
}
