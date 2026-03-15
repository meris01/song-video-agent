import { useState, useEffect } from "react";
import {
  Database,
  Key,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Rocket,
  Eye,
  EyeOff,
  Shield,
  Copy,
  ClipboardCheck,
  HardDrive,
  ExternalLink,
  FolderOpen,
  Link2,
} from "lucide-react";
import Card from "../components/Card";
import Button from "../components/Button";
import StatusBadge from "../components/StatusBadge";
import CaptionDesigner from "../components/CaptionDesigner";

export default function Settings() {
  const [form, setForm] = useState({
    supabase_url: "",
    supabase_service_key: "",
    gemini_api_key: "",
    twelve_labs_api_key: "",
    google_drive_client_id: "",
    google_drive_client_secret: "",
    google_drive_redirect_uri: "http://localhost:3000/settings",
  });
  const [serverState, setServerState] = useState({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState(null);
  const [showKeys, setShowKeys] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [driveAuthUrl, setDriveAuthUrl] = useState("");
  const [driveCode, setDriveCode] = useState("");
  const [driveConnecting, setDriveConnecting] = useState(false);
  const [folderId, setFolderId] = useState("");

  const fetchServerState = () => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setServerState(data);
        if (data.supabase_url) setForm((p) => ({ ...p, supabase_url: data.supabase_url }));
        if (data.google_drive_client_id) setForm((p) => ({ ...p, google_drive_client_id: data.google_drive_client_id }));
        if (data.google_drive_redirect_uri) setForm((p) => ({ ...p, google_drive_redirect_uri: data.google_drive_redirect_uri }));
        if (data.google_drive_folder_id) setFolderId(data.google_drive_folder_id);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  };

  useEffect(() => {
    fetchServerState();
    // Check for OAuth callback code in URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      setDriveCode(code);
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const payload = {};
      for (const [key, val] of Object.entries(form)) {
        if (val.trim()) payload[key] = val;
      }
      if (!Object.keys(payload).length) {
        alert("No new values to save.");
        setSaving(false);
        return;
      }
      const r = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (data.status === "saved") {
        setSaved(true);
        setForm((p) => ({
          ...p,
          supabase_service_key: "",
          gemini_api_key: "",
          twelve_labs_api_key: "",
          google_drive_client_secret: "",
        }));
        fetchServerState();
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      alert("Save failed: " + e.message);
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch("/api/settings/test-supabase", { method: "POST" });
      setTestResult(await r.json());
    } catch (e) {
      setTestResult({ status: "error", message: e.message });
    }
    setTesting(false);
  };

  const handleDeploy = async () => {
    setDeploying(true);
    setDeployResult(null);
    try {
      const r = await fetch("/api/settings/deploy-schema", { method: "POST" });
      setDeployResult(await r.json());
    } catch (e) {
      setDeployResult({ status: "error", message: e.message });
    }
    setDeploying(false);
  };

  const copySql = () => {
    if (deployResult?.sql) {
      navigator.clipboard.writeText(deployResult.sql);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    }
  };

  const getDriveAuthUrl = async () => {
    try {
      const r = await fetch("/api/drive/auth-url", { method: "POST" });
      const d = await r.json();
      if (d.auth_url) setDriveAuthUrl(d.auth_url);
      else alert(d.detail || "Failed to get auth URL");
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const exchangeDriveCode = async () => {
    if (!driveCode.trim()) return;
    setDriveConnecting(true);
    try {
      const fd = new FormData();
      fd.append("code", driveCode.trim());
      const r = await fetch("/api/drive/exchange-code", { method: "POST", body: fd });
      const d = await r.json();
      if (d.status === "connected") {
        fetchServerState();
        setDriveCode("");
        setDriveAuthUrl("");
      } else {
        alert(d.detail || "Failed to connect");
      }
    } catch (e) {
      alert("Error: " + e.message);
    }
    setDriveConnecting(false);
  };

  const saveFolderId = async () => {
    try {
      const fd = new FormData();
      fd.append("folder_id", folderId.trim());
      await fetch("/api/settings/save-drive-folder", { method: "POST", body: fd });
    } catch {}
  };

  const toggle = (key) => setShowKeys((p) => ({ ...p, [key]: !p[key] }));

  if (!loaded) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-pulse-soft text-stone-400">Loading settings...</div>
    </div>
  );

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Settings</h1>
        <p className="text-sm text-stone-500 mt-1">Configure your connections and API keys</p>
      </div>

      {/* ═══ Supabase Connection ═══ */}
      <Card>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Database className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-stone-800">Supabase Connection</h2>
            <p className="text-xs text-stone-500">Connect your Supabase project for vector storage</p>
          </div>
          {serverState.supabase_connected ? (
            <StatusBadge variant="success">Connected</StatusBadge>
          ) : (
            <StatusBadge variant="warning">Not connected</StatusBadge>
          )}
        </div>

        <div className="space-y-4">
          <InputField label="Project URL" type="url" placeholder="https://your-project.supabase.co"
            value={form.supabase_url} onChange={(v) => setForm((p) => ({ ...p, supabase_url: v }))} />
          <SecretField label="Service Role Key" placeholder="eyJhbGciOi..."
            saved={serverState.supabase_service_key_set}
            value={form.supabase_service_key} onChange={(v) => setForm((p) => ({ ...p, supabase_service_key: v }))}
            show={showKeys.supabase} onToggle={() => toggle("supabase")} />
        </div>

        <div className="flex items-center gap-3 mt-5 flex-wrap">
          <Button onClick={handleTest} loading={testing} variant="secondary" disabled={!serverState.supabase_connected}>
            Test Connection
          </Button>
          <Button onClick={handleDeploy} loading={deploying} variant="secondary" disabled={!serverState.supabase_connected}>
            <Rocket className="w-4 h-4" /> Deploy Schema
          </Button>
          {testResult && (
            <div className="flex items-center gap-2 text-sm">
              {testResult.status === "connected" ? (
                <><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-emerald-600">{testResult.message}</span></>
              ) : testResult.status === "no_schema" ? (
                <><AlertCircle className="w-4 h-4 text-amber-500" /><span className="text-amber-600">{testResult.message}</span></>
              ) : (
                <><XCircle className="w-4 h-4 text-red-500" /><span className="text-red-600">{testResult.message}</span></>
              )}
            </div>
          )}
        </div>

        {deployResult && (
          <div className={`mt-3 px-4 py-3 rounded-xl text-sm ${
            deployResult.status === "success" ? "bg-emerald-50 text-emerald-700"
            : deployResult.status === "manual" ? "bg-sky-50 text-sky-800"
            : "bg-amber-50 text-amber-700"
          }`}>
            <p className="font-medium">{deployResult.message}</p>
            {deployResult.sql && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold">SQL Schema (copy & run in Supabase SQL Editor):</p>
                  <Button variant="ghost" onClick={copySql} className="!px-2 !py-1 text-xs">
                    {copiedSql ? <><ClipboardCheck className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy SQL</>}
                  </Button>
                </div>
                <pre className="bg-stone-900 text-stone-200 rounded-lg p-3 text-xs overflow-x-auto max-h-64 overflow-y-auto">
                  {deployResult.sql}
                </pre>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ═══ API Keys ═══ */}
      <Card>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
            <Key className="w-5 h-5 text-primary-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-stone-800">API Keys</h2>
            <p className="text-xs text-stone-500">Required for embedding, matching, and rendering</p>
          </div>
          {serverState.gemini_connected ? (
            <StatusBadge variant="success">Gemini ready</StatusBadge>
          ) : (
            <StatusBadge variant="warning">Gemini not set</StatusBadge>
          )}
        </div>

        <div className="space-y-4">
          <SecretField label="Gemini API Key" placeholder="AIza..." required
            saved={serverState.gemini_api_key_set}
            value={form.gemini_api_key} onChange={(v) => setForm((p) => ({ ...p, gemini_api_key: v }))}
            show={showKeys.gemini} onToggle={() => toggle("gemini")} />
          <SecretField label="Twelve Labs API Key" placeholder="tlk_..." optional
            saved={serverState.twelve_labs_api_key_set}
            value={form.twelve_labs_api_key} onChange={(v) => setForm((p) => ({ ...p, twelve_labs_api_key: v }))}
            show={showKeys.twelve} onToggle={() => toggle("twelve")} />
        </div>
      </Card>

      {/* ═══ Google Drive ═══ */}
      <Card>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <HardDrive className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-stone-800">Google Drive</h2>
            <p className="text-xs text-stone-500">Save rendered videos to your Drive</p>
          </div>
          {serverState.google_drive_connected ? (
            <StatusBadge variant="success">Connected</StatusBadge>
          ) : (
            <StatusBadge variant="neutral">Not connected</StatusBadge>
          )}
        </div>

        <div className="space-y-4">
          <InputField label="Client ID" placeholder="1234567890-abc.apps.googleusercontent.com"
            value={form.google_drive_client_id}
            onChange={(v) => setForm((p) => ({ ...p, google_drive_client_id: v }))} />
          <SecretField label="Client Secret" placeholder="GOCSPX-..."
            saved={serverState.google_drive_client_secret_set}
            value={form.google_drive_client_secret}
            onChange={(v) => setForm((p) => ({ ...p, google_drive_client_secret: v }))}
            show={showKeys.drive_secret} onToggle={() => toggle("drive_secret")} />
          <InputField label="Redirect URI" placeholder="http://localhost:3000/settings"
            value={form.google_drive_redirect_uri}
            onChange={(v) => setForm((p) => ({ ...p, google_drive_redirect_uri: v }))} />

          {/* Drive Folder ID */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">
              <span className="flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5" /> Target Folder ID
                <StatusBadge variant="neutral">Optional</StatusBadge>
              </span>
            </label>
            <div className="flex gap-2">
              <input type="text" placeholder="Drive folder ID (leave empty for root)"
                value={folderId} onChange={(e) => setFolderId(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition" />
              <Button variant="secondary" size="sm" onClick={saveFolderId}>Save</Button>
            </div>
          </div>
        </div>

        {/* OAuth Flow */}
        {!serverState.google_drive_connected && (
          <div className="mt-5 p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-3">
            <p className="text-xs font-semibold text-stone-700">Connect Google Drive</p>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              1. Save your Client ID and Secret above first<br />
              2. Click "Get Authorization URL" and authorize in Google<br />
              3. Copy the code from the redirect URL and paste below
            </p>

            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={getDriveAuthUrl}>
                <Link2 className="w-3.5 h-3.5" /> Get Authorization URL
              </Button>
              {driveAuthUrl && (
                <a href={driveAuthUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
                  <ExternalLink className="w-3 h-3" /> Open Google Auth
                </a>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input type="text" placeholder="Paste authorization code here"
                value={driveCode} onChange={(e) => setDriveCode(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
              <Button size="sm" onClick={exchangeDriveCode} loading={driveConnecting} disabled={!driveCode.trim()}>
                Connect
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ═══ Caption Design ═══ */}
      <CaptionDesigner />

      {/* ═══ Save All ═══ */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} loading={saving}>
          <Shield className="w-4 h-4" /> Save All Settings
        </Button>
        {saved && (
          <span className="text-sm text-emerald-600 flex items-center gap-1.5 animate-fade-in">
            <CheckCircle2 className="w-4 h-4" /> Settings saved successfully
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Reusable field components ─── */

function InputField({ label, value, onChange, ...props }) {
  return (
    <div>
      <label className="block text-sm font-medium text-stone-700 mb-1.5">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition"
        {...props}
      />
    </div>
  );
}

function SecretField({ label, value, onChange, saved, show, onToggle, required, optional, ...props }) {
  return (
    <div>
      <label className="block text-sm font-medium text-stone-700 mb-1.5">
        {label}{" "}
        {required && <StatusBadge variant="accent">Required</StatusBadge>}
        {optional && <StatusBadge variant="neutral">Optional</StatusBadge>}
        {saved && <span className="ml-2 text-xs text-emerald-600 font-normal">(saved)</span>}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={saved ? "••••••••  (already saved)" : props.placeholder}
          className="w-full px-4 py-2.5 pr-10 rounded-xl border border-stone-200 bg-white text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition"
          {...props}
        />
        <button onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
