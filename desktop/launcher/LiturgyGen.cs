// LiturgyGen.exe - what the desktop icon opens.
//
// Starts the bundled Node server out of sight, opens LiturgyGen in the browser,
// and sits beside the clock so the office can open it again or quit. Opening
// the icon a second time only opens the browser; the server is started once.
//
// Built with the C# compiler that ships with Windows (.NET Framework 4), so
// the office computer needs nothing installed: see desktop/build.mjs.
// That compiler speaks C# 5 - no string interpolation, no "?.".

using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

static class Launcher
{
    // The environment overrides exist for testing a build beside a running
    // development copy; the office never sets them.
    static readonly int Port = EnvInt("LITURGYGEN_PORT", 4000);
    static readonly string Url = "http://localhost:" + Port + "/";
    // The server listens on IPv4 only. "localhost" tries IPv6 first, and .NET's
    // fallback outlasts a short timeout, so health checks name the address.
    static readonly string HealthUrl = "http://127.0.0.1:" + Port + "/api/health";
    static readonly string AppDir = AppDomain.CurrentDomain.BaseDirectory;
    static readonly string DataDir = Environment.GetEnvironmentVariable("LITURGYGEN_DATA_DIR") ?? Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LiturgyGen");
    static readonly bool NoBrowser = Environment.GetEnvironmentVariable("LITURGYGEN_NO_BROWSER") == "1";
    static readonly string LogFile = Path.Combine(DataDir, "logs", "server.log");

    static Process server;
    static NotifyIcon tray;
    static bool quitting;

    [STAThread]
    static void Main()
    {
        Application.EnableVisualStyles();
        bool firstInstance;
        using (var mutex = new Mutex(true, "Local\\LiturgyGenLauncher" + Port, out firstInstance))
        {
            if (!firstInstance)
            {
                // Already running: the icon was opened again, so just show it.
                if (WaitForServer(20000)) OpenBrowser();
                else Fail("LiturgyGen is starting but did not answer. Try again in a moment.");
                return;
            }

            if (IsLiturgyGen())
            {
                // Something already serves LiturgyGen here (a development copy).
                OpenBrowser();
                return;
            }
            if (PortTaken())
            {
                Fail("Another program on this computer is using port " + Port +
                     ", which LiturgyGen needs. Close that program and open LiturgyGen again.");
                return;
            }

            try
            {
                StartServer();
            }
            catch (Exception error)
            {
                Fail("LiturgyGen could not start: " + error.Message);
                return;
            }

            if (!WaitForServer(60000))
            {
                StopServer();
                Fail("LiturgyGen did not start. Details were saved in:\n" + LogFile);
                return;
            }

            ShowTray();
            OpenBrowser();
            Application.Run();
            StopServer();
        }
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
            // The server stopped on its own; say so rather than leave a dead icon.
            if (tray != null)
            {
                tray.Visible = false;
                MessageBox.Show("LiturgyGen stopped unexpectedly. Open it again from the desktop icon.\n\nDetails: " + LogFile,
                    "LiturgyGen", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                Application.Exit();
            }
        };
        server.Start();
        server.BeginOutputReadLine();
        server.BeginErrorReadLine();
    }

    static void StopServer()
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

    static void ShowTray()
    {
        var menu = new ContextMenuStrip();
        var open = menu.Items.Add("Open LiturgyGen", null, delegate { OpenBrowser(); });
        open.Font = new Font(open.Font, FontStyle.Bold);
        menu.Items.Add("Open data folder", null, delegate { Process.Start("explorer.exe", "\"" + DataDir + "\""); });
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

        // Signing out or shutting down: stop the server cleanly.
        Microsoft.Win32.SystemEvents.SessionEnding += delegate { StopServer(); };
    }

    static int EnvInt(string name, int fallback)
    {
        int value;
        return int.TryParse(Environment.GetEnvironmentVariable(name), out value) ? value : fallback;
    }

    static void OpenBrowser()
    {
        if (NoBrowser) return;
        try
        {
            Process.Start(Url);
        }
        catch (Exception error)
        {
            Fail("Could not open the browser (" + error.Message + "). Open " + Url + " yourself.");
        }
    }

    static string Health()
    {
        try
        {
            var request = (HttpWebRequest)WebRequest.Create(HealthUrl);
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
            // Something answered, just not with LiturgyGen.
            return error.Response != null ? "" : null;
        }
        catch
        {
            return null;
        }
    }

    static bool IsLiturgyGen()
    {
        var body = Health();
        return body != null && body.Contains("\"service\":\"LiturgyGen\"");
    }

    static bool PortTaken()
    {
        return Health() != null;
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

    static void Fail(string message)
    {
        MessageBox.Show(message, "LiturgyGen", MessageBoxButtons.OK, MessageBoxIcon.Warning);
    }
}
