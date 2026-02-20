# Automation Engine v1: Backend Implementation Guide

This document outlines the requirements and data structures for the ThingsString Automation Engine to ensure seamless integration between the **Visual Canvas Designer (Frontend)** and the **Polling/Execution Worker (Backend)**.

## 1. Flow Schema (Data Structure)

Every automation created on the canvas is saved as an "Automation Flow" object. The backend must support the following fields in the database:

### Core Fields
- **name** (string): Human-readable name (e.g., "Temp -> Fan Auto").
- **deviceId** (string): **Sensor Hub ID.** The unique ID of the device providing telemetry.
- **enabled** (boolean): Whether the flow is active.
- **metricPath** (string): The specific key in the telemetry JSON to monitor (e.g., `t`, `h`, `battery`).
- **deltaThreshold** (number): The minimum change required in the value to trigger an action (Delta Filter logic).
- **intervalSec** (number): How often to check for changes (e.g., 30s).
- **cooldownSec** (number): Minimum wait time between two successful executions.

### Action Object
- **action** (object):
  - **deviceId** (string): **Actuator Hub ID.** The unique ID of the target device. (May be different from the sensor ID).
  - **actuatorKey** (string): The specific key/pin on the actuator to toggle (e.g., `relay1`, `led`).
  - **setValue** (boolean | number | string): The command value to send (e.g., `true`, `1`, `"ON"`).

### Persistence (UI Metadata)
- **ui_metadata** (object): Stores the coordinates of nodes on the canvas. The backend should persist this but does not need to process it.
  - `sourcePosition`, `logicPosition`, `actionPosition` (objects with `x`, `y`).

---

## 2. API Endpoint Requirements

### POST /api/automation/flows
- **Request Body**: New flow data (without `_id`).
- **Success**: Returns the created object including the generated `_id`.

### PUT /api/automation/flows/:id
- **Validation**: The backend should **NOT** expect the `_id` field inside the request body. If present, it should be ignored or stripped to avoid "Immutable Field" errors in MongoDB/SQL.
- **Robustness**: Add null-checks for the `action` and `trigger` objects. If a field is missing, use defaults instead of throwing a 500 error.

### GET /api/automation/flows
- Should return an array or an object containing the array: `{ flows: [...] }`.

---

## 3. Backend Optimization & Fixes

To solve identified issues in the v1 implementation, we recommend the following backend improvements:

### A. Null-Safety Guard
Many 500 errors occur when the backend tries to read properties of `null`. 
- **Recommendation**: Implement a schema validator (like Zod or Joi) that ensures required fields like `deviceId` and `actuatorKey` exist before attempting execution.

### B. Standardized Command Toggling
There is currently a mix of `setValue`, `value`, and `state`. 
- **Requirement**: Standardize on **`setValue`** as the primary field for actuator commands to match the Execution History logs.

### C. Error Messaging
- **Requirement**: Never return an empty error object `{}` for 500 errors. Always return `{ "ok": false, "error": "Reason description" }` to help frontend debugging.

### D. Device Mapping Logic
The frontend now strictly tracks `source.deviceId` and `action.deviceId`.
- **Requirement**: The backend worker must use `action.deviceId` for the MQTT/HTTP command, NOT the top-level `deviceId` (which is for the sensor).

---

## 4. Visual Comparison for Verification

| Feature | Frontend Sends | Backend Expected |
| :--- | :--- | :--- |
| **Trigger Source** | `deviceId` | Sensor Hub Unique ID |
| **Logic** | `deltaThreshold` | Float (e.g. 0.5) |
| **Target Hub** | `action.deviceId` | Actuator Hub Unique ID |
| **Target Pin** | `action.actuatorKey` | Key string (e.g. `relay1`) |
| **Coordinates** | `ui_metadata` | Persistent JSON Object |
