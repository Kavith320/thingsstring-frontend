"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiRequest } from "../../../../../lib/api";
import { getToken } from "../../../../../lib/auth";

/* ---------------- UI helpers ---------------- */

function Card({ title, right, children }) {
  return (
    <div className="rounded-2xl border shadow-sm border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="font-semibold">{title}</div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Btn({ children, onClick, disabled, variant = "outline", type = "button" }) {
  const base = "rounded-xl px-3 py-2 text-sm disabled:opacity-60";
  const cls =
    variant === "solid"
      ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${cls}`}>
      {children}
    </button>
  );
}

function Input({ value, onChange, placeholder, type = "text" }) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm
                 dark:border-zinc-700 dark:bg-zinc-950/40"
    />
  );
}

function Select({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm
                 dark:border-zinc-700 dark:bg-zinc-950/40"
    >
      {children}
    </select>
  );
}

/* ---------------- data helpers ---------------- */

function normalizeList(res) {
  // supports: { ok, schedules: [] } OR { schedules: [] } OR []
  if (Array.isArray(res)) return res;
  return res?.schedules || res?.items || [];
}

/* ---------------- form defaults ---------------- */

function blankSchedule(timezone = "Asia/Colombo") {
  return {
    name: "",
    enabled: true,
    timezone,
    cron: "0 */5 * * * *", // every 5 minutes (seconds supported)
    actions: [{ actuator: "", set: { state: "ON", auto: true } }],
    duration_sec: 0,
    end_actions: [{ actuator: "", set: { state: "OFF", auto: true } }],
  };
}

/* ---------------- page ---------------- */

export default function DeviceSchedulesPage() {
  const params = useParams();
  const deviceId = params?.deviceId;

  const [device, setDevice] = useState(null);
  const [schedules, setSchedules] = useState([]);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // modal/form state
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankSchedule());
  const [saving, setSaving] = useState(false);

  const baseDeviceSchedulesPath = `/api/schedules/devices/${deviceId}/schedules`;

  async function loadDevice() {
    const token = getToken();
    const res = await apiRequest(`/api/devices/${deviceId}`, { token });
    return res?.device || res;
  }

  async function loadSchedules() {
    const token = getToken();
    const res = await apiRequest(baseDeviceSchedulesPath, { token });
    return normalizeList(res);
  }

  async function refreshAll() {
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const [d, list] = await Promise.all([loadDevice(), loadSchedules()]);
      setDevice(d);
      setSchedules(list);
    } catch (e) {
      setErr(e.message || "Failed to load schedules");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!deviceId) return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  const actuatorKeys = useMemo(() => {
    const controlActs = device?.control?.actuators || {};
    const configActs = device?.config?.actuators || {};
    const keys = new Set([...Object.keys(controlActs), ...Object.keys(configActs)]);
    return Array.from(keys);
  }, [device]);

  const timezoneDefault = device?.config?.scheduler?.timezone || "Asia/Colombo";

  function openCreate() {
    setEditingId(null);
    setForm(blankSchedule(timezoneDefault));
    setOpen(true);
    setMsg("");
    setErr("");
  }

  function openEdit(s) {
    setEditingId(s?._id || s?.id);
    setForm({
      name: s?.name || "",
      enabled: Boolean(s?.enabled),
      timezone: s?.timezone || timezoneDefault,
      cron: s?.cron || "0 */5 * * * *",
      actions: Array.isArray(s?.actions) && s.actions.length ? s.actions : [{ actuator: "", set: { state: "ON", auto: true } }],
      duration_sec: Number(s?.duration_sec || 0),
      end_actions:
        Array.isArray(s?.end_actions) && s.end_actions.length
          ? s.end_actions
          : [{ actuator: "", set: { state: "OFF", auto: true } }],
    });
    setOpen(true);
    setMsg("");
    setErr("");
  }

  function closeModal() {
    setOpen(false);
    setEditingId(null);
    setSaving(false);
  }

  function updateAction(idx, patch) {
    setForm((f) => {
      const next = [...(f.actions || [])];
      next[idx] = { ...next[idx], ...patch };
      return { ...f, actions: next };
    });
  }

  function updateActionSet(idx, patchSet) {
    setForm((f) => {
      const next = [...(f.actions || [])];
      const cur = next[idx] || {};
      next[idx] = { ...cur, set: { ...(cur.set || {}), ...patchSet } };
      return { ...f, actions: next };
    });
  }

  function addAction() {
    setForm((f) => ({
      ...f,
      actions: [...(f.actions || []), { actuator: "", set: { state: "ON", auto: true } }],
    }));
  }

  function removeAction(idx) {
    setForm((f) => {
      const next = [...(f.actions || [])];
      next.splice(idx, 1);
      return { ...f, actions: next.length ? next : [{ actuator: "", set: { state: "ON", auto: true } }] };
    });
  }

  function updateEndAction(idx, patch) {
    setForm((f) => {
      const next = [...(f.end_actions || [])];
      next[idx] = { ...next[idx], ...patch };
      return { ...f, end_actions: next };
    });
  }

  function updateEndActionSet(idx, patchSet) {
    setForm((f) => {
      const next = [...(f.end_actions || [])];
      const cur = next[idx] || {};
      next[idx] = { ...cur, set: { ...(cur.set || {}), ...patchSet } };
      return { ...f, end_actions: next };
    });
  }

  function addEndAction() {
    setForm((f) => ({
      ...f,
      end_actions: [...(f.end_actions || []), { actuator: "", set: { state: "OFF", auto: true } }],
    }));
  }

  function removeEndAction(idx) {
    setForm((f) => {
      const next = [...(f.end_actions || [])];
      next.splice(idx, 1);
      return { ...f, end_actions: next.length ? next : [{ actuator: "", set: { state: "OFF", auto: true } }] };
    });
  }

  async function saveSchedule() {
    setSaving(true);
    setMsg("");
    setErr("");

    try {
      const token = getToken();

      // minimal validation
      if (!form.name.trim()) throw new Error("Schedule name is required");
      if (!form.cron.trim()) throw new Error("Cron is required");
      if (!form.actions?.length) throw new Error("At least 1 action is required");
      for (const a of form.actions) {
        if (!a.actuator) throw new Error("Select actuator for all actions");
        if (!a.set?.state) throw new Error("Select state for all actions");
      }

      const payload = {
        name: form.name.trim(),
        enabled: Boolean(form.enabled),
        timezone: form.timezone || timezoneDefault,
        cron: form.cron.trim(),
        actions: form.actions,
        duration_sec: Number(form.duration_sec || 0),
        end_actions: form.end_actions,
      };

      if (editingId) {
        await apiRequest(`/api/schedules/${editingId}`, { method: "PUT", token, body: payload });
        setMsg("✅ Schedule updated");
      } else {
        await apiRequest(baseDeviceSchedulesPath, { method: "POST", token, body: payload });
        setMsg("✅ Schedule created");
      }

      closeModal();
      await refreshAll();
    } catch (e) {
      setErr(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSchedule(id) {
    if (!id) return;
    setMsg("");
    setErr("");

    try {
      const token = getToken();
      await apiRequest(`/api/schedules/${id}`, { method: "DELETE", token });
      setMsg("✅ Deleted");
      await refreshAll();
    } catch (e) {
      setErr(e.message || "Delete failed");
    }
  }

  async function toggleEnabled(s) {
    const id = s?._id || s?.id;
    if (!id) return;

    setMsg("");
    setErr("");

    try {
      const token = getToken();
      await apiRequest(`/api/schedules/${id}`, {
        method: "PUT",
        token,
        body: { enabled: !s.enabled },
      });
      await refreshAll();
    } catch (e) {
      setErr(e.message || "Update failed");
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border p-5 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60 flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold">Schedules</div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 break-all">
            Device: <span className="text-zinc-900 dark:text-zinc-100 font-medium">{deviceId}</span>
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
            Cron supports seconds (6 fields). Example: <span className="font-mono">*/2 * * * * *</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Btn onClick={refreshAll} disabled={loading}>Refresh</Btn>
          <Btn variant="solid" onClick={openCreate} disabled={loading || actuatorKeys.length === 0}>
            + New Schedule
          </Btn>
        </div>
      </div>
        {/* Messages */}
      {err && (
        <div className="rounded-2xl border p-4 border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300">
          {err}
        </div>
      )}
      {msg && (
        <div className="rounded-2xl border p-4 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60 text-sm">
          {msg}
        </div>
      )}

      {/* List */}
      <Card
        title={`Schedules (${schedules.length})`}
        right={<span className="text-xs text-zinc-500 dark:text-zinc-400">{loading ? "Loading…" : ""}</span>}
      >
        {schedules.length === 0 ? (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            No schedules yet. Click <b>New Schedule</b>.
          </div>
        ) : (
          <div className="grid gap-3">
            {schedules.map((s) => {
              const id = s?._id || s?.id;
              return (
                <div
                  key={id}
                  className="rounded-2xl border p-4 border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{s?.name || "Unnamed schedule"}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        Cron: <span className="font-mono">{s?.cron}</span> • TZ: {s?.timezone || timezoneDefault}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        Enabled: <b>{String(Boolean(s?.enabled))}</b> • Duration: {Number(s?.duration_sec || 0)}s
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Btn onClick={() => toggleEnabled(s)} disabled={loading}>
                        {s?.enabled ? "Disable" : "Enable"}
                      </Btn>
                      <Btn onClick={() => openEdit(s)} disabled={loading}>Edit</Btn>
                      <Btn onClick={() => deleteSchedule(id)} disabled={loading}>Delete</Btn>
                    </div>
                  </div>

                  {/* Small action summary */}
                  <div className="mt-3 text-sm">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">Actions</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {(s?.actions || []).map((a, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-1 rounded-full border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          {a?.actuator} → {a?.set?.state} (auto:{String(Boolean(a?.set?.auto))})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="font-semibold">
                {editingId ? "Edit Schedule" : "New Schedule"}
              </div>
              <Btn onClick={closeModal}>Close</Btn>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Name</div>
                  <Input value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Morning irrigation" />
                </div>

                <div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Timezone</div>
                  <Input value={form.timezone} onChange={(v) => setForm((f) => ({ ...f, timezone: v }))} placeholder="Asia/Colombo" />
                </div>

                <div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Cron (6 fields)</div>
                  <Input value={form.cron} onChange={(v) => setForm((f) => ({ ...f, cron: v }))} placeholder="*/2 * * * * *" />
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                    Example: <span className="font-mono">0 0 6 * * *</span> = 06:00:00 every day
                  </div>
                </div>

                <div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Enabled</div>
                  <Select
                    value={String(Boolean(form.enabled))}
                    onChange={(v) => setForm((f) => ({ ...f, enabled: v === "true" }))}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </Select>
                </div>

                <div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Duration (seconds)</div>
                  <Input
                    type="number"
                    value={String(form.duration_sec ?? 0)}
                    onChange={(v) => setForm((f) => ({ ...f, duration_sec: Number(v || 0) }))}
                    placeholder="1"
                  />
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                    If &gt; 0, end_actions will run after duration.
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Actions (start)</div>
                  <Btn onClick={addAction}>+ Add action</Btn>
                </div>

                <div className="grid gap-3">
                  {form.actions.map((a, idx) => (
                    <div key={idx} className="rounded-2xl border p-4 border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="md:col-span-2">
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Actuator</div>
                          <Select
                            value={a.actuator}
                            onChange={(v) => updateAction(idx, { actuator: v })}
                          >
                            <option value="">Select actuator…</option>
                            {actuatorKeys.map((k) => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </Select>
                        </div>

                        <div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">State</div>
                          <Select
                            value={a?.set?.state || "ON"}
                            onChange={(v) => updateActionSet(idx, { state: v })}
                          >
                            <option value="ON">ON</option>
                            <option value="OFF">OFF</option>
                            <option value="IDLE">IDLE</option>
                          </Select>
                        </div>

                        <div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Auto</div>
                          <Select
                            value={String(Boolean(a?.set?.auto))}
                            onChange={(v) => updateActionSet(idx, { auto: v === "true" })}
                          >
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </Select>
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <Btn onClick={() => removeAction(idx)}>Remove</Btn>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* End actions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">End actions (after duration)</div>
                  <Btn onClick={addEndAction}>+ Add end action</Btn>
                </div>

                <div className="grid gap-3">
                  {form.end_actions.map((a, idx) => (
                    <div key={idx} className="rounded-2xl border p-4 border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="md:col-span-2">
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Actuator</div>
                          <Select
                            value={a.actuator}
                            onChange={(v) => updateEndAction(idx, { actuator: v })}
                          >
                            <option value="">Select actuator…</option>
                            {actuatorKeys.map((k) => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </Select>
                        </div>

                        <div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">State</div>
                          <Select
                            value={a?.set?.state || "OFF"}
                            onChange={(v) => updateEndActionSet(idx, { state: v })}
                          >
                            <option value="OFF">OFF</option>
                            <option value="ON">ON</option>
                            <option value="IDLE">IDLE</option>
                          </Select>
                        </div>

                        <div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Auto</div>
                          <Select
                            value={String(Boolean(a?.set?.auto))}
                            onChange={(v) => updateEndActionSet(idx, { auto: v === "true" })}
                          >
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </Select>
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <Btn onClick={() => removeEndAction(idx)}>Remove</Btn>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800 pt-4">
                <Btn onClick={closeModal} disabled={saving}>Cancel</Btn>
                <Btn variant="solid" onClick={saveSchedule} disabled={saving}>
                  {saving ? "Saving…" : (editingId ? "Update" : "Create")}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
